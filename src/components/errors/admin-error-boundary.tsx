"use client";

import type { ReactNode } from "react";
import { AppErrorBoundary } from "./app-error-boundary";

export function AdminErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary
      scope="admin"
      title="Admin panel error"
      description="The admin module encountered an error. Repository data in localStorage was not modified."
    >
      {children}
    </AppErrorBoundary>
  );
}
