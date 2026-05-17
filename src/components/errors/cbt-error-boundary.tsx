"use client";

import type { ReactNode } from "react";
import { AppErrorBoundary } from "./app-error-boundary";

export function CbtErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary
      scope="cbt"
      title="Examination error"
      description="The CBT interface stopped unexpectedly. If you were in an exam, try reloading — your attempt may be recoverable from local storage."
    >
      {children}
    </AppErrorBoundary>
  );
}
