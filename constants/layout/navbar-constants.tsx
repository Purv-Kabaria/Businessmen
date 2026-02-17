"use client";

import type { LucideIcon } from "lucide-react";
import {
  Store,
  MapPin,
  LayoutDashboard,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAVBAR = {
  logo: {
    light: "/images/logo-white.svg",
    dark: "/images/logo-white.svg",
    alt: "FinBridge Logo",
    width: 32,
    height: 32,
  },
  name: {
    primary: "Fin",
    secondary: "Bridge",
  },
  links: [
    { href: "/stall", label: "Stall Mode", icon: Store },
    { href: "/field", label: "Field Mode", icon: MapPin },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ] as NavLink[],
} as const;
