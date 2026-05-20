import { InstituteShell } from "@/components/shells/institute-shell";
import { requireInstituteAccess, requireRole } from "@/lib/route-guards";

export default async function InstituteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["institute_admin", "teacher"]);
  await requireInstituteAccess();
  return <InstituteShell>{children}</InstituteShell>;
}
