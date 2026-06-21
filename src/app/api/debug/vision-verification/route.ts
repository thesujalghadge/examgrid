import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  try {
    const qid = 'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-8';
    
    // 1. Fetch Question
    const { data: examQuestion } = await supabase.from('exam_questions').select('*').eq('id', qid).single();
    
    // 2. Resolve Image Path
    let storagePath = examQuestion.published_image_url;
    if (!storagePath && examQuestion.published_options) {
      const metaOption = examQuestion.published_options.find((o: any) => o.label === "__metadata__");
      if (metaOption && metaOption.text) {
        try {
          const metaJson = JSON.parse(metaOption.text);
          if (metaJson.stemImage) storagePath = metaJson.stemImage;
        } catch(e) {}
      }
    }

    // 3. Load Bytes
    let fileBuffer: Buffer | null = null;
    let mimeType = "";
    if (storagePath) {
      if (storagePath.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', storagePath.slice(1));
        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
        }
      }
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
    }

    // 4. Construct Prompt
    const understandingInstruction = `You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}`;

    const formattedOptions = (examQuestion.published_options || [])
      .filter((o: any) => o.label !== "__metadata__")
      .map((o: any) => `${o.label}: ${o.text || ""}`)
      .join("\n");
      
    const promptText = `Question:\n${examQuestion.published_question_text || "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingInstruction}`;

    // 5. Construct Payload
    const payload = [];
    let imagePartCount = 0;
    let textPartCount = 0;

    if (fileBuffer) {
      payload.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });
      imagePartCount++;
    }
    payload.push(promptText);
    textPartCount++;

    // 6. Get API Key
    const instituteId = 'ddcc7407-fbb6-42bd-9751-576ef43e2241'; // From previous logs
    const { data: institute } = await supabase.from("institutes").select("gemini_api_key_encrypted, gemini_api_key_iv").eq("id", instituteId).single();
    if (!institute) {
      throw new Error("Institute not found");
    }
    let apiKey = await decryptApiKey(institute.gemini_api_key_encrypted, institute.gemini_api_key_iv);

    // 7. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig: { responseMimeType: "application/json" } });

    const result = await model.generateContent(payload);
    const rawResponse = result.response.text();

    const auditData = {
      imagePath: storagePath,
      imageSizeInBytes: fileBuffer ? fileBuffer.length : 0,
      imagePartCount,
      textPartCount,
      geminiRequestContents: {
        parts: payload.map(p => {
          if ((p as any).inlineData) return { mimeType: (p as any).inlineData.mimeType, base64Preview: (p as any).inlineData.data.substring(0, 30) + "...(truncated)" };
          return { textPreview: (p as string).substring(0, 100) + "...(truncated)" };
        })
      },
      rawGeminiResponse: JSON.parse(rawResponse)
    };

    return NextResponse.json(auditData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
