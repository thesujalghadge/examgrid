import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function sync() {
    // Sync PYQ-3
    const examId = '86722d90-1ed4-4330-b84f-40c81a8ed272';
    const cropsData = JSON.parse(fs.readFileSync('public/uploads/cbt_assets/test_audit_d99738/crops_meta.json', 'utf8'));
    
    // Fetch current questions for PYQ-1
    const { data: questions, error } = await supabase.from('exam_questions').select('id, question_number').eq('exam_id', examId).order('question_number');
    
    if (error) {
        console.error(error);
        return;
    }
    if (!questions || questions.length === 0) {
        console.log("No questions found");
        return;
    }
    
    console.log(`Found ${questions.length} questions in Supabase for PYQ-1.`);
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const crop = cropsData.questions[i]; // assuming ordered 1 to 15
        
        let published_options = [];
        const labels = ["A", "B", "C", "D"];
        for(let j=0; j<labels.length; j++) {
            if (crop.options && crop.options.length > j) {
                published_options.push({ label: labels[j], text: crop.options[j] });
            } else {
                published_options.push({ label: labels[j], text: "" });
            }
        }
        
        if (crop.q_type === "NAT") published_options = [];
        
        await supabase.from('exam_questions').update({
            published_question_text: crop.question_text || "",
            published_options: published_options,
            // we leave published_image_url alone because it already points to the crop
        }).eq('id', q.id);
        
        console.log(`Updated ${q.id} with structured text`);
    }
    
    console.log("Sync complete.");
}

sync().catch(console.error);
