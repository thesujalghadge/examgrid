import { getCurricula } from "@/services/curriculum-service";
import Link from "next/link";
import { CreateCurriculumModal } from "@/components/platform/create-curriculum-modal";
import { DeleteCurriculumButton } from "@/components/platform/delete-curriculum-button";
import { BookOpen, FileText } from "lucide-react";

export default async function CurriculaPage() {
  const curricula = await getCurricula();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curriculum Management</h1>
          <p className="text-muted-foreground">Define and manage academic syllabi and curriculums across the platform.</p>
        </div>
        <CreateCurriculumModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {curricula.map((curriculum) => (
          <Link
            key={curriculum.id}
            href={`/platform/curricula/${curriculum.id}`}
            className="group block rounded-xl border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{curriculum.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{curriculum.description || "No description"}</p>
                </div>
              </div>
              <DeleteCurriculumButton id={curriculum.id} name={curriculum.name} />
            </div>
          </Link>
        ))}

        {curricula.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center bg-muted/30">
            <FileText className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Curricula Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Create your first curriculum to begin managing syllabi for your platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
