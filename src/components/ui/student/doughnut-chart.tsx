import React from "react";

interface DoughnutChartProps {
  percentage: number;
  label: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function DoughnutChart({
  percentage,
  label,
  color = "var(--eg-accent)",
  size = 120,
  strokeWidth = 12,
}: DoughnutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--eg-border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--eg-text-primary)",
            fontFamily: "var(--eg-font-mono)",
          }}
        >
          {percentage}%
        </div>
      </div>
      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--eg-text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}
