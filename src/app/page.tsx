import Link from "next/link";

const accessCards = [
  {
    href: "/platform/login",
    label: "Platform Admin",
    description:
      "Manage institutes, access plans, onboarding support, and operational monitoring.",
  },
  {
    href: "/institute/login",
    label: "Institute",
    description:
      "Add students, organize batches, publish CBT tests, and review reports.",
  },
  {
    href: "/student/login",
    label: "Student",
    description:
      "Open upcoming tests, continue attempts, review reports, and practice PYQs.",
  },
  {
    href: "/parent/login",
    label: "Parent",
    description:
      "Track performance, attendance, weak areas, and progress summaries clearly.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_40%,#f7f4ee_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-[28px] border border-[#d8d2c7] bg-[#fbf9f4] p-6 shadow-[0_20px_60px_rgba(20,33,61,0.06)] md:p-10">
          <div className="max-w-3xl space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
              Coaching Institute CBT Operating System
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-[#14213d] md:text-5xl">
                Tests, analysis, and clarity in one operational flow.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#5e5a52] md:text-lg">
                ExamGrid is built for coaching institutes that need a simple and reliable way to
                publish CBTs, monitor attempts, and turn results into clear academic action.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[#5e5a52]">
              <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2">
                Upload or structure paper content
              </span>
              <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2">
                Configure and publish tests
              </span>
              <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2">
                Students attempt with low friction
              </span>
              <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2">
                Reports reach institute, student, and parent
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#14213d]">Choose your access</h2>
            <p className="text-sm text-[#5e5a52]">
              Every entry point is role-based and workflow-first. No dashboard maze.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {accessCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[24px] border border-[#d8d2c7] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8a6f3e] hover:shadow-[0_18px_36px_rgba(20,33,61,0.08)]"
              >
                <div className="space-y-3">
                  <p className="text-lg font-semibold text-[#14213d]">{card.label}</p>
                  <p className="text-sm leading-6 text-[#5e5a52]">{card.description}</p>
                  <p className="text-sm font-medium text-[#8a6f3e]">Open access</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
