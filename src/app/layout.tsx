import type { Metadata } from "next";
import { ClientProviders } from "@/components/providers/client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamGrid · Institute CBT Operations",
  description:
    "Operational CBT platform for institute exam scheduling, delivery, and audit readiness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-100 font-sans antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
