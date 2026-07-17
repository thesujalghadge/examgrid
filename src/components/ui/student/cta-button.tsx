import React from "react";
import Link from "next/link";

interface CTAButtonProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  className?: string;
  style?: React.CSSProperties;
}

export function CTAButton({
  href,
  onClick,
  children,
  variant = "primary",
  className = "",
  style,
}: CTAButtonProps) {
  const baseClass =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold no-underline transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eg-accent)] focus-visible:ring-offset-2";

  const variantClass = {
    primary:
      "bg-[var(--eg-accent)] text-white shadow-[0_14px_30px_rgba(81,71,232,0.24)] hover:-translate-y-0.5 hover:bg-[var(--eg-accent-strong)] hover:shadow-[0_18px_38px_rgba(81,71,232,0.30)]",
    secondary:
      "bg-[var(--eg-accent-light)] text-[var(--eg-accent)] hover:bg-[color-mix(in_srgb,var(--eg-accent)_14%,white)]",
    outline:
      "border border-[var(--eg-border)] bg-white text-[var(--eg-text-primary)] hover:border-[var(--eg-accent)] hover:text-[var(--eg-accent)]",
    ghost:
      "min-h-0 rounded-xl px-0 text-[var(--eg-accent)] hover:text-[var(--eg-accent-strong)]",
  }[variant];

  const classes = `${baseClass} ${variantClass} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes} style={style}>
      {children}
    </button>
  );
}
