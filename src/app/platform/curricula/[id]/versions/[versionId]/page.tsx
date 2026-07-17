import { getCurriculumVersion, getCurriculumArtifacts, getCurriculumNodes } from "@/services/curriculum-service";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, AlertCircle, UploadCloud, FileText, Download } from "lucide-react";
import { CurriculumTreeViewer } from "@/components/platform/curriculum-tree-viewer";
import { ParseSyllabusButton } from "@/components/platform/parse-syllabus-button";
import { PublishVersionButton } from "@/components/platform/publish-version-button";

export default async function VersionDetailPage({ params }: { params: Promise<{ id: string, versionId: string }> }) {
  const { id, versionId } = await params;
  const version = await getCurriculumVersion(versionId);
  const artifacts = await getCurriculumArtifacts(versionId).catch(() => null);
  const nodes = await getCurriculumNodes(versionId).catch(() => []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"><UploadCloud className="w-4 h-4 mr-2" /> Uploaded</span>;
      case 'PARSING':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10"><Clock className="w-4 h-4 mr-2 animate-pulse" /> Parsing</span>;
      case 'REVIEW':
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10"><AlertCircle className="w-4 h-4 mr-2" /> Review Needed</span>;
      case 'PUBLISHED':
        return <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-700/10"><CheckCircle className="w-4 h-4 mr-2" /> Published</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{status}</span>;
    }
  };

  const isPublishable = version.status === 'REVIEW';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/platform/curricula/${id}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{version.version_name}</h1>
              {getStatusBadge(version.status)}
            </div>
            <p className="text-muted-foreground">Curriculum: {version.curricula?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {version.status === 'UPLOADED' && (
            <ParseSyllabusButton versionId={version.id} />
          )}
          <PublishVersionButton versionId={version.id} disabled={!isPublishable} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Left Column: Artifacts & Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg flex items-center"><FileText className="w-5 h-5 mr-2 text-primary" /> Artifacts</h3>
            {artifacts?.original_pdf_url ? (
              <div className="p-4 bg-muted/30 rounded-lg border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Original PDF</p>
                    <p className="text-xs text-muted-foreground">Uploaded Source</p>
                  </div>
                </div>
                <a href={artifacts.original_pdf_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded transition-colors">
                  <Download className="w-4 h-4 text-muted-foreground" />
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No artifacts available.</p>
            )}
          </div>
          
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Lifecycle Timeline</h3>
            <div className="space-y-4 pl-2 border-l-2 border-muted ml-2">
              <div className="relative pl-6">
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-card"></div>
                <p className="font-medium text-sm">Uploaded</p>
                <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString()}</p>
              </div>
              <div className="relative pl-6">
                <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-card ${['PARSING', 'REVIEW', 'PUBLISHED'].includes(version.status) ? 'bg-amber-500' : 'bg-muted'}`}></div>
                <p className={`font-medium text-sm ${['PARSING', 'REVIEW', 'PUBLISHED'].includes(version.status) ? '' : 'text-muted-foreground'}`}>Parsing Pipeline</p>
              </div>
              <div className="relative pl-6">
                <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-card ${['REVIEW', 'PUBLISHED'].includes(version.status) ? 'bg-purple-500' : 'bg-muted'}`}></div>
                <p className={`font-medium text-sm ${['REVIEW', 'PUBLISHED'].includes(version.status) ? '' : 'text-muted-foreground'}`}>Admin Review</p>
              </div>
              <div className="relative pl-6">
                <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ring-4 ring-card ${version.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-muted'}`}></div>
                <p className={`font-medium text-sm ${version.status === 'PUBLISHED' ? '' : 'text-muted-foreground'}`}>Published</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tree Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl shadow-sm h-full flex flex-col min-h-[600px]">
            <div className="p-4 border-b bg-muted/10">
              <h3 className="font-semibold text-lg">Curriculum Structure</h3>
            </div>
            
            <div className="flex-1 p-6">
              {nodes.length > 0 ? (
                <CurriculumTreeViewer nodes={nodes} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                  <FileText className="w-16 h-16 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">No parsed curriculum available yet.</p>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      The parser worker has not generated the hierarchy structure for this PDF yet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
