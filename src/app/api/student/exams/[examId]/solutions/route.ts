import { NextResponse } from 'next/server';
import { fetchExamSolutions } from '@/lib/solutions/delivery';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    
    // In a real implementation, we would extract these from the session/auth token
    // Example: const session = await getSession();
    // For this mock/MVP layer, we simulate reading headers
    const instituteId = request.headers.get("x-institute-id");
    const studentId = request.headers.get("x-student-id");

    if (!instituteId || !studentId) {
      return NextResponse.json({ error: "Missing authentication headers" }, { status: 401 });
    }

    const result = await fetchExamSolutions({
      examId,
      instituteId,
      studentId
    });

    const response = NextResponse.json(result.payload, { status: result.status });
    
    // Explicitly disable caching
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    
    return response;

  } catch (error: any) {
    console.error('Student Delivery API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
