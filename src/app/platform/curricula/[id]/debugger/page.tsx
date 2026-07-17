import { getRecentQuestionsForDebugger } from "@/services/debugger-service";
import { DebuggerUI } from "@/components/platform/debugger-ui";
import { Bug } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DebuggerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch some dummy questions for the dropdown
  // In a real system, you'd fetch questions specific to the curriculum or exam
  const questions = await getRecentQuestionsForDebugger();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/platform/curricula/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center">
            <Bug className="w-6 h-6 mr-3 text-purple-600" />
            E2E Pipeline Debugger
          </h1>
          <p className="text-muted-foreground mt-1">
            Trace the deterministic classification pipeline. Defaults to Dry Run mode (no database writes).
          </p>
        </div>
      </div>

      <DebuggerUI questions={questions} />
    </div>
  );
}
