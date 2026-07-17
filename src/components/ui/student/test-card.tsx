import React from "react";
import { CalendarDays, Clock3, FileText, Tags } from "lucide-react";

import { Badge } from "./badge";
import { CTAButton } from "./cta-button";

interface TestCardBase {
  title: string;
  className?: string;
}

interface UpcomingTestCardProps extends TestCardBase {
  dateBox: { month: string; day: string; weekday: string };
  duration: string;
  questions: number;
  tags?: string[];
  startsIn?: string;
  isActive?: boolean;
  ctaText?: string;
  ctaHref?: string;
  bottomText?: string;
}

export function UpcomingTestCard({
  title,
  dateBox,
  duration,
  questions,
  tags = [],
  startsIn,
  isActive,
  ctaText,
  ctaHref,
  bottomText,
  className = "",
}: UpcomingTestCardProps) {
  return (
    <article
      className={`eg-animate-in rounded-[24px] bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--eg-shadow-hover)] sm:p-5 ${className}`}
      style={{ border: "1px solid rgba(232,234,243,0.9)", boxShadow: "var(--eg-shadow-rest)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex w-full shrink-0 items-center justify-between rounded-[20px] px-4 py-3 sm:h-[86px] sm:w-[82px] sm:flex-col sm:justify-center sm:px-2"
          style={{ backgroundColor: "var(--eg-surface-soft)" }}
        >
          <span className="text-xs font-bold uppercase text-[var(--eg-accent)]">{dateBox.month}</span>
          <span className="font-mono text-2xl font-bold leading-none text-[var(--eg-text-primary)]">{dateBox.day}</span>
          <span className="text-[11px] font-semibold uppercase text-[var(--eg-text-tertiary)]">{dateBox.weekday}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isActive && <Badge variant="success">Ready now</Badge>}
                {startsIn && !isActive && <Badge variant="primary">Starts in {startsIn}</Badge>}
                {bottomText && <span className="text-xs font-semibold text-[var(--eg-text-tertiary)]">{bottomText}</span>}
              </div>
              <h3 className="text-base font-semibold leading-snug tracking-tight text-[var(--eg-text-primary)]">
                {title}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-[var(--eg-text-secondary)]">
                <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{duration}</span>
                <span className="inline-flex items-center gap-1.5"><FileText size={14} />{questions} questions</span>
                {tags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5"><Tags size={14} />{tags.join(", ")}</span>
                )}
              </div>
            </div>

            {ctaHref && (
              <div className="shrink-0 sm:pt-1">
                <CTAButton href={ctaHref} variant={isActive ? "primary" : "secondary"}>
                  {ctaText || (isActive ? "Start Test" : "View Details")}
                </CTAButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

interface RecentTestCardProps extends TestCardBase {
  icon: React.ReactNode;
  dateStr: string;
  score: number;
  rank: number | null;
  ctaHref: string;
  animationDelay?: number;
}

export function RecentTestCard({
  title,
  icon,
  dateStr,
  score,
  rank,
  ctaHref,
  animationDelay = 0,
  className = "",
}: RecentTestCardProps) {
  return (
    <article
      className={`eg-animate-in rounded-[24px] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--eg-shadow-hover)] ${className}`}
      style={{
        animationDelay: `${animationDelay}ms`,
        border: "1px solid rgba(232,234,243,0.9)",
        boxShadow: "var(--eg-shadow-rest)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--eg-accent-light)", color: "var(--eg-accent)" }}
        >
          {icon}
        </div>
        <CTAButton href={ctaHref} variant="ghost" className="text-xs">
          Review
        </CTAButton>
      </div>

      <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-[var(--eg-text-primary)]">
        {title}
      </h3>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--eg-text-tertiary)]">
        <CalendarDays size={13} />
        {dateStr}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[var(--eg-surface-soft)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">Score</p>
          <p className="mt-1 font-mono text-xl font-bold text-[var(--eg-text-primary)]">{score}</p>
        </div>
        <div className="rounded-2xl bg-[var(--eg-surface-soft)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--eg-text-tertiary)]">Rank</p>
          <p className="mt-1 font-mono text-xl font-bold text-[var(--eg-text-primary)]">{rank !== null ? rank : "-"}</p>
        </div>
      </div>
    </article>
  );
}

export function FeaturedTestCard({
  title,
  dateBox,
  duration,
  questions,
  isActive,
  startsIn,
  ctaText,
  ctaHref,
}: UpcomingTestCardProps) {
  return (
    <article
      className="eg-animate-in rounded-[32px] bg-white p-6 sm:p-8 transition-all duration-300 hover:shadow-[var(--eg-shadow-hover)]"
      style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className="flex shrink-0 items-center justify-between rounded-[24px] px-6 py-4 sm:h-[110px] sm:w-[110px] sm:flex-col sm:justify-center sm:px-4"
          style={{ backgroundColor: "var(--eg-surface-soft)" }}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--eg-accent)]">{dateBox.month}</span>
          <span className="font-mono text-[34px] font-bold leading-none text-[var(--eg-text-primary)] my-1">{dateBox.day}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--eg-text-tertiary)]">{dateBox.weekday}</span>
        </div>

        <div className="min-w-0 flex-1 pl-0 sm:pl-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                {isActive ? <Badge variant="success">Ready now</Badge> : startsIn ? <Badge variant="primary">Starts in {startsIn}</Badge> : null}
              </div>
              <h3 className="text-[22px] sm:text-[28px] font-bold leading-tight tracking-tight text-[var(--eg-text-primary)]">
                {title}
              </h3>
              <div className="mt-4 flex items-center gap-6 text-[14px] font-medium text-[var(--eg-text-secondary)]">
                <span className="flex items-center gap-2"><Clock3 size={16} />{duration}</span>
                <span className="flex items-center gap-2"><FileText size={16} />{questions} questions</span>
              </div>
            </div>

            {ctaHref && (
              <div className="shrink-0 mt-4 sm:mt-0">
                <CTAButton 
                  href={ctaHref} 
                  variant={isActive ? "primary" : "secondary"}
                  style={isActive ? { padding: "14px 28px", fontSize: "15px", borderRadius: "14px" } : {}}
                >
                  {ctaText || (isActive ? "Start Test" : "View Details")}
                </CTAButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

interface CompletedTestCardProps extends TestCardBase {
  dateStr?: string;
  score?: number;
  rank?: number | null;
  ctaHref: string;
}

export function CompletedTestCard({
  title,
  dateStr,
  score,
  rank,
  ctaHref,
  className = ""
}: CompletedTestCardProps) {
  return (
    <article
      className={`eg-animate-in group relative overflow-hidden rounded-[24px] bg-white p-5 transition-all duration-300 hover:shadow-[var(--eg-shadow-hover)] ${className}`}
      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">
            <CalendarDays size={14} />
            {dateStr || "Completed"}
          </div>
          <h3 className="text-[18px] font-bold text-[var(--eg-text-primary)] leading-snug">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-8 shrink-0">
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Score</div>
            <div className="text-[24px] font-mono font-bold text-[var(--eg-text-primary)] leading-none mt-1">
              {score !== undefined ? score : "-"}
            </div>
          </div>
          <div className="text-right w-16">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Rank</div>
            <div className="text-[24px] font-mono font-bold text-[var(--eg-text-primary)] leading-none mt-1">
              {rank !== undefined && rank !== null ? rank : "-"}
            </div>
          </div>
          <CTAButton href={ctaHref} variant="secondary">
            Review Solutions
          </CTAButton>
        </div>
      </div>
    </article>
  );
}
