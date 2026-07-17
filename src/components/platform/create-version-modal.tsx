"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createCurriculumVersion } from "@/services/curriculum-service";
import { Plus, UploadCloud } from "lucide-react";

export function CreateVersionModal({ curriculumId }: { curriculumId: string }) {
  const [open, setOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim() || !file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      await createCurriculumVersion(curriculumId, versionName, formData);
      setOpen(false);
      setVersionName("");
      setFile(null);
    } catch (err) {
      console.error(err);
      alert("Failed to upload curriculum version");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Upload Version
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload Syllabus PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Version Name</label>
              <Input
                placeholder="e.g. JEE Main 2026"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Syllabus PDF</label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/50 transition-colors">
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                <Input 
                  type="file" 
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="max-w-xs cursor-pointer"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">Only PDF files are supported</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !versionName.trim() || !file}>
              {loading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
