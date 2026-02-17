"use client";

import type { LucideIcon } from "lucide-react";
import { Users, Calendar, Heart, ShieldCheck } from "lucide-react";

export type HeroHighlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const HERO_CONTENT = {
  id: "hero",
  headline: {
    primary: "FinBridge,",
    secondary: "Offline-First Continuity",
  },
  description:
    "Built for investment advisory conferences. Ensure zero data loss, deterministic identity, and AI-powered relationship memory—even without internet.",
  ctas: {
    primary: { href: "/stall", label: "Open Stall Mode" },
    secondary: { href: "/field", label: "Enter Field Mode" },
  },
  highlights: [
    { icon: ShieldCheck, title: "100%", description: "Offline Reliability" },
    { icon: Users, title: "1-to-1", description: "Deterministic ID" },
    { icon: Heart, title: "Append", description: "Immutable Memory" },
    { icon: Calendar, title: "Sync", description: "Asynchronous Flow" },
  ] as HeroHighlight[],
} as const;


