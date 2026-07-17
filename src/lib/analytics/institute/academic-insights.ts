import { SupabaseClient } from "@supabase/supabase-js";

export interface AcademicNodeInsight {
  nodeId: string;
  nodeName: string;
  nodeType: "SUBJECT" | "CHAPTER" | "CONCEPT";
  totalAttempted: number;
  totalCorrect: number;
  overallAccuracy: number;
  studentCount: number; // how many students contributed
}

export interface BatchAcademicInsight extends AcademicNodeInsight {
  batchId: string;
  batchName: string;
}

export async function fetchInstituteAcademicInsights(
  client: SupabaseClient,
  instituteId: string
) {
  // We need to fetch all cumulative analytics for students in this institute.
  // First, get all active students in the institute.
  const { data: students } = await client
    .from("students")
    .select("id, batch_id")
    .eq("institute_id", instituteId)
    .eq("is_active", true);

  if (!students || students.length === 0) {
    return {
      instituteWeakestSubjects: [],
      instituteWeakestChapters: [],
      instituteWeakestConcepts: [],
      batchSubjectInsights: []
    };
  }

  const studentIds = students.map((s) => s.id);
  const studentBatchMap = new Map<string, string>();
  students.forEach((s) => {
    if (s.batch_id) studentBatchMap.set(s.id, s.batch_id);
  });

  const { data: batches } = await client
    .from("batches")
    .select("id, name")
    .eq("institute_id", instituteId);
  const batchNameMap = new Map<string, string>();
  batches?.forEach(b => batchNameMap.set(b.id, b.name));

  // Fetch all cumulative analytics
  const [
    { data: subData },
    { data: chapData },
    { data: conData }
  ] = await Promise.all([
    client.from("student_cumulative_subject_analytics").select("*").in("student_id", studentIds),
    client.from("student_cumulative_chapter_analytics").select("*").in("student_id", studentIds),
    client.from("student_cumulative_concept_analytics").select("*").in("student_id", studentIds)
  ]);

  const allNodeIds = new Set<string>();
  
  const collectNodes = (rows: any[]) => {
    if (!rows) return;
    rows.forEach(r => allNodeIds.add(r.syllabus_node_id));
  };
  
  collectNodes(subData || []);
  collectNodes(chapData || []);
  collectNodes(conData || []);

  const { data: nodeData } = await client
    .from("batch_syllabus_nodes")
    .select("id, name, type")
    .in("id", Array.from(allNodeIds));
    
  const nodeNameMap = new Map<string, string>();
  const nodeTypeMap = new Map<string, string>();
  nodeData?.forEach(n => {
    nodeNameMap.set(n.id, n.name);
    nodeTypeMap.set(n.id, n.type);
  });

  // Helper to aggregate
  const aggregate = (rows: any[], targetType: "SUBJECT" | "CHAPTER" | "CONCEPT") => {
    const map = new Map<string, { attempted: number; correct: number; students: Set<string> }>();
    if (!rows) return [];
    
    rows.forEach(r => {
      if (!map.has(r.syllabus_node_id)) {
        map.set(r.syllabus_node_id, { attempted: 0, correct: 0, students: new Set() });
      }
      const agg = map.get(r.syllabus_node_id)!;
      agg.attempted += r.total_attempted;
      agg.correct += r.total_correct;
      agg.students.add(r.student_id);
    });

    const result: AcademicNodeInsight[] = [];
    for (const [nodeId, agg] of map.entries()) {
      if (agg.attempted > 0) {
        result.push({
          nodeId,
          nodeName: nodeNameMap.get(nodeId) || "Unknown",
          nodeType: targetType,
          totalAttempted: agg.attempted,
          totalCorrect: agg.correct,
          overallAccuracy: Number(((agg.correct / agg.attempted) * 100).toFixed(2)),
          studentCount: agg.students.size
        });
      }
    }
    
    // Sort by lowest accuracy first (weakest)
    return result.sort((a, b) => a.overallAccuracy - b.overallAccuracy);
  };

  const instituteWeakestSubjects = aggregate(subData || [], "SUBJECT");
  const instituteWeakestChapters = aggregate(chapData || [], "CHAPTER");
  const instituteWeakestConcepts = aggregate(conData || [], "CONCEPT");

  // Batch vs Subject aggregation
  const batchSubMap = new Map<string, { attempted: number; correct: number; students: Set<string> }>();
  if (subData) {
    subData.forEach(r => {
      const batchId = studentBatchMap.get(r.student_id);
      if (batchId) {
        const key = `${batchId}_${r.syllabus_node_id}`;
        if (!batchSubMap.has(key)) {
          batchSubMap.set(key, { attempted: 0, correct: 0, students: new Set() });
        }
        const agg = batchSubMap.get(key)!;
        agg.attempted += r.total_attempted;
        agg.correct += r.total_correct;
        agg.students.add(r.student_id);
      }
    });
  }

  const batchSubjectInsights: BatchAcademicInsight[] = [];
  for (const [key, agg] of batchSubMap.entries()) {
    const [batchId, nodeId] = key.split("_");
    if (agg.attempted > 0) {
      batchSubjectInsights.push({
        batchId,
        batchName: batchNameMap.get(batchId) || "Unknown Batch",
        nodeId,
        nodeName: nodeNameMap.get(nodeId) || "Unknown Subject",
        nodeType: "SUBJECT",
        totalAttempted: agg.attempted,
        totalCorrect: agg.correct,
        overallAccuracy: Number(((agg.correct / agg.attempted) * 100).toFixed(2)),
        studentCount: agg.students.size
      });
    }
  }
  
  batchSubjectInsights.sort((a, b) => a.overallAccuracy - b.overallAccuracy);

  return {
    instituteWeakestSubjects,
    instituteWeakestChapters,
    instituteWeakestConcepts,
    batchSubjectInsights
  };
}
