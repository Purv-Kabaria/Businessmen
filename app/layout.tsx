import type { Metadata } from "next";
import { Oxanium, Merriweather, Fira_Code } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Template",
  description: "Template",
  icons: {
    icon: "/images/logo.svg",
  },
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
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}