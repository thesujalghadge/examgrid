import React from "react";

interface TrendIndicatorProps {
  trend: "up" | "down" | "neutral";
  value: string;
  dataPoints?: number[];
  colorOverride?: string;
}

export function TrendIndicator({ trend, value, dataPoints, colorOverride }: TrendIndicatorProps) {
  const trendColor = colorOverride
    ? colorOverride
    : trend === "up"
    ? "var(--eg-success)"
    : trend === "down"
    ? "var(--eg-danger)"
    : "var(--eg-text-tertiary)";

  const trendSymbol = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  // Simple sparkline path generator
  let sparklinePath = "";
  if (dataPoints && dataPoints.length > 1) {
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const range = max - min || 1;
    const width = 60;
    const height = 24;

    const points = dataPoints.map((pt, i) => {
      const x = (i / (dataPoints.length - 1)) * width;
      // Invert Y so higher values are higher up in SVG
      const y = height - ((pt - min) / range) * height;
      return `${x},${y}`;
    });

    // Smooth the line slightly by using bezier curves or simple lineTo
    sparklinePath = `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(" ");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: trendColor,
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}
      >
        <span>{trendSymbol}</span>
        <span>{value}</span>
      </p>

      {sparklinePath && (
        <svg width="60" height="24" viewBox="0 -4 60 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
          <path
            d={sparklinePath}
            stroke={trendColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
