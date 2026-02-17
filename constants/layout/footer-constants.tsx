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
    primary: "Place",
    secondary: "Holder",
  },
  tagline:
    "Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, quos?",
  socialLinks: [
    {
      href: "https://facebook.com",
      icon: Facebook,
      label: "Facebook",
    },
    {
      href: "https://twitter.com",
      icon: Twitter,
      label: "Twitter",
    },
    {
      href: "https://instagram.com",
      icon: Instagram,
      label: "Instagram",
    },
    {
      href: "https://linkedin.com",
      icon: Linkedin,
      label: "LinkedIn",
    },
  ],
  sections: [
    {
      title: "Placeholder1",
      links: [{ href: "/placeholder1", label: "Placeholder1" }],
    },
    {
      title: "Placeholder2",
      links: [{ href: "/placeholder2", label: "Placeholder2" }],
    },
  ],
  contactInfo: {
    address: {
      line1: "SVNIT",
      line2: "Surat, Gujarat, India",
      line3: "",
    },
    email: "contact@placeholder.com",
    phone: "+91 12345 67890",
  },
  legal: {
    copyrightText: "Placeholder. All rights reserved.",
    links: [],
  },
};
