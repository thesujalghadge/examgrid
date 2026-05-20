import { notFound } from "next/navigation";
import { PlaceholderPanel } from "@/components/workspace/placeholder-panel";

const COPY: Record<string, { title: string; description: string }> = {
  practice: {
    title: "Practice Workspace",
    description: "Adaptive practice sessions and topic-focused attempt flows.",
  },
  analytics: {
    title: "Student Analytics",
    description: "Personal score trends, section diagnostics, and progress insights.",
  },
  revision: {
    title: "Revision Hub",
    description: "Revision plans, weak-topic lists, and retry recommendations.",
  },
  "question-bank": {
    title: "Student Question Bank",
    description: "Role-filtered question exploration for practice and revision.",
  },
  profile: {
    title: "Student Profile",
    description: "Identity, batch allocation, and account preferences.",
  },
};

export default async function StudentSectionPage({
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
