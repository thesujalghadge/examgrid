import { NextResponse } from 'next/server';
import { runGeminiWorker } from '@/lib/background-jobs/gemini-worker';

// Prevent unauthorized execution
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Process a maximum of 3 items per invocation
    const MAX_JOBS = 3;
    let jobsProcessed = 0;
    const results = [];

    for (let i = 0; i < MAX_JOBS; i++) {
      const result = await runGeminiWorker();
      results.push(result);

      if (result.processed === 0) {
        // Queue is empty or no jobs available, exit early
        break;
      }
      
      jobsProcessed += result.processed || 0;

      // Wait 3000ms between calls if we process more to avoid hitting the 15 RPM limit
      if (i < MAX_JOBS - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    if (jobsProcessed > 0) {
      // Daisy-chain to continue processing the queue in the background
      const processUrl = new URL('/api/internal/process-solution-queue', request.url).toString();
      fetch(processUrl, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${CRON_SECRET}` }
      }).catch(err => console.error('Failed to daisy-chain background processing:', err));
    }

    return NextResponse.json({
      success: true,
      jobsProcessed,
      results
    });
  } catch (error: any) {
    console.error('Solution Queue Processor Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
