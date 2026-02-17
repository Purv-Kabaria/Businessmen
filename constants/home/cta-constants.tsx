import {
  CalendarCheck,
  HeartPulse,
  BarChart,
  Bell,
  LucideIcon,
} from "lucide-react";

export interface CTABadge {
  text: string;
}

export interface CTAHeading {
  title: string;
  subtitle: string;
}

export interface CTAFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface CTAButton {
  text: string;
  href: string;
  variant: "primary" | "secondary";
}

export interface DashboardItem {
  icon: LucideIcon;
  title: string;
  time: string;
  content: string;
}

export interface CTADashboard {
  title: string;
  patientName: string;
  items: DashboardItem[];
}

export interface CTAConfig {
  badge: CTABadge;
  heading: CTAHeading;
  features: CTAFeature[];
  buttons: CTAButton[];
  dashboard: CTADashboard;
}

export const ctaConfig: CTAConfig = {
  badge: {
    text: "Placeholder",
  },
  heading: {
    title: "Placeholder",
    subtitle:
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
  },
  features: [
    {
      icon: CalendarCheck,
      title: "Placeholder",
      description: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
    },
    {
      icon: HeartPulse,
      title: "Placeholder",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
    },
  ],
  buttons: [
    {
      text: "Placeholder",
      href: "/signup",
      variant: "primary",
    },
    {
      text: "Placeholder",
      href: "/tour",
      variant: "secondary",
    },
  ],
  dashboard: {
    title: "Placeholder",
    patientName: "Placeholder",
    items: [
      {
        icon: CalendarCheck,
        title: "Placeholder",
        time: "Placeholder",
        content:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
      },
      {
        icon: BarChart,
        title: "Placeholder",
        time: "Placeholder",
        content:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
      },
      {
        icon: Bell,
        title: "Placeholder",
        time: "Placeholder",
        content:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
      },
    ],
  },
};
