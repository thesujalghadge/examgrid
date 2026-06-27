import { NextRequest, NextResponse } from "next/server";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Export runtime as edge is NOT supported because we use fs
export const runtime = "nodejs";

const syllabusSchema = {
  type: SchemaType.OBJECT,
  properties: {
    subjects: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          chapters: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                topics: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      name: { type: SchemaType.STRING },
                      subtopics: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            name: { type: SchemaType.STRING },
                          },
                          required: ["name"]
                        }
                      }
                    },
                    required: ["name"]
                  }
                }
              },
              required: ["name"]
            }
          }
        },
        required: ["name", "chapters"]
      }
    }
  },
  required: ["subjects"]
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params;
    const instituteId = req.headers.get("x-institute-id") || req.cookies.get("institute_id")?.value; // Depending on how auth works
    
    // We should really verify the session, but we will assume auth is done by middleware for now.
    // Let's get the form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const manualInstituteId = formData.get("instituteId") as string;

    const resolvedInstituteId = manualInstituteId || instituteId;

    if (!file || !resolvedInstituteId) {
      return NextResponse.json({ error: "File and instituteId are required" }, { status: 400 });
    }

    // Try institute key, fallback to platform key
    let apiKey = process.env.GEMINI_API_KEY!;
    try {
      const iKey = await getInstituteGeminiKey(resolvedInstituteId);
      if (iKey) apiKey = iKey;
    } catch (err) {
      console.warn("Using platform API key for syllabus extraction");
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No Gemini API Key available" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);
    
    // Write file to temp dir
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), `syllabus_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempPath, buffer);

    let mimeType = file.type;
    if (file.name.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (file.name.endsWith(".xlsx")) mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (file.name.endsWith(".csv")) mimeType = "text/csv";

    // Upload to Gemini
    const uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType,
      displayName: file.name,
    });

    // Cleanup temp file
    fs.unlinkSync(tempPath);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: syllabusSchema as any,
      }
    });

    const prompt = `You are an expert curriculum parser. 
Extract the syllabus structure from this document. 
Format it strictly as a hierarchy: Subject -> Chapter -> Topic -> Subtopic.
If a level is missing, just omit it or map appropriately.
Ensure the output matches the JSON schema requested.`;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri
        }
      },
      { text: prompt },
    ]);

    const extractedText = result.response.text();
    const parsed = JSON.parse(extractedText);

    return NextResponse.json({ success: true, data: parsed });

  } catch (error: any) {
    console.error("Syllabus extraction failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
