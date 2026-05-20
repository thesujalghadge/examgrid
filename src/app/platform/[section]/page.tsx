import { notFound } from "next/navigation";
import { PlaceholderPanel } from "@/components/workspace/placeholder-panel";

const COPY: Record<string, { title: string; description: string }> = {
  institutes: {
    title: "Institute Tenants",
    description:
      "Manage institute onboarding, lifecycle, plan allocations, and tenant isolation controls.",
  },
  intelligence: {
    title: "Intelligence Layer",
    description:
      "Monitor scoring intelligence, predictive baselines, and recommendation orchestration readiness.",
  },
  "question-bank": {
    title: "Platform Question Bank",
    description:
      "Global question governance, metadata normalization, and review queue controls.",
  },
  ingestion: {
    title: "Ingestion Pipeline",
    description:
      "Track PYQ ingestion jobs, extraction quality, and verification backlog.",
  },
  "system-health": {
    title: "System Health",
    description:
      "Observe repository adapters, integrations, and service availability signals.",
  },
  review: {
    title: "Review Queue",
    description:
      "Resolve flagged content, moderation concerns, and quality escalations.",
  },
  analytics: {
    title: "Platform Analytics",
    description:
      "Cross-tenant usage, adoption, reliability, and operational intelligence trends.",
  },
};

export default async function PlatformSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const config = COPY[section];
  if (!config) notFound();
  return (
    <PlaceholderPanel title={config.title} description={config.description} />
  );
}
