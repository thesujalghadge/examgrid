import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "ghost";
}

export function Badge({ children, variant = "primary" }: BadgeProps) {
  const variants = {
    primary: { bg: "var(--eg-accent-light)", color: "var(--eg-accent)" },
    secondary: { bg: "color-mix(in srgb, var(--eg-text-secondary) 10%, transparent)", color: "var(--eg-text-secondary)" },
    success: { bg: "color-mix(in srgb, var(--eg-success) 10%, transparent)", color: "var(--eg-success)" },
    warning: { bg: "color-mix(in srgb, var(--eg-warning) 10%, transparent)", color: "var(--eg-warning)" },
    danger: { bg: "color-mix(in srgb, var(--eg-danger) 10%, transparent)", color: "var(--eg-danger)" },
    ghost: { bg: "transparent", color: "var(--eg-text-secondary)" },
  };

  const style = variants[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
