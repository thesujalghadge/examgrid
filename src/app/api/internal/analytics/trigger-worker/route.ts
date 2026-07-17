import { NextRequest, NextResponse } from "next/server";
import { runAnalyticsWorker } from "@/lib/analytics/worker";
import { processAnalyticsWorkerJobs } from "@/workers/analytics-worker";
import { processAnalyticsProjectorJobs } from "@/workers/analytics-projector";
import { processMappingChangedJobs } from "@/workers/mapping-changed-worker";
import { processQuestionClassifiedJobs } from "@/workers/question-classified-worker";

export const maxDuration = 300; // 5 mins

export async function POST(req: NextRequest) {
  // Simple auth for the endpoint
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Process legacy
    runAnalyticsWorker().catch(console.error);
    
    // Process new analytics sequentially to avoid race condition where projector runs before worker inserts deltas
    await processAnalyticsWorkerJobs();
    await processQuestionClassifiedJobs();
    await processMappingChangedJobs();
    await processAnalyticsProjectorJobs();
    
    return NextResponse.json({ success: true, message: "Workers triggered" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
