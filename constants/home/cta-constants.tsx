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
  contactName: string;
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
    text: "Conference Ready",
  },
  heading: {
    title: "Preserve Continuity Everywhere",
    subtitle:
      "Maintain the thread of every conversation, from the booth to the field, without missing a single detail.",
  },
  features: [
    {
      icon: CalendarCheck,
      title: "Scheduled Follow-ups",
      description: "Automated reminders ensure no lead ever goes stagnant after the conference.",
    },
    {
      icon: HeartPulse,
      title: "Relationship Vitals",
      description:
        "AI-extracted snapshots provide critical context on risk sentiment and preferences.",
    },
  ],
  buttons: [
    {
      text: "Start Capturing",
      href: "/auth/signup",
      variant: "primary",
    },
    {
      text: "View Dashboard",
      href: "/dashboard",
      variant: "secondary",
    },
  ],
  dashboard: {
    title: "Relationship Timeline",
    contactName: "Rahul Sharma",
    items: [
      {
        icon: CalendarCheck,
        title: "Initial Meeting",
        time: "10:30 AM",
        content:
          "Interested in PMS. Concerned about local market volatility.",
      },
      {
        icon: BarChart,
        title: "AI Snapshot",
        time: "11:00 AM",
        content:
          "Sentiment: Cautious. Next Step: Send brochure via WhatsApp.",
      },
      {
        icon: Bell,
        title: "Follow-up Set",
        time: "11:15 AM",
        content:
          "Scheduled for Feb 24th by RM: Amit Varma.",
      },
    ],
  },
};
