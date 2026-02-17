import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  LucideIcon,
} from "lucide-react";

export interface SocialLink {
  href: string;
  icon: LucideIcon;
  label: string;
}

export interface FooterLink {
  href: string;
  label: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface ContactInfo {
  address: {
    line1: string;
    line2: string;
    line3: string;
  };
  email: string;
  phone: string;
}

export interface FooterConfig {
  companyName: {
    primary: string;
    secondary: string;
  };
  tagline: string;
  socialLinks: SocialLink[];
  sections: FooterSection[];
  contactInfo: ContactInfo;
  legal: {
    copyrightText: string;
    links: FooterLink[];
  };
}

export const footerConfig: FooterConfig = {
  companyName: {
    primary: "Fin",
    secondary: "Bridge",
  },
  tagline:
    "Offline-first conference continuity and relationship memory systems.",
  socialLinks: [
    {
      href: "https://twitter.com/finbridge",
      icon: Twitter,
      label: "Twitter",
    },
    {
      href: "https://linkedin.com/company/finbridge",
      icon: Linkedin,
      label: "LinkedIn",
    },
  ],
  sections: [
    {
      title: "Solutions",
      links: [
        { href: "/stall", label: "Stall Mode" },
        { href: "/field", label: "Field Mode" },
        { href: "/dashboard", label: "Discipline Dashboard" },
      ],
    },
    {
      title: "Platform",
      links: [
        { href: "/about", label: "About Us" },
        { href: "/security", label: "Security" },
        { href: "/api", label: "API Docs" },
      ],
    },
  ],
  contactInfo: {
    address: {
      line1: "Business Hub",
      line2: "Mumbai, Maharashtra",
      line3: "India",
    },
    email: "support@finbridge.io",
    phone: "+91 98765 43210",
  },
  legal: {
    copyrightText: "FinBridge. All rights reserved.",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
};
