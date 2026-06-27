import { NextRequest, NextResponse } from "next/server";
import { runAnalyticsWorker } from "@/lib/analytics/worker";

export const maxDuration = 300; // 5 mins

export async function POST(req: NextRequest) {
  try {
    // Process async
    runAnalyticsWorker().catch(console.error);
    return NextResponse.json({ success: true, message: "Worker triggered" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
