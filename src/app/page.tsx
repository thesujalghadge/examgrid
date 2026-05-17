import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Calendar,
  GraduationCap,
  LineChart,
  Shield,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DashboardPanel,
  ProductMark,
  StatusBadge,
} from "@/components/shared/product-ui";
import { BRAND, BRAND_COLORS } from "@/config/brand";
import { DEMO_INSTITUTE } from "@/config/demo";
import { DEMO_LOGIN } from "@/data/demo-data";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    icon: BookOpen,
    title: "CBT infrastructure",
    body: "NTA-style delivery with integrity guards, timers, numerical input, and institute-scheduled exam windows.",
  },
  {
    icon: Brain,
    title: "PYQ intelligence",
    body: "Structured question bank with chapter tagging — foundation for pattern analysis and revision planning.",
  },
  {
    icon: BarChart3,
    title: "Operational analytics",
    body: "Audit trails, schedule visibility, and roster-aware assignments for accountable institute operations.",
  },
  {
    icon: LineChart,
    title: "Predictive test vision",
    body: "Roadmap toward readiness scoring and performance forecasting — designed for serious competitive prep.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--eg-canvas)] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-[var(--eg-border)] bg-white/90 backdrop-blur-md">
        <div className="eg-container flex items-center justify-between py-4">
          <ProductMark />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#platform" className="transition hover:text-[var(--eg-brand)]">
              Platform
            </a>
            <a href="#institutes" className="transition hover:text-[var(--eg-brand)]">
              Institutes
            </a>
            <a href="#students" className="transition hover:text-[var(--eg-brand)]">
              Students
            </a>
            <a href="#demo" className="transition hover:text-[var(--eg-brand)]">
              Demo
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Student
            </Link>
            <Link
              href="/admin/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[var(--eg-brand)] hover:bg-[var(--eg-brand-hover)]",
              )}
            >
              Institute
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[var(--eg-border)]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(15,39,68,0.12),transparent)]"
            aria-hidden
          />
          <div className="eg-container grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
            <div>
              <StatusBadge tone="blue">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Academic intelligence platform
              </StatusBadge>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Modernize how your institute runs competitive exams.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                {BRAND.name} unifies CBT delivery, question intelligence, scheduling,
                and operational visibility — so coaching centers run like
                serious academic infrastructure, not scattered spreadsheets.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/admin/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-[var(--eg-brand)] hover:bg-[var(--eg-brand-hover)]",
                  )}
                >
                  Institute console
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                  Student portal
                </Link>
              </div>
            </div>

            <DashboardPanel className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {DEMO_INSTITUTE.name}
                  </p>
                  <p className="text-xs text-slate-500">Operations snapshot</p>
                </div>
                <StatusBadge tone="green">Live demo</StatusBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Active batches", "3"],
                  ["Scheduled exams", "3"],
                  ["Students", "5"],
                  ["Audit coverage", "On"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-[var(--eg-border)] bg-slate-50/80 p-4"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--eg-brand)]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>
        </section>

        <section id="platform" className="border-b border-[var(--eg-border)] bg-white py-16 sm:py-20">
          <div className="eg-container">
            <p className="eg-section-title">Platform capabilities</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">
              Built for institutes modernizing competitive exam operations
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-xl border border-[var(--eg-border)] p-6 transition hover:border-[var(--eg-brand)]/20 hover:shadow-sm"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--eg-brand)]/10 text-[var(--eg-brand)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="institutes"
          className="border-b border-[var(--eg-border)] py-16 sm:py-20"
          style={{ background: `linear-gradient(180deg, ${BRAND_COLORS.canvas} 0%, white 100%)` }}
        >
          <div className="eg-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eg-section-title flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                For institutes
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Academic Operations Command Center
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Manage students, batches, question bank, exam assembly, schedules,
                and audit logs from one coherent console — designed for coaching
                admins who need reliability before flash.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {[
                  "Publish CBT papers from reusable question bank",
                  "Assign exams to batches with time windows",
                  "Trace operational actions for accountability",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--eg-brand)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <DashboardPanel>
              <p className="text-sm font-medium text-slate-950">Typical workflow</p>
              <ol className="mt-4 space-y-4">
                {[
                  ["Import & tag questions", "Build your institute PYQ-ready bank"],
                  ["Assemble & schedule exams", "Assign batches and open windows"],
                  ["Monitor delivery", "Students enter CBT with integrity guards"],
                  ["Review outcomes", "Results and audit for follow-up"],
                ].map(([step, sub], i) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--eg-brand)] text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium text-slate-950">{step}</span>
                      <span className="mt-0.5 block text-sm text-slate-500">
                        {sub}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </DashboardPanel>
          </div>
        </section>

        <section id="students" className="border-b border-[var(--eg-border)] bg-white py-16 sm:py-20">
          <div className="eg-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <DashboardPanel className="order-2 lg:order-1">
              <p className="text-sm font-medium text-slate-950">Student journey</p>
              <div className="mt-4 flex flex-col gap-3">
                {["Login", "View assigned exams", "Instructions & declaration", "CBT session", "Results"].map(
                  (step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-lg border border-[var(--eg-border)] px-4 py-3"
                    >
                      <Calendar className="h-4 w-4 text-[var(--eg-brand)]" />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium text-slate-950">{i + 1}.</span>{" "}
                        {step}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </DashboardPanel>
            <div className="order-1 lg:order-2">
              <p className="eg-section-title flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                For students
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Exam-focused, trustworthy, distraction-free
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Students see only their assigned exams, clear countdowns, and a
                familiar NTA-style interface — so they focus on the paper, not the
                software.
              </p>
            </div>
          </div>
        </section>

        <section id="demo" className="eg-container py-16 sm:py-20">
          <DashboardPanel className="bg-[var(--eg-brand)] text-white">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-2xl font-semibold">Explore the {DEMO_INSTITUTE.name} demo</h2>
                <p className="mt-2 max-w-xl text-blue-100/90">
                  Seed the environment from the admin dashboard and walk through a
                  full institute + student examination flow.
                </p>
                <div className="mt-6 rounded-lg bg-white/10 p-4 text-sm backdrop-blur">
                  <p>
                    <span className="text-blue-100">Admin:</span>{" "}
                    {DEMO_LOGIN.adminEmail} / {DEMO_LOGIN.adminPassword}
                  </p>
                  <p className="mt-1">
                    <span className="text-blue-100">Student roll:</span>{" "}
                    {DEMO_LOGIN.studentRoll}
                  </p>
                </div>
              </div>
              <Link
                href="/admin/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-white text-[var(--eg-brand)] hover:bg-blue-50",
                )}
              >
                Start demo
              </Link>
            </div>
          </DashboardPanel>
        </section>
      </main>

      <footer className="border-t border-[var(--eg-border)] bg-white py-8 text-center text-sm text-slate-500">
        <p>
          {BRAND.name} · {BRAND.tagline}
        </p>
      </footer>
    </div>
  );
}

