import React from "react";

export function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--eg-text-primary)] sm:text-lg">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
