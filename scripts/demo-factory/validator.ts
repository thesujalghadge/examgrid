import { SupabaseClient } from "@supabase/supabase-js";
import { DemoConfig } from "./types";

export class DemoValidator {
  private supabase: SupabaseClient;
  private config: DemoConfig;
  private instituteId!: string;

  constructor(supabase: SupabaseClient, config: DemoConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  public async validate() {
    console.log(`🔍 Starting Comprehensive Demo Factory Validation for ${this.config.institute.name}...`);
    let passed = true;

    const { data: institute } = await this.supabase.from('institutes').select('id').eq('name', this.config.institute.name).single();
    if (!institute) throw new Error("Institute not found");
    this.instituteId = institute.id;

    const verify = async (name: string, checkFn: () => Promise<boolean>) => {
      try {
        const result = await checkFn();
        if (result) {
          console.log(`✅ [PASS] ${name}`);
        } else {
          console.error(`❌ [FAIL] ${name}`);
          passed = false;
        }
      } catch (err: any) {
        console.error(`❌ [ERROR] ${name}: ${err.message}`);
        passed = false;
      }
    };

    // 1. Student & Batch Distribution
    await verify("Student Distribution (36 Students)", async () => {
      const { count } = await this.supabase.from('students').select('*', { count: 'exact', head: true }).eq('institute_id', this.instituteId);
      return count === 36;
    });

    await verify("Batch Distribution (12 Students per Batch)", async () => {
      const { data } = await this.supabase.from('batches').select('id, name').eq('institute_id', this.instituteId);
      if (!data || data.length !== 3) return false;
      for (const b of data) {
        const { count } = await this.supabase.from('students').select('*', { count: 'exact', head: true }).eq('batch_id', b.id);
        if (count !== 12) return false;
      }
      return true;
    });

    // 2. Personas
    await verify("Demo Personas Exist", async () => {
      const emails = this.config.personas.map(p => p.email);
      const { data } = await this.supabase.from('students').select('email').in('email', emails);
      return data && data.length >= 6; // Admin/Teacher personas were skipped in students, so only 6 students
    });

    // 3. Attendance Events (Absences reflected in attempts)
    await verify("Attendance Events (Mock 1 & 2 have Absentees)", async () => {
      const { data: exams } = await this.supabase.from('exams').select('id, title').eq('institute_id', this.instituteId);
      if (!exams) return false;
      let mock1id = exams.find(e => e.title === "JEE Main Mock 1")?.id;
      let mock2id = exams.find(e => e.title === "JEE Main Mock 2")?.id;
      
      const { count: count1 } = await this.supabase.from('cbt_attempts').select('*', { count: 'exact', head: true }).eq('test_id', mock1id);
      const { count: count2 } = await this.supabase.from('cbt_attempts').select('*', { count: 'exact', head: true }).eq('test_id', mock2id);
      
      return count1 === 34 && count2 === 35; // Mock 1 has 2 absentees (36-2), Mock 2 has 1 (36-1)
    });

    // 4. Institute Timeline (Remarks, Announcements, Exams)
    await verify("Exam Timeline Consistency", async () => {
      const { count } = await this.supabase.from('exams').select('*', { count: 'exact', head: true }).eq('institute_id', this.instituteId);
      return count === 3;
    });

    await verify("Teacher Remarks and Announcements", async () => {
      const { data } = await this.supabase.from('audit_logs').select('action_type').in('action_type', ['INSTITUTE_ANNOUNCEMENT', 'TEACHER_REMARK']);
      return data && data.length >= 2;
    });

    // 5. Trap Question Behaviour
    await verify("Trap Question Behaviour (75% Pick Option C)", async () => {
      // Find Mock 2, then find 14th question, check attempt answers
      const { data: mock2 } = await this.supabase.from('exams').select('id').eq('title', 'JEE Main Mock 2').single();
      if (!mock2) { console.log('Mock 2 not found'); return false; }
      
      const { data: eq } = await this.supabase.from('exam_questions').select('id').eq('exam_id', mock2.id).eq('question_number', 14).single();
      if (!eq) { console.log('Mock 2 Question 14 not found'); return false; }

      const { data: attempts } = await this.supabase.from('cbt_attempts').select('answers').eq('test_id', mock2.id);
      if (!attempts) { console.log('No attempts found'); return false; }

      let optionC = 0;
      attempts.forEach(a => {
        if ((a.answers as any)[eq.id] === "C") optionC++;
      });
      
      const rate = optionC / attempts.length;
      console.log(`Trap question stats: ${optionC} / ${attempts.length} = ${rate}`);
      return rate > 0.60 && rate < 0.90; // ~75%
    });

    // 6. AI Solution State Distribution
    await verify("AI Solution State Distribution (Pending, Regenerated, Failed)", async () => {
      const { data } = await this.supabase.from('solution_generation_queue').select('status, attempts');
      if (!data || data.length === 0) return false;
      
      let completed = 0, pending = 0, failed = 0, regenerated = 0;

      data.forEach(row => {
        if (row.status === 'COMPLETED' && row.attempts === 1) completed++;
        if (row.status === 'COMPLETED' && row.attempts > 1) regenerated++;
        if (row.status === 'PENDING') pending++;
        if (row.status === 'FAILED') failed++;
      });

      // Check if all requested states exist
      return completed > 100 && pending > 0 && regenerated > 0 && failed > 0;
    });

    // 7. Referential Integrity
    await verify("Referential Integrity (No Orphaned Records)", async () => {
      const { count } = await this.supabase.from('cbt_attempts').select('*', { count: 'exact', head: true }).is('student_id', null);
      return count === 0;
    });

    if (passed) {
      console.log("🎉 All Demo Data Blueprint metrics validated successfully!");
    } else {
      console.log("⚠️ Validation completed with errors.");
      process.exit(1);
    }
  }
}
