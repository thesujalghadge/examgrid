"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Key } from "lucide-react";
import { setPlatformSetting } from "@/services/platform-settings-service";
import { useRouter } from "next/navigation";

export function PlatformSettingsForm({ initialGeminiKey }: { initialGeminiKey: string }) {
  const [apiKey, setApiKey] = useState(initialGeminiKey);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setPlatformSetting("GEMINI_API_KEY", apiKey);
      alert("Platform settings saved successfully!");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          Gemini API Key
        </label>
        <Input
          type="password"
          placeholder="AIzaSy..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          This key is stored securely and used exclusively for Syllabus parsing and related platform AI jobs.
        </p>
      </div>
      
      <Button type="submit" disabled={loading}>
        <Save className="w-4 h-4 mr-2" />
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
