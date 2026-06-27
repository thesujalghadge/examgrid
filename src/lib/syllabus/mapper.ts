import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Basic Jaccard index for strings (using bigrams)
function stringSimilarity(s1: string, s2: string): number {
  const norm1 = normalize(s1);
  const norm2 = normalize(s2);
  
  if (norm1 === norm2) return 1.0;
  if (norm1.length < 2 || norm2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(norm1);
  const bg2 = getBigrams(norm2);
  
  let intersection = 0;
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }
  
  const union = bg1.size + bg2.size - intersection;
  return intersection / union;
}

export async function mapQuestionsToSyllabus(instituteId: string, batchId: string) {
  console.log(`[MAPPER] Starting syllabus mapping for batch ${batchId}`);
  
  // 1. Fetch all syllabus nodes for this batch
  const { data: nodes } = await supabase
    .from("batch_syllabus_nodes")
    .select("*")
    .eq("batch_id", batchId);
    
  if (!nodes || nodes.length === 0) {
    console.log(`[MAPPER] No syllabus nodes found for batch ${batchId}. Aborting.`);
    return;
  }

  // Build lookup maps
  const subjects = nodes.filter(n => n.node_type === "SUBJECT");
  const chapters = nodes.filter(n => n.node_type === "CHAPTER");
  const topics = nodes.filter(n => n.node_type === "TOPIC");
  const subtopics = nodes.filter(n => n.node_type === "SUBTOPIC");

  // 2. Fetch mapping rules
  const { data: rules } = await supabase
    .from("syllabus_mapping_rules")
    .select("*")
    .eq("batch_id", batchId);

  // 3. Find questions to map. 
  // We need all questions that are assigned to this batch.
  // Tests assigned to this batch:
  const { data: testSchedules } = await supabase
    .from("exam_schedule_batches")
    .select("schedule_id, exam_schedules(exam_id)")
    .eq("batch_id", batchId);
    
  if (!testSchedules || testSchedules.length === 0) {
    console.log(`[MAPPER] No tests scheduled for batch ${batchId}.`);
    return;
  }

  const examIds = testSchedules.map(ts => (ts.exam_schedules as any).exam_id);

  // Fetch questions for these exams
  const { data: examQuestions } = await supabase
    .from("exam_questions")
    .select("id")
    .in("exam_id", examIds);

  if (!examQuestions || examQuestions.length === 0) {
    return;
  }

  const questionIds = examQuestions.map(eq => eq.id);

  // Fetch AI solutions for these questions
  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("question_id, subject, chapter, subchapter, ai_metadata")
    .in("question_id", questionIds)
    .eq("is_active", true);

  if (!solutions || solutions.length === 0) {
    return;
  }

  const mappingsToUpsert = [];

  for (const sol of solutions) {
    const aiSubject = sol.subject || (sol.ai_metadata as any)?.subject || "";
    const aiChapter = sol.chapter || (sol.ai_metadata as any)?.chapter || "";
    const aiTopic = sol.subchapter || (sol.ai_metadata as any)?.topic || (sol.ai_metadata as any)?.subtopic || "";

    if (!aiSubject && !aiChapter) continue;

    // Check Rules first
    const matchingRule = rules?.find(r => 
       normalize(r.ai_subject) === normalize(aiSubject) &&
       normalize(r.ai_chapter) === normalize(aiChapter) &&
       normalize(r.ai_topic || "") === normalize(aiTopic)
    );

    if (matchingRule) {
      mappingsToUpsert.push({
        institute_id: instituteId,
        batch_id: batchId,
        question_id: sol.question_id,
        syllabus_subject_id: matchingRule.target_syllabus_subject_id,
        syllabus_chapter_id: matchingRule.target_syllabus_chapter_id,
        syllabus_topic_id: matchingRule.target_syllabus_topic_id,
        mapping_confidence: 100,
        mapping_method: "MANUAL_CORRECTION",
        is_unmapped: false
      });
      continue;
    }

    // Fuzzy matching
    let bestSubject = null;
    let maxSubjScore = 0;
    for (const subj of subjects) {
      const score = stringSimilarity(aiSubject, subj.name);
      if (score > maxSubjScore) {
        maxSubjScore = score;
        bestSubject = subj;
      }
    }

    let bestChapter = null;
    let maxChapScore = 0;
    if (bestSubject) {
      const possibleChapters = chapters.filter(c => c.parent_id === bestSubject.id);
      for (const chap of possibleChapters) {
        const score = stringSimilarity(aiChapter, chap.name);
        if (score > maxChapScore) {
          maxChapScore = score;
          bestChapter = chap;
        }
      }
    }

    let bestTopic = null;
    let maxTopicScore = 0;
    if (bestChapter && aiTopic) {
      const possibleTopics = topics.filter(t => t.parent_id === bestChapter.id);
      for (const topic of possibleTopics) {
        const score = stringSimilarity(aiTopic, topic.name);
        if (score > maxTopicScore) {
          maxTopicScore = score;
          bestTopic = topic;
        }
      }
    }

    // Confidence heuristic
    let confidence = 0;
    if (maxSubjScore > 0.8 && maxChapScore > 0.8) {
       confidence = ((maxSubjScore + maxChapScore) / 2) * 100;
       if (aiTopic && bestTopic) {
         confidence = ((maxSubjScore + maxChapScore + maxTopicScore) / 3) * 100;
       }
    }

    const isUnmapped = confidence < 80;

    mappingsToUpsert.push({
      institute_id: instituteId,
      batch_id: batchId,
      question_id: sol.question_id,
      syllabus_subject_id: bestSubject?.id || null,
      syllabus_chapter_id: bestChapter?.id || null,
      syllabus_topic_id: bestTopic?.id || null,
      mapping_confidence: Math.round(confidence * 100) / 100,
      mapping_method: "AI_FUZZY",
      is_unmapped: isUnmapped
    });
  }

  if (mappingsToUpsert.length > 0) {
    console.log(`[MAPPER] Upserting ${mappingsToUpsert.length} mappings for batch ${batchId}`);
    
    // Chunking to avoid large payload
    const chunkSize = 500;
    for (let i = 0; i < mappingsToUpsert.length; i += chunkSize) {
      const chunk = mappingsToUpsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("question_syllabus_mappings")
        .upsert(chunk, { onConflict: "batch_id,question_id" });
        
      if (error) {
        console.error(`[MAPPER] Error upserting mappings:`, error.message);
      }
    }
  }

  console.log(`[MAPPER] Finished syllabus mapping for batch ${batchId}`);
}
