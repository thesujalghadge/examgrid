import { NextResponse } from 'next/server';
import { runAssetImportJob } from '@/lib/background-jobs/asset-import-worker';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Call the worker synchronously in the background (fire and forget is fine for debug, 
    // but here we might want to await it so we can return the result)
    await runAssetImportJob(jobId);

    return NextResponse.json({ success: true, message: `Job ${jobId} execution triggered.` });
  } catch (error: any) {
    console.error('Trigger error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
