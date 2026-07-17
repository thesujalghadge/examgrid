import { SupabaseClient } from "@supabase/supabase-js";

export interface InstituteOverviewDTO {
  totalTests: number;
  totalStudents: number;
  totalBatches: number;
  averageScore: number;
  averagePercentage: number;
  averageAccuracy: number;
}

export interface BatchOverviewDTO {
  batchId: string;
  batchName: string;
  studentsCount: number;
  testsConducted: number;
  averageScore: number;
  averagePercentage: number;
  averageAccuracy: number;
}

export interface TestOverviewDTO {
  testId: string;
  testTitle: string;
  participantsCount: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  averageAccuracy: number;
}

export interface StudentOverviewDTO {
  studentId: string;
  studentName: string;
  batchName: string;
  latestTestId: string;
  latestTestTitle: string;
  latestScore: number;
  latestPercentage: number;
  latestRank: number;
}

export async function fetchInstituteOverview(
  client: SupabaseClient,
  instituteId: string
): Promise<InstituteOverviewDTO> {
  const [
    { count: totalTests },
    { count: totalStudents },
    { count: totalBatches },
    { data: attemptsData }
  ] = await Promise.all([
    client.from("exams").select("*", { count: "exact", head: true }).eq("institute_id", instituteId).eq("is_published", true),
    client.from("students").select("*", { count: "exact", head: true }).eq("institute_id", instituteId).eq("is_active", true),
    client.from("batches").select("*", { count: "exact", head: true }).eq("institute_id", instituteId).eq("is_active", true),
    client.from("cbt_attempts")
      .select(`
        id,
        cbt_results!inner ( score, percentage, accuracy )
      `)
      .eq("institute_id", instituteId)
      .eq("status", "submitted")
  ]);

  let totalScore = 0;
  let totalPct = 0;
  let totalAcc = 0;
  const numAttempts = attemptsData?.length || 0;

  if (attemptsData && numAttempts > 0) {
    for (const a of attemptsData) {
      const res: any = Array.isArray(a.cbt_results) ? a.cbt_results[0] : a.cbt_results;
      if (res) {
        totalScore += res.score || 0;
        totalPct += res.percentage || 0;
        totalAcc += res.accuracy || 0;
      }
    }
  }

  return {
    totalTests: totalTests || 0,
    totalStudents: totalStudents || 0,
    totalBatches: totalBatches || 0,
    averageScore: numAttempts > 0 ? Number((totalScore / numAttempts).toFixed(2)) : 0,
    averagePercentage: numAttempts > 0 ? Number((totalPct / numAttempts).toFixed(2)) : 0,
    averageAccuracy: numAttempts > 0 ? Number((totalAcc / numAttempts).toFixed(2)) : 0,
  };
}

export async function fetchBatchOverview(
  client: SupabaseClient,
  instituteId: string
): Promise<BatchOverviewDTO[]> {
  const [
    { data: batches },
    { data: students },
    { data: attempts }
  ] = await Promise.all([
    client.from("batches").select("id, name").eq("institute_id", instituteId).eq("is_active", true),
    client.from("students").select("id, batch_id").eq("institute_id", instituteId).eq("is_active", true),
    client.from("cbt_attempts")
      .select(`
        id, student_id, test_id,
        cbt_results!inner ( score, percentage, accuracy )
      `)
      .eq("institute_id", instituteId)
      .eq("status", "submitted")
  ]);

  if (!batches) return [];

  const studentBatchMap = new Map<string, string>();
  if (students) {
    for (const s of students) {
      if (s.batch_id) studentBatchMap.set(s.id, s.batch_id);
    }
  }

  const batchMap = new Map<string, {
    batchName: string;
    studentsCount: number;
    tests: Set<string>;
    totalScore: number;
    totalPercentage: number;
    totalAccuracy: number;
    attemptCount: number;
  }>();

  for (const b of batches) {
    batchMap.set(b.id, {
      batchName: b.name,
      studentsCount: 0,
      tests: new Set(),
      totalScore: 0,
      totalPercentage: 0,
      totalAccuracy: 0,
      attemptCount: 0
    });
  }

  if (students) {
    for (const s of students) {
      if (s.batch_id && batchMap.has(s.batch_id)) {
        batchMap.get(s.batch_id)!.studentsCount += 1;
      }
    }
  }

  if (attempts) {
    for (const a of attempts) {
      const batchId = studentBatchMap.get(a.student_id);
      if (batchId && batchMap.has(batchId)) {
        const b = batchMap.get(batchId)!;
        b.tests.add(a.test_id);
        const res: any = Array.isArray(a.cbt_results) ? a.cbt_results[0] : a.cbt_results;
        if (res) {
          b.totalScore += res.score || 0;
          b.totalPercentage += res.percentage || 0;
          b.totalAccuracy += res.accuracy || 0;
          b.attemptCount += 1;
        }
      }
    }
  }

  const result: BatchOverviewDTO[] = [];
  for (const [id, data] of batchMap.entries()) {
    result.push({
      batchId: id,
      batchName: data.batchName,
      studentsCount: data.studentsCount,
      testsConducted: data.tests.size,
      averageScore: data.attemptCount > 0 ? Number((data.totalScore / data.attemptCount).toFixed(2)) : 0,
      averagePercentage: data.attemptCount > 0 ? Number((data.totalPercentage / data.attemptCount).toFixed(2)) : 0,
      averageAccuracy: data.attemptCount > 0 ? Number((data.totalAccuracy / data.attemptCount).toFixed(2)) : 0,
    });
  }

  // Best performing batches first
  return result.sort((a, b) => b.averageAccuracy - a.averageAccuracy);
}

export async function fetchTestOverview(
  client: SupabaseClient,
  instituteId: string
): Promise<TestOverviewDTO[]> {
  const [
    { data: exams },
    { data: attempts }
  ] = await Promise.all([
    client.from("exams").select("id, title").eq("institute_id", instituteId).eq("is_published", true),
    client.from("cbt_attempts")
      .select(`
        id, test_id,
        cbt_results!inner ( score, percentage, accuracy )
      `)
      .eq("institute_id", instituteId)
      .eq("status", "submitted")
  ]);

  if (!exams) return [];

  const testMap = new Map<string, {
    testTitle: string;
    participantsCount: number;
    totalScore: number;
    totalPercentage: number;
    totalAccuracy: number;
    highestScore: number;
    lowestScore: number;
  }>();

  for (const e of exams) {
    testMap.set(e.id, {
      testTitle: e.title,
      participantsCount: 0,
      totalScore: 0,
      totalPercentage: 0,
      totalAccuracy: 0,
      highestScore: -Infinity,
      lowestScore: Infinity,
    });
  }

  if (attempts) {
    for (const a of attempts) {
      if (testMap.has(a.test_id)) {
        const t = testMap.get(a.test_id)!;
        t.participantsCount += 1;
        const res: any = Array.isArray(a.cbt_results) ? a.cbt_results[0] : a.cbt_results;
        if (res) {
          const score = res.score || 0;
          const percentage = res.percentage || 0;
          const accuracy = res.accuracy || 0;
          t.totalScore += score;
          t.totalPercentage += percentage;
          t.totalAccuracy += accuracy;
          if (score > t.highestScore) t.highestScore = score;
          if (score < t.lowestScore) t.lowestScore = score;
        }
      }
    }
  }

  const result: TestOverviewDTO[] = [];
  for (const [id, data] of testMap.entries()) {
    result.push({
      testId: id,
      testTitle: data.testTitle,
      participantsCount: data.participantsCount,
      averageScore: data.participantsCount > 0 ? Number((data.totalScore / data.participantsCount).toFixed(2)) : 0,
      averagePercentage: data.participantsCount > 0 ? Number((data.totalPercentage / data.participantsCount).toFixed(2)) : 0,
      averageAccuracy: data.participantsCount > 0 ? Number((data.totalAccuracy / data.participantsCount).toFixed(2)) : 0,
      highestScore: data.participantsCount > 0 ? data.highestScore : 0,
      lowestScore: data.participantsCount > 0 ? data.lowestScore : 0,
    });
  }

  // Poorly performing tests first (Needs intervention)
  return result.sort((a, b) => a.averageAccuracy - b.averageAccuracy);
}

export async function fetchStudentOverview(
  client: SupabaseClient,
  instituteId: string
): Promise<StudentOverviewDTO[]> {
  const [
    { data: students },
    { data: batches },
    { data: exams },
    { data: attempts }
  ] = await Promise.all([
    client.from("students").select("id, name, batch_id").eq("institute_id", instituteId).eq("is_active", true),
    client.from("batches").select("id, name").eq("institute_id", instituteId),
    client.from("exams").select("id, title").eq("institute_id", instituteId),
    client.from("cbt_attempts")
      .select(`
        id, student_id, test_id, submitted_at,
        cbt_results!inner ( score, percentage, rank )
      `)
      .eq("institute_id", instituteId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false }) // ensure we see latest first
  ]);

  if (!students) return [];

  const batchMap = new Map(batches?.map(b => [b.id, b.name]) || []);
  const examMap = new Map(exams?.map(e => [e.id, e.title]) || []);

  const latestAttemptMap = new Map<string, any>();
  if (attempts) {
    for (const a of attempts) {
      if (!latestAttemptMap.has(a.student_id)) {
        latestAttemptMap.set(a.student_id, a);
      }
    }
  }

  const result: StudentOverviewDTO[] = [];
  for (const s of students) {
    const latest = latestAttemptMap.get(s.id);
    if (latest) {
      const res: any = Array.isArray(latest.cbt_results) ? latest.cbt_results[0] : latest.cbt_results;
      result.push({
        studentId: s.id,
        studentName: s.name,
        batchName: (s.batch_id && batchMap.get(s.batch_id)) || "Unassigned",
        latestTestId: latest.test_id,
        latestTestTitle: examMap.get(latest.test_id) || "Unknown Exam",
        latestScore: res?.score || 0,
        latestPercentage: res?.percentage || 0,
        latestRank: res?.rank || null,
      });
    }
  }

  return result.sort((a, b) => a.studentName.localeCompare(b.studentName));
}
