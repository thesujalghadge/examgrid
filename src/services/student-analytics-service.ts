import { createClient } from "@supabase/supabase-js";

export interface CurriculumNodeStats {
  nodeId: string;
  nodeName: string;
  nodeType: 'SUBJECT' | 'CHAPTER' | 'TOPIC' | 'SUBTOPIC';
  totalAttempted: number;
  totalCorrect: number;
  totalTimeSpentMs: number;
  accuracy: number;
  avgTimeSeconds: number;
}

export interface StudentSpeedClassification {
  speed: 'FAST' | 'NORMAL' | 'SLOW';
  accuracy: 'ACCURATE' | 'INACCURATE';
  quadrant: 'MASTERED' | 'INEFFICIENT' | 'RUSHING' | 'NEEDS_WORK';
}

export interface TopicInsight extends CurriculumNodeStats {
  subjectName: string;
  chapterName: string;
  classification?: StudentSpeedClassification;
}

export interface ChapterHierarchy extends CurriculumNodeStats {
  topics: TopicInsight[];
}

export interface SubjectHierarchy extends CurriculumNodeStats {
  chapters: ChapterHierarchy[];
}

export interface StudentAnalyticsDashboardDTO {
  overall: {
    totalAttempted: number;
    totalCorrect: number;
    accuracy: number;
    avgTimeSeconds: number;
    isSpeedDataAvailable: boolean;
    subjectsCovered: number;
    chaptersCovered: number;
    topicsCovered: number;
  };
  topStrengths: TopicInsight[];
  topWeaknesses: TopicInsight[];
  speedAnalysis: {
    isAvailable: boolean;
    mastered: TopicInsight[];
    inefficient: TopicInsight[];
    rushing: TopicInsight[];
    needsWork: TopicInsight[];
  };
  curriculum: SubjectHierarchy[];
}

export class SpeedClassifier {
  constructor(private globalAvgTimeSeconds: number, private globalAccuracy: number = 0.5) {}

  classify(topicAvgTimeSeconds: number, topicAccuracy: number): StudentSpeedClassification {
    // Phase 1: Simple dynamic threshold against student's global average
    const isFast = topicAvgTimeSeconds <= this.globalAvgTimeSeconds;
    const isAccurate = topicAccuracy >= Math.max(0.6, this.globalAccuracy);

    let speed: 'FAST' | 'NORMAL' | 'SLOW' = isFast ? 'FAST' : 'SLOW';
    let accuracy: 'ACCURATE' | 'INACCURATE' = isAccurate ? 'ACCURATE' : 'INACCURATE';
    let quadrant: StudentSpeedClassification['quadrant'] = 'NEEDS_WORK';

    if (isFast && isAccurate) quadrant = 'MASTERED';
    if (!isFast && isAccurate) quadrant = 'INEFFICIENT';
    if (isFast && !isAccurate) quadrant = 'RUSHING';
    if (!isFast && !isAccurate) quadrant = 'NEEDS_WORK';

    // Allow some buffer for "NORMAL" speed if within 15% of average, but user requested 4 quadrants for simplicity.
    return { speed, accuracy, quadrant };
  }
}

export class StudentAnalyticsService {
  static async getDashboard(studentId: string): Promise<StudentAnalyticsDashboardDTO> {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    if (!supabase) throw new Error("Service role not configured");

    // 1. Fetch raw stats + node details in a single query
    const { data: rows, error } = await supabase
      .from('student_node_statistics')
      .select(`
        *,
        curriculum_nodes (
          id, name, node_type, parent_id
        )
      `)
      .eq('student_id', studentId);

    if (error) throw new Error(error.message);

    const nodesMap = new Map<string, any>();
    // Pre-populate map
    for (const row of rows || []) {
      if (row.curriculum_nodes) {
        nodesMap.set(row.node_id, {
          ...row,
          nodeInfo: row.curriculum_nodes
        });
      }
    }

    // To compute hierarchy, we need full path names. Since the query only returns nodes the student attempted,
    // if they attempted a Topic, we technically need its Chapter and Subject names.
    // If they were rolled up properly, the student_node_statistics should have rows for Chapter and Subject too.
    // But wait! AnalyticsProjector only upserted the exact nodes emitted by ATTEMPT_FINISHED.
    // ATTEMPT_FINISHED emits Subject, Chapter, Topic, Subtopic deltas if they existed!
    // So all parent nodes WILL exist in `student_node_statistics` for this student.

    // 2. Build Hierarchy
    const subjects = new Map<string, SubjectHierarchy>();
    const chapters = new Map<string, ChapterHierarchy>();
    const topics = new Map<string, TopicInsight>();

    // Helper to format stats
    const formatStats = (row: any, name: string, type: any): CurriculumNodeStats => {
      const accuracy = row.total_attempted > 0 ? row.total_correct / row.total_attempted : 0;
      const avgTimeSeconds = row.total_attempted > 0 ? (row.total_time_spent_ms / row.total_attempted) / 1000 : 0;
      return {
        nodeId: row.node_id,
        nodeName: name,
        nodeType: type,
        totalAttempted: row.total_attempted,
        totalCorrect: row.total_correct,
        totalTimeSpentMs: row.total_time_spent_ms,
        accuracy,
        avgTimeSeconds
      };
    };

    // First pass: create all topics, chapters, subjects
    for (const [id, row] of Array.from(nodesMap.entries())) {
      const type = row.nodeInfo.node_type;
      const stats = formatStats(row, row.nodeInfo.name, type);
      
      if (type === 'SUBJECT') {
        subjects.set(id, { ...stats, chapters: [] });
      } else if (type === 'CHAPTER') {
        chapters.set(id, { ...stats, topics: [] });
      } else if (type === 'TOPIC') {
        topics.set(id, { ...stats, subjectName: '', chapterName: '' } as TopicInsight);
      }
    }

    // Second pass: link them up based on parent_id
    // Note: We need to traverse parent pointers to get Subject/Chapter names for topics
    for (const [id, row] of Array.from(nodesMap.entries())) {
      const parentId = row.nodeInfo.parent_id;
      if (!parentId) continue;

      if (row.nodeInfo.node_type === 'CHAPTER' && subjects.has(parentId)) {
        subjects.get(parentId)!.chapters.push(chapters.get(id)!);
      } else if (row.nodeInfo.node_type === 'TOPIC' && chapters.has(parentId)) {
        const topic = topics.get(id)!;
        const parentChapter = chapters.get(parentId);
        
        // Find subject name
        let subjectName = '';
        const chapterRow = nodesMap.get(parentId);
        if (chapterRow && chapterRow.nodeInfo.parent_id && subjects.has(chapterRow.nodeInfo.parent_id)) {
          subjectName = subjects.get(chapterRow.nodeInfo.parent_id)!.nodeName;
        }

        topic.chapterName = parentChapter?.nodeName || 'Unknown Chapter';
        topic.subjectName = subjectName || 'Unknown Subject';
        
        parentChapter?.topics.push(topic);
      }
    }

    // 3. Overall Stats
    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalTimeMs = 0;

    for (const sub of Array.from(subjects.values())) {
      totalAttempted += sub.totalAttempted;
      totalCorrect += sub.totalCorrect;
      totalTimeMs += sub.totalTimeSpentMs;
    }

    const overallAccuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;
    const overallAvgTime = totalAttempted > 0 ? (totalTimeMs / totalAttempted) / 1000 : 0;

    // 4. Classify Topics and sort Strengths/Weaknesses
    const classifier = new SpeedClassifier(overallAvgTime, overallAccuracy);
    const validTopics = Array.from(topics.values()).filter(t => t.totalAttempted >= 5);

    for (const topic of validTopics) {
      topic.classification = classifier.classify(topic.avgTimeSeconds, topic.accuracy);
    }

    const sortedByAccDesc = [...validTopics].sort((a, b) => b.accuracy - a.accuracy || b.totalAttempted - a.totalAttempted);
    const sortedByAccAsc = [...validTopics].sort((a, b) => a.accuracy - b.accuracy || b.totalAttempted - a.totalAttempted); // Tie break: highest attempt first for weaknesses!

    const topStrengths = sortedByAccDesc.slice(0, 3);
    const topWeaknesses = sortedByAccAsc.slice(0, 3);

    const isSpeedDataAvailable = overallAvgTime > 0;
    const speedAnalysis = {
      isAvailable: isSpeedDataAvailable,
      mastered: isSpeedDataAvailable ? validTopics.filter(t => t.classification?.quadrant === 'MASTERED') : [],
      inefficient: isSpeedDataAvailable ? validTopics.filter(t => t.classification?.quadrant === 'INEFFICIENT') : [],
      rushing: isSpeedDataAvailable ? validTopics.filter(t => t.classification?.quadrant === 'RUSHING') : [],
      needsWork: isSpeedDataAvailable ? validTopics.filter(t => t.classification?.quadrant === 'NEEDS_WORK') : []
    };

    return {
      overall: {
        totalAttempted,
        totalCorrect,
        accuracy: overallAccuracy,
        avgTimeSeconds: overallAvgTime,
        isSpeedDataAvailable,
        subjectsCovered: subjects.size,
        chaptersCovered: chapters.size,
        topicsCovered: topics.size
      },
      topStrengths,
      topWeaknesses,
      speedAnalysis,
      curriculum: Array.from(subjects.values())
    };
  }
}
