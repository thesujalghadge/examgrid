import { getCurriculum, getCurriculumVersions } from "@/services/curriculum-service";
import Link from "next/link";
import { ArrowLeft, Plus, FileText, ChevronRight, Clock, CheckCircle, UploadCloud, AlertCircle } from "lucide-react";
import { CreateVersionModal } from "@/components/platform/create-version-modal";

export default async function CurriculumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const curriculum = await getCurriculum(id);
  const versions = await getCurriculumVersions(id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"><UploadCloud className="w-3 h-3 mr-1" /> Uploaded</span>;
      case 'PARSING':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10"><Clock className="w-3 h-3 mr-1 animate-pulse" /> Parsing</span>;
      case 'REVIEW':
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10"><AlertCircle className="w-3 h-3 mr-1" /> Review Needed</span>;
      case 'PUBLISHED':
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10"><CheckCircle className="w-3 h-3 mr-1" /> Published</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/platform/curricula" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{curriculum.name}</h1>
          <p className="text-muted-foreground">{curriculum.description || "No description"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-b pb-4 mt-8">
        <h2 className="text-xl font-semibold">Versions</h2>
        <CreateVersionModal curriculumId={curriculum.id} />
      </div>

      <div className="bg-card border rounded-xl shadow-sm divide-y">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mb-4 opacity-50" />
            <p>No versions have been uploaded for this curriculum.</p>
          </div>
        ) : (
          versions.map((version) => (
            <Link 
              key={version.id} 
              href={`/platform/curricula/${curriculum.id}/versions/${version.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-medium text-lg">{version.version_name}</h3>
                <p className="text-xs text-muted-foreground">Created {new Date(version.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(version.status)}
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
