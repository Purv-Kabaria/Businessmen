"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  BellRing,
  LineChart,
  BarChart,
  MessageSquareHeart,
  ShieldCheck,
  FileText,
  Users,
} from "lucide-react";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const FEATURES_CONTENT = {
  id: "features",
  eyebrow: "Features",
  title: "A Complete Toolkit for Placeholder",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
  items: [
    {
      icon: CalendarClock,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: BellRing,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: LineChart,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: BarChart,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: MessageSquareHeart,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: FileText,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: ShieldCheck,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
    {
      icon: Users,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
  ] as FeatureItem[],
} as const;


