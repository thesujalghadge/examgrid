"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Building2, Brain, Database, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductMark } from "@/components/shared/product-ui";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "institute", label: "Institute details" },
  { id: "mode", label: "Operational mode" },
  { id: "complete", label: "Ready to launch" },
];

const MODES = [
  {
    id: "full-ai",
    title: "Full Cambridge AI Mode",
    description: "Use our generated tests, predictive models, and PYQ analytics.",
    icon: Brain,
    recommended: true,
  },
  {
    id: "hybrid",
    title: "Hybrid Mode",
    description: "Mix your own custom content with our CBT engine and analytics.",
    icon: Database,
  },
  {
    id: "infrastructure",
    title: "Infrastructure Only",
    description: "Use the platform strictly for delivery, scheduling, and white-labeling.",
    icon: Cloud,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [instituteName, setInstituteName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [selectedMode, setSelectedMode] = useState("full-ai");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const completeOnboarding = () => {
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      router.push("/admin");
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Left Panel - Visual/Brand */}
      <div className="hidden w-1/3 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <ProductMark />
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">
            Academic operations, modernized.
          </h2>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed text-body-large">
            Join hundreds of premier coaching institutes powering their CBT
            infrastructure and student intelligence through ExamGrid.
          </p>
        </div>
        <div className="text-sm font-medium text-primary-foreground/50">
          © {new Date().getFullYear()} Cambridge Academy
        </div>
      </div>

      {/* Right Panel - Form/Wizard */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-24 bg-background">
        <div className="mx-auto w-full max-w-xl">
          {/* Progress Indicator */}
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      idx < currentStep
                        ? "border-primary bg-primary text-primary-foreground"
                        : idx === currentStep
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                    )}
                  >
                    {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={cn(
                    "hidden sm:block text-xs font-medium uppercase tracking-wider",
                    idx <= currentStep ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
              <div className="absolute left-[30%] right-[30%] top-[4.5rem] -z-10 hidden h-[2px] bg-border sm:block lg:left-[45%] lg:right-[15%]" />
            </div>
          </div>

          {/* Step 1: Institute Details */}
          {currentStep === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Create your workspace
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Let's start by setting up your institute's identity.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Institute Name</Label>
                  <Input
                    id="name"
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    placeholder="e.g. Apex Academy"
                    className="h-11"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Workspace URL</Label>
                  <div className="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                    <span className="pl-3 text-muted-foreground text-sm font-mono select-none">
                      examgrid.com/
                    </span>
                    <input
                      id="subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="h-11 flex-1 bg-transparent px-2 text-sm font-mono outline-none"
                      placeholder="apex-academy"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-10 flex justify-end">
                <Button onClick={nextStep} disabled={!instituteName || !subdomain} size="lg">
                  Continue to setup <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Operational Mode */}
          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Choose operational mode
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  How do you plan to use ExamGrid? You can always change this later.
                </p>
              </div>
              <div className="space-y-4">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = selectedMode === mode.id;
                  return (
                    <div
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={cn(
                        "relative flex cursor-pointer gap-4 rounded-xl border p-5 transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                          : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h3 className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                            {mode.title}
                          </h3>
                          {mode.recommended && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {mode.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-10 flex justify-between">
                <Button variant="ghost" onClick={prevStep}>
                  Back
                </Button>
                <Button onClick={nextStep} size="lg">
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Check className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  You're all set!
                </h1>
                <p className="text-muted-foreground mt-2 text-sm mx-auto max-w-sm">
                  We've configured <strong className="text-foreground">{instituteName}</strong> to run in <strong className="text-foreground">{MODES.find(m => m.id === selectedMode)?.title}</strong>.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4">Next steps waiting in your dashboard:</h3>
                <ul className="space-y-3">
                  {[
                    "Import your student roster (CSV support)",
                    "Create your first batch",
                    "Generate a mock test blueprint"
                  ].map((step, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted">
                        {i + 1}
                      </div>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 flex justify-between">
                <Button variant="ghost" onClick={prevStep} disabled={isSubmitting}>
                  Back
                </Button>
                <Button onClick={completeOnboarding} size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Building workspace..." : "Go to Dashboard"} 
                  {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrowRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
