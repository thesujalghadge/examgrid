"use client";

import { ArrowRight, Target } from "lucide-react";
import { CTAButton } from "@/components/ui/student/cta-button";

interface HeroProps {
  greeting: string;
  recommendation: string;
  ctaText: string;
  ctaHref: string;
}

export function DashboardHero({ greeting, recommendation, ctaText, ctaHref }: HeroProps) {
  // If the greeting contains a comma, let's lightly highlight the name
  const parts = greeting.split(", ");
  const timeOfDay = parts[0];
  const namePart = parts[1] || "";

  return (
    <section
      aria-label="Today's focus"
      className="eg-animate-in relative overflow-hidden rounded-[24px]"
      style={{
        background: "linear-gradient(145deg, #ffffff, #fafbfa)",
        border: "1px solid var(--eg-border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-12">
        
        {/* Left Side: Content */}
        <div className="flex-1 max-w-2xl relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <span style={{ 
              fontSize: "11px", 
              fontWeight: 700, 
              letterSpacing: "0.15em", 
              textTransform: "uppercase", 
              color: "var(--eg-text-tertiary)" 
            }}>
              TODAY'S FOCUS
            </span>
          </div>
          
          <h1 style={{ 
            fontSize: "clamp(32px, 4vw, 44px)", 
            fontWeight: 700, 
            lineHeight: 1.1, 
            letterSpacing: "-0.02em", 
            color: "var(--eg-text-primary)",
            marginBottom: "16px"
          }}>
            {timeOfDay}{parts.length > 1 ? ", " : ""}
            {parts.length > 1 && <span style={{ color: "var(--eg-text-secondary)" }}>{namePart}</span>}
          </h1>
          
          <p style={{ 
            fontSize: "16px", 
            lineHeight: 1.6, 
            color: "var(--eg-text-secondary)", 
            marginBottom: "32px",
            fontWeight: 400 
          }}>
            {recommendation}
          </p>
          
          <CTAButton href={ctaHref} variant="primary" style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600 }}>
            {ctaText.replace("->", "").replace("→", "").trim()}
          </CTAButton>
        </div>

        {/* Right Side: Subtle Visual Block */}
        <div className="hidden md:flex flex-shrink-0 items-center justify-center relative w-[180px] h-[180px]">
          {/* Extremely soft, minimal concentric rings for "Focus" concept */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.03)",
            background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.01) 100%)",
          }} />
          <div style={{
            position: "absolute",
            inset: "30px",
            borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.04)",
            background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.02) 100%)",
          }} />
          <div style={{
            position: "absolute",
            inset: "60px",
            borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.06)",
            background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.03) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
             <Target size={24} style={{ color: "var(--eg-text-tertiary)", opacity: 0.6 }} strokeWidth={1.5} />
          </div>
        </div>
        
      </div>
    </section>
  );
}

export function DashboardHeroSkeleton() {
  return (
    <section 
      className="rounded-[24px] px-8 py-12" 
      aria-label="Today focus loading"
      style={{
        border: "1px solid var(--eg-border)",
        background: "#ffffff"
      }}
    >
      <div className="eg-skeleton mb-6 h-3 w-28" />
      <div className="eg-skeleton mb-4 h-12 w-3/4 max-w-md" />
      <div className="eg-skeleton mb-8 h-5 w-4/5 max-w-lg" />
      <div className="eg-skeleton h-10 w-36 rounded-lg" />
    </section>
  );
}
