"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function ParseSyllabusButton({ versionId }: { versionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleParse = async () => {
    if (!confirm("Start parsing this syllabus using Gemini AI?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/curricula/versions/${versionId}/parse`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to parse syllabus");
      }

      alert("Syllabus parsed successfully!");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred while parsing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleParse} disabled={loading} variant="outline" className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700">
      <PlayCircle className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? "Parsing PDF..." : "Parse Syllabus PDF"}
    </Button>
  );
}
