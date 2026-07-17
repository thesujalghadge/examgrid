import { getPlatformSetting } from "@/services/platform-settings-service";
import { PlatformSettingsForm } from "@/components/platform/platform-settings-form";
import { Settings } from "lucide-react";

export default async function PlatformSettingsPage() {
  const geminiApiKey = await getPlatformSetting("GEMINI_API_KEY");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground">Manage global configurations and AI integrations for the platform.</p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">AI Integration</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Configure the Gemini API Key used for platform-level tasks such as Syllabus PDF parsing. 
            This key will run the Gemini 3.1 Flash Lite model for structured extractions.
          </p>
          <PlatformSettingsForm initialGeminiKey={geminiApiKey || ""} />
        </div>
      </div>
    </div>
  );
}
