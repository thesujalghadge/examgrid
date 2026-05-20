"use client";

import { usePathname } from "next/navigation";

export function SessionDebugPanel({
  role,
  instituteId,
}: {
  role: string;
  instituteId?: string;
}) {
  const pathname = usePathname();
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 rounded border border-gray-300 bg-white/95 px-3 py-2 text-xs shadow">
      <p className="font-semibold text-gray-700">Dev Session</p>
      <p>role: {role}</p>
      <p>instituteId: {instituteId ?? "none"}</p>
      <p>route: {pathname}</p>
    </div>
  );
}
