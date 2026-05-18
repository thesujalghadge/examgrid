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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="eg-container flex items-center justify-between py-4">
          <ProductMark />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-primary">
              Platform
            </a>
            <a href="#institutes" className="transition-colors hover:text-primary">
              Institutes
            </a>
            <a href="#students" className="transition-colors hover:text-primary">
              Students
            </a>
            <a href="#demo" className="transition-colors hover:text-primary">
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
                "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Institute
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 to-background">
          <div className="eg-container grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
            <div>
              <StatusBadge tone="blue">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Academic intelligence platform
              </StatusBadge>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Modernize how your institute runs competitive exams.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {BRAND.name} unifies CBT delivery, question intelligence, scheduling,
                and operational visibility — so coaching centers run like
                serious academic infrastructure, not scattered spreadsheets.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/admin/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-primary text-primary-foreground hover:bg-primary/90",
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

            <DashboardPanel className="relative border-primary/20 shadow-xl shadow-primary/5 bg-card/80 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {DEMO_INSTITUTE.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Operations snapshot</p>
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
                    className="rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-primary">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>
        </section>

        <section id="platform" className="border-b border-border bg-background py-16 sm:py-20">
          <div className="eg-container">
            <p className="text-meta text-primary">Platform capabilities</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground">
              Built for institutes modernizing competitive exam operations
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
          className="border-b border-border py-16 sm:py-20 bg-muted/20"
        >
          <div className="eg-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-meta text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                For institutes
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Academic Operations Command Center
              </h2>
              <p className="mt-4 text-muted-foreground text-body-large">
                Manage students, batches, question bank, exam assembly, schedules,
                and audit logs from one coherent console — designed for coaching
                admins who need reliability before flash.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                {[
                  "Publish CBT papers from reusable question bank",
                  "Assign exams to batches with time windows",
                  "Trace operational actions for accountability",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <DashboardPanel className="shadow-sm">
              <p className="text-sm font-medium text-foreground">Typical workflow</p>
              <ol className="mt-5 space-y-5">
                {[
                  ["Import & tag questions", "Build your institute PYQ-ready bank"],
                  ["Assemble & schedule exams", "Assign batches and open windows"],
                  ["Monitor delivery", "Students enter CBT with integrity guards"],
                  ["Review outcomes", "Results and audit for follow-up"],
                ].map(([step, sub], i) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary border border-primary/20">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{step}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {sub}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </DashboardPanel>
          </div>
        </section>

        <section id="students" className="border-b border-border bg-background py-16 sm:py-20">
          <div className="eg-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <DashboardPanel className="order-2 lg:order-1 shadow-sm">
              <p className="text-sm font-medium text-foreground">Student journey</p>
              <div className="mt-5 flex flex-col gap-3">
                {["Login", "View assigned exams", "Instructions & declaration", "CBT session", "Results"].map(
                  (step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
                    >
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground mr-1">{i + 1}.</span>{" "}
                        {step}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </DashboardPanel>
            <div className="order-1 lg:order-2">
              <p className="text-meta text-primary flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                For students
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Exam-focused, trustworthy, distraction-free
              </h2>
              <p className="mt-4 text-muted-foreground text-body-large">
                Students see only their assigned exams, clear countdowns, and a
                familiar NTA-style interface — so they focus on the paper, not the
                software.
              </p>
            </div>
          </div>
        </section>

        <section id="demo" className="eg-container py-16 sm:py-24">
          <DashboardPanel className="bg-primary text-primary-foreground border-transparent shadow-xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-white">Explore the {DEMO_INSTITUTE.name} demo</h2>
                <p className="mt-3 max-w-xl text-primary-foreground/80 text-body-large">
                  Seed the environment from the admin dashboard and walk through a
                  full institute + student examination flow.
                </p>
                <div className="mt-8 rounded-lg bg-black/10 border border-white/10 p-5 text-sm backdrop-blur-md">
                  <p>
                    <span className="text-primary-foreground/60 w-24 inline-block">Admin:</span>{" "}
                    <span className="font-mono">{DEMO_LOGIN.adminEmail}</span> / <span className="font-mono">{DEMO_LOGIN.adminPassword}</span>
                  </p>
                  <p className="mt-2">
                    <span className="text-primary-foreground/60 w-24 inline-block">Student roll:</span>{" "}
                    <span className="font-mono">{DEMO_LOGIN.studentRoll}</span>
                  </p>
                </div>
              </div>
              <Link
                href="/admin/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-white text-primary hover:bg-slate-50 border border-white/20 shadow-sm",
                )}
              >
                Start demo
              </Link>
            </div>
          </DashboardPanel>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-8 text-center text-sm text-muted-foreground">
        <p>
          {BRAND.name} · {BRAND.tagline}
        </p>
      </footer>
    </div>
  );
}
