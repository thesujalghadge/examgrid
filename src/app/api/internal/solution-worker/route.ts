import { NextResponse } from 'next/server';
import { runWorkerTick } from '@/lib/background-jobs/gemini-worker';

export const maxDuration = 60; // 60 seconds (Pro tier max, or Hobby max depending on config)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Simple auth for the cron endpoint
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    // Return 401 but log it if it's a dev environment bypassing
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runWorkerTick();
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[cron/solution-worker] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
