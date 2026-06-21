import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function generate() {
    const examId = 'be5f852f-fc50-4559-9660-22a461bc80d6';

    const { data: questions } = await supabase.from('exam_questions').select('id, question_number, published_question_text, published_options, published_answer_key').eq('exam_id', examId).order('question_number');
    
    let report = `# Phase 3J - P1 Verification Step 3 (PYQ-1 Benchmark)\n\n`;
    report += `| Q | Teacher Key | Model Derived | Match | Mismatch Reason |\n`;
    report += `|---|---|---|---|---|\n`;

    let total = 0;
    let matchCount = 0;

    for (const q of questions) {
        const { data: sol } = await supabase.from('question_solutions').select('model_answer, mismatch_reason, is_active').eq('question_id', q.id).maybeSingle();
        
        if (!sol) {
            report += `| ${q.question_number} | ${q.published_answer_key} | MISSING | ❌ | Generation Failed |\n`;
            continue;
        }

        total++;
        const match = sol.is_active ? '✅' : '❌';
        if (sol.is_active) matchCount++;
        
        let reason = sol.mismatch_reason || '';
        reason = reason.replace(/\n/g, ' ');

        report += `| ${q.question_number} | ${q.published_answer_key} | ${sol.model_answer} | ${match} | ${reason} |\n`;
    }

    report += `\n**Total Analyzed:** ${total}\n`;
    report += `**Convergence Rate:** ${((matchCount/total)*100).toFixed(1)}% (${matchCount}/${total})\n`;

    fs.writeFileSync('p1_benchmark_report.md', report);
    console.log(`Generated p1_benchmark_report.md`);
}

generate().catch(console.error);
