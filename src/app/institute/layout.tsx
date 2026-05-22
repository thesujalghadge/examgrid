import { InstituteShell } from "@/components/shells/institute-shell";

export default function InstituteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InstituteShell>{children}</InstituteShell>;
}
