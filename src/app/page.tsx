import Link from "next/link";
import { ArrowRight } from "lucide-react";

const accessCards = [
  {
    href: "/student/login",
    label: "Student",
    description: "Access tests, continue attempts, and review performance reports.",
  },
  {
    href: "/institute/login",
    label: "Institute",
    description: "Manage students, publish tests, and monitor academic progress.",
  },
  {
    href: "/parent/login",
    label: "Parent",
    description: "Track attendance, identify weak areas, and review score trends.",
  },
  {
    href: "/platform/login",
    label: "Administrator",
    description: "Manage platform infrastructure, onboarding, and operations.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--eg-background)] flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-4xl text-center mb-16">
        <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight text-[var(--eg-text-primary)] mb-4">
          Choose your workspace
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[var(--eg-text-secondary)]">
          Sign in to access your dashboard and continue your work.
        </p>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {accessCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col justify-between rounded-[24px] bg-white p-8 sm:p-10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,0,0,0.04)]"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}
          >
            <div>
              <h2 className="text-[20px] font-bold text-[var(--eg-text-primary)] mb-3">
                {card.label}
              </h2>
              <p className="text-[14px] leading-relaxed text-[var(--eg-text-secondary)]">
                {card.description}
              </p>
            </div>
            
            <div className="mt-8 flex items-center text-[13px] font-bold uppercase tracking-widest text-[var(--eg-accent)] transition-transform duration-300 group-hover:translate-x-1">
              Enter <ArrowRight size={14} className="ml-1.5" />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
