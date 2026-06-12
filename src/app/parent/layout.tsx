import { ParentShell } from "@/components/shells/parent-shell";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentShell>{children}</ParentShell>;
}
