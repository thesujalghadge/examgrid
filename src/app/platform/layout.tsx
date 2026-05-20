import { PlatformShell } from "@/components/shells/platform-shell";
import { requireRole } from "@/lib/route-guards";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["super_admin"]);
  return <PlatformShell>{children}</PlatformShell>;
}
