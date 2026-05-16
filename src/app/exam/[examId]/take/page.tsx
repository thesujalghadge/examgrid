"use client";

import { useParams } from "next/navigation";
import { ExamInterface } from "@/components/exam/ExamInterface";

export default function TakeExamPage() {
  const params = useParams();
  const examId = params.examId as string;

  return <ExamInterface examId={examId} />;
}
