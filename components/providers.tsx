"use client";

import { ThemeProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: ThemeProviderProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NuqsAdapter>{children}</NuqsAdapter>
    </ThemeProvider>
  );
}