"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { publishCurriculumVersion } from "@/services/curriculum-service";

export function PublishVersionButton({ versionId, disabled }: { versionId: string, disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handlePublish = async () => {
    if (window.confirm("Are you sure you want to publish this version? It will become the active syllabus mapping source and trigger embedding generation.")) {
      startTransition(async () => {
        try {
          await publishCurriculumVersion(versionId);
        } catch (error) {
          console.error("Failed to publish version:", error);
          alert("Failed to publish version.");
        }
      });
    }
  };

  return (
    <Button 
      disabled={disabled || isPending} 
      onClick={handlePublish}
      className={!disabled ? "bg-green-600 hover:bg-green-700 text-white" : ""}
    >
      <CheckCircle className="w-4 h-4 mr-2" />
      {isPending ? "Publishing..." : "Publish Version"}
    </Button>
  );
}
