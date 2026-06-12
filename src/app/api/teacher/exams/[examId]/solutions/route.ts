import { NextResponse } from 'next/server';
import { fetchExamSolutions } from '@/lib/solutions/delivery';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    
    // In a real implementation, we would extract these from the session/auth token
    // For this mock/MVP layer, we simulate reading headers
    const instituteId = request.headers.get("x-institute-id");

    if (!instituteId) {
      return NextResponse.json({ error: "Missing authentication headers" }, { status: 401 });
    }

    // Teacher requests do not provide studentId, which triggers the bypass of release checks
    const result = await fetchExamSolutions({
      examId,
      instituteId
    });

    const response = NextResponse.json(result.payload, { status: result.status });
    
    // Explicitly disable caching
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    
    return response;

  } catch (error: any) {
    console.error('Teacher Delivery API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
