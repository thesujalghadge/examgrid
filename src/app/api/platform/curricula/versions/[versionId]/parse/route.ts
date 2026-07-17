import { NextRequest, NextResponse } from "next/server";
import { getPlatformSetting } from "@/services/platform-settings-service";
import { 
  getCurriculumArtifacts, 
  updateCurriculumVersionStatus,
  saveParsedSyllabus 
} from "@/services/curriculum-service";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;

    const artifacts = await getCurriculumArtifacts(versionId);
    if (!artifacts || !artifacts.original_pdf_url) {
      return NextResponse.json({ error: "No PDF uploaded for this version" }, { status: 404 });
    }

    let apiKey = await getPlatformSetting("GEMINI_API_KEY");
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY;
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Platform Gemini API Key is missing. Please configure it in settings." }, { status: 500 });
    }

    // Update status to parsing
    await updateCurriculumVersionStatus(versionId, "PARSING");

    // Extract the file path from the URL
    const urlPath = new URL(artifacts.original_pdf_url).pathname;
    const filePathMatch = urlPath.match(/curriculum_artifacts\/(.+)$/);
    if (!filePathMatch) {
      await updateCurriculumVersionStatus(versionId, "UPLOADED");
      return NextResponse.json({ error: "Could not extract file path from storage URL" }, { status: 500 });
    }
    const filePath = filePathMatch[1];

    const { createServiceRoleClient } = await import("@/lib/institute/get-institute-api-key");
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
    }

    // Download the PDF securely
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("curriculum_artifacts")
      .download(filePath);

    if (downloadError || !fileBlob) {
      await updateCurriculumVersionStatus(versionId, "UPLOADED");
      return NextResponse.json({ error: "Failed to download PDF from storage" }, { status: 500 });
    }
    
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), `curriculum_${versionId}_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, buffer);

    const fileManager = new GoogleAIFileManager(apiKey);
    const uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType: "application/pdf",
      displayName: `Syllabus_${versionId}.pdf`,
    });

    fs.unlinkSync(tempPath);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: syllabusSchema as any,
      }
    });

    const prompt = `You are an expert curriculum parser and educational ontologist.
Extract the syllabus structure from this document strictly as a hierarchy: Subject -> Chapter -> Topic -> Subtopic.

CRITICAL INSTRUCTIONS:
1. DO NOT summarize, abbreviate, or omit ANY words from the syllabus. 
2. Extract the exact phrases verbatim from the PDF. 
3. If the syllabus contains a list of concepts separated by commas or periods (e.g., "Reflection of light, spherical mirrors, mirror formula."), use that exact full string as the Subtopic or Topic name.
4. Maintain 100% fidelity to the original text so that future cumulative analysis maps perfectly to the official syllabus vocabulary.
5. Avoid creating redundant parent/child nodes with the exact same name.`;

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
    const parsedJson = JSON.parse(extractedText);

    await saveParsedSyllabus(versionId, parsedJson);
    await updateCurriculumVersionStatus(versionId, "REVIEW");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Syllabus extraction failed:", error);
    
    // In case of error, you might want to revert status or mark as FAILED.
    // For now, returning it to UPLOADED so they can retry.
    const { versionId } = await params;
    try {
      await updateCurriculumVersionStatus(versionId, "UPLOADED");
    } catch (e) {}

    // Check if it's a rate limit error (429) from Google API
    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
      return NextResponse.json({ error: "Gemini API rate limit exceeded. Please try again later." }, { status: 429 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
