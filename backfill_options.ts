import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);


async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  const { data: qData } = await s.from('exam_questions').select('id, question_number, question_type, published_image_url, published_options').eq('exam_id', examId);
  
  const repos = require('./src/lib/repositories/provider').getRepositories();
  const inst = repos.institutes.getById('ddcc7407-fbb6-42bd-9751-576ef43e2241');
  const apiKey = inst?.aiSettings?.geminiApiKey;
  if (!apiKey) throw new Error("No API key");
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });

  if (!qData) {
    console.log('No questions found.');
    return;
  }
  
  console.log('Backfilling options for ' + qData.length + ' questions...');

  for (const q of qData) {
    if (q.question_type !== 'MCQ_SINGLE') continue;

    let imgPath = q.published_image_url;
    if (!imgPath && q.published_options) {
      const meta = q.published_options.find((o: any) => o.id === '__metadata__' || o.label === '__metadata__');
      if (meta && meta.text) {
         try {
            imgPath = JSON.parse(meta.text).stemImage;
         } catch(e) {}
      }
    }
    if (!imgPath) continue;

    const absPath = path.join(process.cwd(), 'public', imgPath);
    if (!fs.existsSync(absPath)) continue;

    const base64 = fs.readFileSync(absPath).toString('base64');

    const prompt = `Extract the four options from this multiple-choice question image. 
Return JSON exactly like this:
{
  "A": "text of option A",
  "B": "text of option B",
  "C": "text of option C",
  "D": "text of option D"
}
Do not include the labels (A), (B), etc. in the value text.`;

    const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: 'image/jpeg' } }]);
    const jsonStr = result.response.text();
    const opts = JSON.parse(jsonStr);

    const dbOptions = [
      { id: 'opt_A', label: 'A', text: opts.A },
      { id: 'opt_B', label: 'B', text: opts.B },
      { id: 'opt_C', label: 'C', text: opts.C },
      { id: 'opt_D', label: 'D', text: opts.D }
    ];

    await s.from('exam_questions').update({ options: dbOptions, published_options: dbOptions }).eq('id', q.id);
    console.log(`Updated Q${q.question_number} options.`);
  }
}
run();
