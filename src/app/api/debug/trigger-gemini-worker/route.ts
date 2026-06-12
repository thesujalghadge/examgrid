import { NextResponse } from 'next/server';
import { runGeminiWorker } from '@/lib/background-jobs/gemini-worker';

export async function POST() {
  try {
    const result = await runGeminiWorker();
    
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('Trigger error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
