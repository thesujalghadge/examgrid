import { NextRequest, NextResponse } from "next/server";
import { importE2eDataset, executeWorkersAndWait, verifyProductionData, clearExistingDataForE2e } from "@/lib/dev/e2e-harness";

export const maxDuration = 900; // 15 mins for timeout

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instituteId, papers } = body;

    if (!instituteId || !papers || !Array.isArray(papers)) {
      return NextResponse.json({ error: "Invalid payload. Required: instituteId, papers[]" }, { status: 400 });
    }

    const log: string[] = [];
    const pushLog = (msg: string) => {
      console.log(`[E2E] ${msg}`);
      log.push(msg);
    };

    pushLog(`Starting Production Validation Harness for ${papers.length} papers`);

    // Clean slate
    await clearExistingDataForE2e(instituteId);

    // Phase 1: IMPORT
    await importE2eDataset(instituteId, papers, pushLog);

    // Phase 2: EXECUTE
    await executeWorkersAndWait(req.nextUrl.origin, pushLog);

    // Phase 3: VERIFY
    pushLog("Phase 3: VERIFY - Auditing production tables for mathematical correctness");
    
    // Calculate expected numbers
    const expectedPapers = papers.length;
    let expectedAttemptsPerPaper = papers[0]?.students?.length || 0;
    let expectedQuestionsPerPaper = papers[0]?.questions?.length || 0;
    
    const certification = await verifyProductionData(instituteId, expectedPapers, expectedAttemptsPerPaper, expectedQuestionsPerPaper);
    
    return NextResponse.json({
      success: true,
      log,
      certification
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
