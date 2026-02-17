import type { Metadata, Viewport } from "next";
import { Oxanium, Merriweather, Fira_Code } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { SyncOrchestratorLoader } from "@/components/offline/sync-orchestrator-loader";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

const APP_NAME = "FinBridge";
const APP_DESCRIPTION = "FinBridge - Capture and manage contacts";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  icons: {
    icon: "/images/logo-white.svg",
    apple: "/images/logo-white.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

const sans = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
});

const mono = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased ${sans.variable} ${serif.variable} ${mono.variable}`}>
        <Providers>
          <SyncOrchestratorLoader />
          {children}
          <Toaster />
          <PWAInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}