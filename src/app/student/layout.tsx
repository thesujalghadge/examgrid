import { StudentShell } from "@/components/shells/student-shell";
import { requireRole } from "@/lib/route-guards";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["student"]);
  return <StudentShell>{children}</StudentShell>;
}
