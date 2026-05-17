import Link from "next/link";
import { BRAND, BRAND_COLORS } from "@/config/brand";
import { cn } from "@/lib/utils";

export function ProductMark({
  compact = false,
  subtitle,
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm ring-1 ring-white/10 transition group-hover:shadow-md"
        style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryMuted} 100%)` }}
      >
        EG
      </span>
      {!compact && (
        <span>
          <span className="block text-sm font-semibold leading-tight text-slate-950">
            {BRAND.name}
          </span>
          <span className="block text-xs leading-4 text-slate-500">
            {subtitle ?? "Academic intelligence platform"}
          </span>
        </span>
      )}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--eg-border)] pb-6">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="eg-section-title mb-2">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn";
  icon?: React.ReactNode;
}) {
  return (
    <div className="eg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eg-section-title">{label}</p>
        {icon && (
          <span className="text-slate-400">{icon}</span>
        )}
      </div>
      <p
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-[var(--eg-brand)]",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "red" && "border-red-200 bg-red-50 text-red-800",
        tone === "blue" && "border-blue-200 bg-blue-50 text-blue-800",
        tone === "violet" && "border-violet-200 bg-violet-50 text-violet-800",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="font-medium text-slate-950">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function DashboardPanel({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={cn("eg-card", padding && "p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function QuickActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-xl border border-[var(--eg-border)] bg-white p-4 transition hover:border-[var(--eg-brand)]/30 hover:bg-slate-50"
    >
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--eg-brand)]/10 text-[var(--eg-brand)]">
          {icon}
        </span>
      )}
      <span>
        <span className="font-medium text-slate-950 group-hover:text-[var(--eg-brand)]">
          {title}
        </span>
        <span className="mt-1 block text-sm text-slate-500">{description}</span>
      </span>
    </Link>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--eg-brand)]" />
      {label}
    </div>
  );
}

export function CountdownPill({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-center",
        urgent
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-slate-50",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          urgent ? "text-amber-800" : "text-slate-800",
        )}
      >
        {value}
      </p>
    </div>
  );
}
