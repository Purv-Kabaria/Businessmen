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
    secondary: "FinBridge",
  },
  description:
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
  ctas: {
    primary: { href: "/placeholder", label: "Placeholder" },
    secondary: { href: "/placeholder", label: "Placeholder" },
  },
  highlights: [
    { icon: Users, title: "50+", description: "Placeholder" },
    { icon: Calendar, title: "10K+", description: "Placeholder" },
    { icon: Heart, title: "50%", description: "Placeholder" },
    { icon: ShieldCheck, title: "100%", description: "Placeholder" },
  ] as HeroHighlight[],
} as const;


