import { SupabaseClient } from "@supabase/supabase-js";
import { DemoConfig } from "./types";
import { DeterministicRNG } from "./rng";
import { enqueueQuestionsForGeneration, leaseJob } from "../../src/lib/solutions/queue";
import { processLeasedJob } from "../../src/lib/solutions/solution-generator";
import { evaluateTestSession } from "../../src/services/test-evaluation";
import { runAnalyticsWorker } from "../../src/lib/analytics/worker";
import { encryptApiKey } from "../../src/lib/crypto/api-key-encryption";
import { setInstituteGeminiKey } from "../../src/lib/institute/get-institute-api-key";

const TEST_STRUCTURE = [
  {
    title: "JEE Main Mock 1",
    sections: {
      physics: { topics: ["Laws of Motion", "Surface Tension"] },
      chemistry: { topics: ["Atomic Model", "d block elements"] },
      maths: { topics: ["Trigonometry", "Probability"] }
    }
  },
  {
    title: "JEE Main Mock 2",
    sections: {
      physics: { topics: ["Angular Momentum", "Ohm's Law"] },
      chemistry: { topics: ["f block elements", "Hydrocarbons"] },
      maths: { topics: ["Limits", "Differentiation"] }
    }
  },
  {
    title: "JEE Main Mock 3",
    sections: {
      physics: { topics: ["Laws of Motion", "Ohm's Law"] },
      chemistry: { topics: ["d block elements", "Hydrocarbons"] },
      maths: { topics: ["Probability", "Differentiation"] }
    }
  }
];

// Target accuracies mapped to persona traits
const PERSONA_ACCURACY = {
  "Topper": 0.90,
  "Above Average": 0.75,
  "Average": 0.50,
  "Below Average": 0.30,
  "Lowest Scoring": 0.15
};

export class DemoGenerator {
  private supabase: SupabaseClient;
  private config: DemoConfig;
  private rng: DeterministicRNG;
  
  private instituteId!: string;
  private batchMap = new Map<string, string>();
  private students: any[] = [];
  private exams: any[] = [];
  private examQuestions: any[] = [];
  private bankQuestions: any[] = [];

  constructor(supabase: SupabaseClient, config: DemoConfig) {
    this.supabase = supabase;
    this.config = config;
    this.rng = new DeterministicRNG(config.seed);
  }

  public async generate() {
    console.log(`🚀 Starting Demo Factory E2E Generation for ${this.config.institute.name}...`);
    
    console.log("🧹 Resetting environment...");
    const { error: resetErr } = await this.supabase.rpc('reset_demo_data');
    if (resetErr) {
      console.warn("⚠️ Warning: reset_demo_data failed or not found, attempting manual cleanup...");
    }
    
    // Fallback/additive cleanup
    await this.supabase.from('exam_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('audit_logs').delete().neq('id', '0');

    await this.setupInstitute();
    await this.setupBatches();
    await this.setupStudents();
    await this.setupExams();
    await this.setupQuestions();
    await this.setupAttemptsAndEvaluate();
    await this.triggerSolutionPipeline();
    await this.triggerAnalyticsPipeline();
    await this.setupAuditLogs();

    console.log(`✅ Demo Factory E2E Generation Complete for ${this.config.institute.name}!`);
  }

  private async setupInstitute() {
    const configName = this.config.institute.name;
    const adminEmail = `admin${this.config.institute.domain}`;

    let { data: institute, error } = await this.supabase
      .from('institutes')
      .select('id')
      .eq('name', configName)
      .maybeSingle();
      
    if (error) {
      throw new Error(`❌ Error checking institute: ${error.message}`);
    }

    if (!institute) {
      console.log(`🏫 Institute "${configName}" not found. Creating it...`);
      const id = this.rng.nextUUID();
      const slug = configName.toLowerCase().replace(/ /g, '-');
      const { data: newInst, error: insertErr } = await this.supabase
        .from('institutes')
        .insert({
          id,
          name: configName,
          slug: `${slug}-${id.split('-')[0]}`,
          contact_email: adminEmail,
          is_active: true
        })
        .select('id')
        .single();
        
      if (insertErr || !newInst) {
        throw new Error(`❌ Failed to create institute: ${insertErr?.message}`);
      }
      institute = newInst;
    }
    this.instituteId = institute.id;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
       const { encrypted, iv } = await encryptApiKey(geminiKey);
       await setInstituteGeminiKey(this.instituteId, encrypted, iv);
    }
  }

  private async setupBatches() {
    console.log("🏫 Generating batches...");
    const batchesData = this.config.batches.map(b => ({
      id: this.rng.nextUUID(),
      institute_id: this.instituteId,
      name: b.name,
      course_type: "JEE",
      academic_year: "2026-2027",
      is_active: true
    }));

    const { error } = await this.supabase.from('batches').upsert(batchesData, { onConflict: 'institute_id, name, academic_year' });
    if (error) throw new Error(`Failed to upsert batches: ${error.message}`);
    
    const { data } = await this.supabase.from('batches').select('id, name').eq('institute_id', this.instituteId);
    data?.forEach(b => this.batchMap.set(b.name, b.id));
    console.log(`✅ ${batchesData.length} Batches generated.`);
  }

  private async setupStudents() {
    console.log("👨‍🎓 Generating distinct students...");
    let studentCounter = 1;

    for (const profile of this.config.personas) {
      if (profile.batch === "ADMIN" || profile.batch === "TEACHER") continue;

      const student = {
        id: this.rng.nextUUID(),
        institute_id: this.instituteId,
        name: profile.name,
        full_name: profile.name,
        application_number: `APP26-${String(studentCounter).padStart(5, '0')}`,
        email: profile.email,
        roll_number: `DEMO-${String(studentCounter).padStart(3, '0')}`,
        phone: `99999${String(studentCounter).padStart(5, '0')}`,
        batch_id: this.batchMap.get(profile.batch) || null,
        traits: profile.traits
      };
      this.students.push(student);
      studentCounter++;
    }

    const { error } = await this.supabase.from('students').upsert(
      this.students.map(({ traits, ...rest }) => rest), // Omit traits for DB insert
      { onConflict: 'institute_id, roll_number' }
    );
    if (error) throw new Error(`Failed to upsert students: ${error.message}`);
    console.log(`✅ ${this.students.length} Students generated.`);
  }

  private async setupExams() {
    console.log("📝 Generating exams and schedules...");
    this.exams = this.config.exams.map(e => ({
      id: this.rng.nextUUID(),
      institute_id: this.instituteId,
      title: e.title,
      exam_type: "JEE_MAIN",
      duration_minutes: 180,
      total_questions: 15,
      scheduled_at: e.date,
      is_published: true
    }));

    const { error } = await this.supabase.from('exams').upsert(this.exams, { onConflict: 'id' });
    if (error) throw new Error(`Failed to upsert exams: ${error.message}`);
    
    const schedules = [];
    const scheduleBatches = [];

    for (const exam of this.exams) {
      const scheduleId = this.rng.nextUUID();
      schedules.push({
        id: scheduleId,
        institute_id: this.instituteId,
        exam_id: exam.id,
        start_at: new Date(new Date(exam.scheduled_at).getTime() - 1000 * 60 * 60 * 24).toISOString(),
        end_at: new Date(new Date(exam.scheduled_at).getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        duration_minutes: exam.duration_minutes,
        visibility_rule: 'assigned_batches',
        is_active: true
      });
      
      for (const batchId of Array.from(this.batchMap.values())) {
        scheduleBatches.push({
          schedule_id: scheduleId,
          batch_id: batchId,
          institute_id: this.instituteId
        });
      }
    }

    const { error: sErr } = await this.supabase.from('exam_schedules').upsert(schedules, { onConflict: 'id' });
    if (sErr) throw new Error(`Failed to upsert schedules: ${sErr.message}`);
    
    const { error: sbErr } = await this.supabase.from('exam_schedule_batches').upsert(scheduleBatches, { onConflict: 'schedule_id, batch_id' });
    if (sbErr) throw new Error(`Failed to upsert schedule batches: ${sbErr.message}`);

    console.log(`✅ ${this.exams.length} Exams generated with schedules.`);
  }

  private async setupQuestions() {
    console.log("❓ Generating E2E pipeline questions...");
    
    const sections = [];
    for (const exam of this.exams) {
      sections.push(
        { id: "physics", exam_id: exam.id, institute_id: this.instituteId, name: "Physics", sort_order: 1 },
        { id: "chemistry", exam_id: exam.id, institute_id: this.instituteId, name: "Chemistry", sort_order: 2 },
        { id: "maths", exam_id: exam.id, institute_id: this.instituteId, name: "Mathematics", sort_order: 3 }
      );
    }
    const { error: secErr } = await this.supabase.from('exam_sections').upsert(sections, { onConflict: 'exam_id, id' });
    if (secErr) throw new Error(`Failed to upsert sections: ${secErr.message}`);

    const dbQuestions = [];
    const dbQuestionContent = [];
    const dbExamQuestions = [];
    
    for (const exam of this.exams) {
      const structureConfig = TEST_STRUCTURE.find(t => t.title === exam.title);
      if (!structureConfig) continue;

      let questionNumber = 1;
      
      for (const sectionId of ["maths", "physics", "chemistry"]) {
        const topics = structureConfig.sections[sectionId as keyof typeof structureConfig.sections].topics;
        
        for (let i = 0; i < 5; i++) {
          const isNAT = i === 4;
          const topic = topics[i % topics.length];
          const bankQId = this.rng.nextUUID();
          const examQId = this.rng.nextUUID();
          
          let questionText = `A student solves a ${topic} problem. What is the key outcome?`;
          let correctAns = "A";
          if (isNAT) {
            questionText = `Calculate the value for this ${topic} problem. (Round to nearest integer)`;
            correctAns = "42";
          }

          const qType = isNAT ? "NUMERICAL" : "MCQ_SINGLE";

          // Bank Question
          dbQuestions.push({
            id: bankQId,
            institute_id: this.instituteId,
            subject: sectionId === "maths" ? "Mathematics" : (sectionId === "physics" ? "Physics" : "Chemistry"),
            chapter: topic,
            topic: topic,
            difficulty: "medium",
            question_type: qType,
            question_text: questionText,
            options: isNAT ? [] : [{ id: "A", text: "Option A" }, { id: "B", text: "Option B" }, { id: "C", text: "Option C" }, { id: "D", text: "Option D" }],
            correct_answer: correctAns,
            marks: 4,
            negative_marks: isNAT ? 0 : 1
          });

          // Bank Question Content (Needed for AI Solutions & Analytics extraction)
          dbQuestionContent.push({
            question_id: bankQId,
            institute_id: this.instituteId,
            raw_text: questionText,
            correct_answer: correctAns,
            extracted_subject: sectionId === "maths" ? "Mathematics" : (sectionId === "physics" ? "Physics" : "Chemistry"),
            extracted_chapter: topic
          });

          // Exam Question
          dbExamQuestions.push({
            id: examQId,
            exam_id: exam.id,
            institute_id: this.instituteId,
            section_id: sectionId,
            question_type: qType,
            question_text: questionText,
            options: isNAT ? [] : [{ id: "A", text: "Option A" }, { id: "B", text: "Option B" }, { id: "C", text: "Option C" }, { id: "D", text: "Option D" }],
            marks: 4,
            negative_marks: isNAT ? 0 : 1,
            correct_option_id: isNAT ? null : correctAns,
            correct_numerical_answer: isNAT ? correctAns : null,
            question_number: questionNumber,
            sort_order: questionNumber,
            bank_question_id: bankQId,
            published_at: new Date().toISOString(),
            published_question_text: questionText,
            published_answer_key: correctAns,
            published_image_url: "https://via.placeholder.com/600x400?text=Demo+Question",
            published_options: isNAT ? [] : [{ id: "A", text: "Option A" }, { id: "B", text: "Option B" }, { id: "C", text: "Option C" }, { id: "D", text: "Option D" }]
          });

          this.examQuestions.push({ exam_id: exam.id, question_id: examQId, bank_id: bankQId, isNAT, topic, sectionId, correct_answer: correctAns });
          this.bankQuestions.push({ id: bankQId });
          questionNumber++;
        }
      }
    }

    const { error: qErr1 } = await this.supabase.from('questions').upsert(dbQuestions, { onConflict: 'id' });
    if (qErr1) throw new Error(`Failed to upsert questions: ${qErr1.message}`);

    const { error: qErr2 } = await this.supabase.from('question_content').upsert(dbQuestionContent, { onConflict: 'question_id' });
    if (qErr2) throw new Error(`Failed to upsert question_content: ${qErr2.message}`);

    const { error: qErr3 } = await this.supabase.from('exam_questions').upsert(dbExamQuestions, { onConflict: 'id' });
    if (qErr3) throw new Error(`Failed to upsert exam_questions: ${qErr3.message}`);

    console.log(`✅ ${dbExamQuestions.length} E2E Questions mapped & generated.`);
  }

  private async setupAttemptsAndEvaluate() {
    console.log("✍️ Simulating responses and triggering Test Evaluation Pipeline...");
    const analyticsJobs = [];
    
    for (const exam of this.exams) {
      const examConfig = this.config.exams.find(e => e.title === exam.title);
      const trapAnomaly = examConfig?.anomalies.find(a => a.type === "TRAP_QUESTION") as any;
      const questionsForExam = this.examQuestions.filter(q => q.exam_id === exam.id);
      
      for (const student of this.students) {
        const attemptId = this.rng.nextUUID();
        const answers: Record<string, string> = {};
        let attemptQuestionsCount = 0;
        
        // Find persona target accuracy
        let targetAccuracy = 0.50; 
        for (const trait of student.traits) {
          if (PERSONA_ACCURACY[trait as keyof typeof PERSONA_ACCURACY] !== undefined) {
            targetAccuracy = PERSONA_ACCURACY[trait as keyof typeof PERSONA_ACCURACY];
            break;
          }
        }
        
        for (let i = 0; i < questionsForExam.length; i++) {
          const q = questionsForExam[i];
          const isTrap = trapAnomaly && i === trapAnomaly.questionIndex - 1;
          
          let selectedOption = null;

          if (isTrap) {
             // For a trap question, Toppers/Above Average might avoid it, but Average/Below Average fall for it
             const fallsForTrap = this.rng.next() > (targetAccuracy + 0.1); // Low accuracy = High trap chance
             if (fallsForTrap) {
               selectedOption = trapAnomaly.wrongOption;
             } else {
               selectedOption = q.correct_answer;
             }
          } else {
             const isCorrect = this.rng.next() < targetAccuracy;
             if (isCorrect) {
               selectedOption = q.correct_answer;
             } else {
               if (q.isNAT) {
                 selectedOption = "999"; // Wrong NAT
               } else {
                 // Pick a random wrong option
                 const wrongOpts = ["A", "B", "C", "D"].filter(opt => opt !== q.correct_answer);
                 selectedOption = wrongOpts[Math.floor(this.rng.next() * wrongOpts.length)];
               }
             }
          }
          
          answers[q.question_id] = selectedOption;
          attemptQuestionsCount++;
        }

        const startedAt = new Date(new Date(exam.scheduled_at).getTime() - 1000 * 60 * 5).toISOString();
        const submittedAt = new Date(new Date(exam.scheduled_at).getTime() + 1000 * 60 * 175).toISOString();

        // 1. Insert the raw attempt
        const { error: attErr } = await this.supabase.from('cbt_attempts').upsert({
          id: attemptId,
          institute_id: this.instituteId,
          test_id: exam.id,
          student_id: student.id,
          student_roll_number: student.roll_number,
          session_id: this.rng.nextUUID(),
          status: "submitted", // Need to be submitted to trigger evaluateTestSession naturally
          answers: answers,
          started_at: startedAt,
          submitted_at: submittedAt,
          total_questions: 15,
          attempted_questions: attemptQuestionsCount
        }, { onConflict: 'id' });
        
        if (attErr) throw new Error(`Failed to insert attempt: ${attErr.message}`);

        // 2. Insert raw attempt_answers
        const attemptAnswers = Object.entries(answers).map(([qId, ans]) => ({
            id: this.rng.nextUUID(),
            attempt_id: attemptId,
            question_id: qId,
            selected_answer: ans,
            is_correct: false, // Evaluation pipeline will update this!
            marks_awarded: 0   // Evaluation pipeline will update this!
        }));
        
        const { error: ansErr } = await this.supabase.from('cbt_attempt_answers').upsert(attemptAnswers, { onConflict: 'id' });
        if (ansErr) throw new Error(`Failed to insert attempt answers: ${ansErr.message}`);

        // 3. TRIGGER EVALUATION PIPELINE
        const answerKey: Record<string, any> = {};
        for (const q of questionsForExam) {
           answerKey[q.question_id] = {
             type: q.isNAT ? "NUMERICAL" : "MCQ_SINGLE",
             correctOptionId: q.isNAT ? null : q.correct_answer,
             correctNumericalAnswer: q.isNAT ? q.correct_answer : null,
             marks: 4,
             negativeMarks: q.isNAT ? 0 : 1
           };
        }

        const breakdown = evaluateTestSession({
          sessionId: attemptId,
          answers: answers,
          answerKey: answerKey,
          startedAt: new Date(startedAt).getTime(),
          submittedAt: new Date(submittedAt).getTime()
        });

        // Update attempt with real breakdown
        await this.supabase.from('cbt_attempts').update({
          score: breakdown.finalScore,
          accuracy: breakdown.attempted > 0 ? (breakdown.correct / breakdown.attempted) * 100 : 0,
          result_breakdown: breakdown
        }).eq('id', attemptId);

        // Update attempt_answers with correct status and marks
        const finalAnswersToUpsert = breakdown.perQuestion.map(pq => {
           // find original UUID
           const orig = attemptAnswers.find(a => a.question_id === pq.questionId);
           return {
             id: orig?.id || this.rng.nextUUID(),
             attempt_id: attemptId,
             question_id: pq.questionId,
             selected_answer: pq.selected,
             is_correct: pq.correct,
             marks_awarded: pq.marksAwarded
           };
        });
        await this.supabase.from('cbt_attempt_answers').upsert(finalAnswersToUpsert, { onConflict: 'id' });

        if (student.batch_id) {
          analyticsJobs.push({
            id: this.rng.nextUUID(),
            attempt_id: attemptId,
            student_id: student.id,
            exam_id: exam.id,
            batch_id: student.batch_id,
            status: "PENDING"
          });
        }
      }
    }

    const { error: ajErr } = await this.supabase.from('analytics_jobs').upsert(analyticsJobs, { onConflict: 'id' });
    if (ajErr) throw new Error(`Failed to upsert analytics_jobs: ${ajErr.message}`);

    console.log(`✅ ${this.students.length * this.exams.length} E2E Exam Attempts fully evaluated.`);
  }

  private async triggerSolutionPipeline() {
    console.log("🤖 Triggering AI Solution Pipeline...");
    
    // 1. Enqueue all questions
    const questionIds = this.examQuestions.map(q => q.question_id);
    const enqueueResult = await enqueueQuestionsForGeneration(questionIds, this.instituteId, 100);
    console.log(`- Enqueued ${enqueueResult.enqueued} questions for AI resolution.`);

    // 2. Programmatically pump the queue to simulate the background worker
    let processed = 0;
    while (true) {
      const leased = await leaseJob();
      if (!leased) break; // Queue empty
      
      try {
        await processLeasedJob(leased);
        processed++;
        if (processed % 5 === 0) {
           console.log(`- Processed ${processed} solutions...`);
        }
      } catch (err: any) {
        console.error(`- Failed to process job ${leased.id}: ${err.message}`);
      }
    }

    console.log(`✅ Complete! ${processed} real AI solutions generated via Pipeline.`);
  }

  private async triggerAnalyticsPipeline() {
    console.log("📊 Triggering Analytics Pipeline...");
    const limit = 50;
    try {
      await runAnalyticsWorker(limit);
      console.log(`✅ Analytics processed.`);
    } catch (err: any) {
       console.error(`❌ Analytics failed: ${err.message}`);
    }
  }

  private async setupAuditLogs() {
    console.log("📢 Generating Institute Timeline Events...");
    const logs = [
      {
        event_id: this.rng.nextUUID(),
        institute_id: this.instituteId,
        action_type: 'INSTITUTE_ANNOUNCEMENT',
        resource_type: 'institute',
        resource_id: this.instituteId,
        actor_role: 'admin',
        actor_id: this.rng.nextUUID(),
        session_id: this.rng.nextUUID(),
        source: 'demo-factory',
        outcome: 'success',
        timestamp_utc: '2026-05-28T10:00:00Z',
        metadata: { message: "Welcome to Apex Academy! Let's rock JEE Main." }
      }
    ];

    const { error } = await this.supabase.from('audit_logs').upsert(logs as any, { onConflict: 'event_id' });
    if (error) throw new Error(`Failed to insert audit logs: ${error.message}`);
  }
}
