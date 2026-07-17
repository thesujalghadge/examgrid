import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClientProviders } from "@/components/providers/client-providers";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ExamGrid | Coaching Institute CBT Operations",
  description:
    "Premium CBT operations for coaching institutes, students, parents, and platform teams.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ExamGrid",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full bg-background font-sans antialiased text-foreground">
        <ClientProviders>{children}</ClientProviders>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
