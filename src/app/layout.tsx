import type { Metadata } from "next";
import { ClientProviders } from "@/components/providers/client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamGrid | Coaching Institute CBT Operations",
  description:
    "Workflow-first CBT operations for coaching institutes, students, parents, and platform teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#f5f1e8] font-sans antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
