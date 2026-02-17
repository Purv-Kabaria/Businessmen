"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAVBAR = {
  logo: {
    light: "/images/logo.svg",
    dark: "/images/logo.svg",
    alt: "Placeholder Logo",
    width: 32,
    height: 32,
  },
  name: {
    primary: "Place",
    secondary: "Holder",
  },
  links: [
    { href: "/placeholder", label: "Placeholder", icon: LayoutDashboard },
  ] as NavLink[],
} as const;
