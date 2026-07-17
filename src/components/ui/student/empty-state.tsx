import React from "react";
import { CTAButton } from "./cta-button";

interface EmptyStateProps {
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, ctaText, ctaHref, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "var(--eg-surface)",
        border: "1px dashed var(--eg-border)",
        borderRadius: "12px",
      }}
    >
      {icon && <div style={{ marginBottom: "16px", color: "var(--eg-text-tertiary)" }}>{icon}</div>}
      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--eg-text-primary)", marginBottom: "8px" }}>
        {title}
      </p>
      <p style={{ fontSize: "13px", color: "var(--eg-text-secondary)", maxWidth: "400px", lineHeight: 1.6, marginBottom: ctaText ? "24px" : "0" }}>
        {description}
      </p>
      {ctaText && ctaHref && (
        <CTAButton href={ctaHref} variant="secondary">
          {ctaText}
        </CTAButton>
      )}
    </div>
  );
}
