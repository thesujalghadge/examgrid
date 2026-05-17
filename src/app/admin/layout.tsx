import { AdminShell } from "@/components/admin/admin-shell";
import { AdminErrorBoundary } from "@/components/errors/admin-error-boundary";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminErrorBoundary>
      <AdminShell>{children}</AdminShell>
    </AdminErrorBoundary>
  );
}
