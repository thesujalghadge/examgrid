import { NextResponse } from 'next/server';
import { runCleanupJob } from '@/lib/background-jobs/cleanup-worker';

export async function POST(request: Request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body might be empty
    }

    const dryRun = (body as any).dryRun === true;

    // Await the cleanup synchronously so we can return the exact JSON payload
    const results = await runCleanupJob({ dryRun });

    return NextResponse.json({
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      results
    });
  } catch (error: any) {
    console.error('Trigger error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
