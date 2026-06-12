import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const startTime = Date.now();
  let requestInstituteId = "unknown";

  try {
    const body = await req.json();
    const { instituteId } = body;
    
    if (!instituteId) {
      return NextResponse.json(
        { error: "instituteId is required in the request body." },
        { status: 400 },
      );
    }
    
    requestInstituteId = instituteId;
    console.log(`[DEBUG GEMINI-TEST] Fetching key for Institute: ${instituteId}`);
    
    // Securely fetch the active institute Gemini API key
    let geminiKey: string;
    try {
      geminiKey = await getInstituteGeminiKey(instituteId);
    } catch (err: any) {
      console.error(`[DEBUG GEMINI-TEST] Failed to fetch key: ${err.message}`);
      return NextResponse.json(
        { 
          success: false, 
          error: "No Gemini API key configured or failed to decrypt.", 
          details: err.message,
          instituteId 
        },
        { status: 400 },
      );
    }
    
    // Mask and log prefix safely
    const keyPrefix = geminiKey.length > 8 ? `${geminiKey.substring(0, 8)}...` : "[TOO_SHORT]";
    console.log(`[DEBUG GEMINI-TEST] Key retrieved. Prefix: ${keyPrefix}`);
    
    // Initialize Gemini directly
    console.log(`[DEBUG GEMINI-TEST] Initializing GoogleGenerativeAI client...`);
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    console.log(`[DEBUG GEMINI-TEST] Sending prompt 'Reply with OK'...`);
    const result = await model.generateContent("Reply with OK");
    
    const responseText = result.response.text();
    console.log(`[DEBUG GEMINI-TEST] Received response: ${responseText.trim()}`);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: "Gemini connectivity verified.",
      response: responseText,
      durationMs: duration,
      instituteId: requestInstituteId,
      keyPrefix: keyPrefix
    });
    
  } catch (err: any) {
    console.error(`[DEBUG GEMINI-TEST] Fatal error occurred during request:`, err);
    return NextResponse.json(
      { 
        success: false, 
        error: "Gemini request execution failed.",
        message: err.message,
        stack: err.stack,
        instituteId: requestInstituteId,
        durationMs: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
