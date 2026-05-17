import { CbtErrorBoundary } from "@/components/errors/cbt-error-boundary";

export default function ExamRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CbtErrorBoundary>{children}</CbtErrorBoundary>;
}
