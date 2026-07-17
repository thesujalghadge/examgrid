"use client";

import { Trash2 } from "lucide-react";
import { deleteCurriculum } from "@/services/curriculum-service";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteCurriculumButton({ id, name }: { id: string, name: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm(`Are you sure you want to delete ${name}? This will delete all associated versions, artifacts, and mappings.`)) {
      startTransition(async () => {
        try {
          await deleteCurriculum(id);
        } catch (error) {
          alert("Failed to delete curriculum.");
        }
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 z-10 relative"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
