"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKeyStatus {
  hasKey: boolean;
  setAt: string | null;
  status: "VALID" | "INVALID_SECRET" | "NO_KEY";
}

export function InstituteApiKeySection({ instituteId }: { instituteId: string }) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/institute/${instituteId}/api-key/status`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ hasKey: false, setAt: null, status: "NO_KEY" });
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

  const handleSave = async () => {
    if (!keyInput.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/institute/${instituteId}/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save key" });
        return;
      }

      setMessage({ type: "success", text: "API key saved and validated successfully." });
      setKeyInput("");
      const nextStatus = await fetch(`/api/institute/${instituteId}/api-key/status`, {
        cache: "no-store",
        credentials: "include",
      }).then((statusResponse) => statusResponse.json());
      setStatus(nextStatus);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving) return;
    if (!confirm("Are you sure you want to remove the API key? Visually heavy PDFs will fail to parse until a new key is set.")) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/institute/${instituteId}/api-key`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        setMessage({ type: "error", text: data.error ?? "Failed to delete key" });
        return;
      }
      setMessage({ type: "success", text: "API key removed successfully." });
      setKeyInput("");
      setStatus({ hasKey: false, setAt: null, status: "NO_KEY" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-[#d8d2c7] bg-white p-4 sm:col-span-2 lg:col-span-4">
      <div>
        <h3 className="text-sm font-semibold text-[#14213d]">Gemini AI API Key</h3>
        <p className="text-xs text-[#5e5a52]">
          Used for parsing question papers and generating solutions.
        </p>
      </div>

      {status ? (
        <div
          className={`rounded px-3 py-2 text-xs flex items-center gap-1.5 font-medium ${
            status.status === "VALID"
              ? "bg-green-50 text-green-700"
              : status.status === "INVALID_SECRET"
                ? "bg-red-50 text-red-700"
                : "bg-gray-50 text-gray-700"
          }`}
        >
          {status.status === "VALID" && <span>✅ API Key Valid</span>}
          {status.status === "INVALID_SECRET" && <span>❌ API Key Invalid (Please re-enter)</span>}
          {status.status === "NO_KEY" && <span>⚪ No API Key Configured</span>}
          
          {status.setAt ? (
            <span className="text-gray-500 font-normal ml-1">
              · Set on {new Date(status.setAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder={status?.hasKey ? "Enter new key to replace existing" : "AIza..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5e5a52] hover:text-[#14213d]"
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !keyInput.trim()}
          className="bg-[#14213d]"
        >
          {saving ? "Validating..." : status?.hasKey ? "Update Key" : "Save Key"}
        </Button>
        {status?.hasKey && (
          <Button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            variant="destructive"
          >
            Remove Key
          </Button>
        )}
      </div>

      {message ? (
        <p className={message.type === "error" ? "text-xs text-red-600" : "text-xs text-green-700"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
