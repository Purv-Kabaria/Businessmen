"use client";

export type Testimonial = {
  content: string;
  author: string;
  role: string;
  avatar: string;
  rating: number;
};

export const TESTIMONIALS_CONTENT = {
  id: "testimonials",
  eyebrow: "User Stories",
  title: "Trusted by Leading RMs",
  description:
    "See how FinBridge is transforming relationship continuity at major investment conferences.",
  items: [
    {
      content:
        "FinBridge saved us at the Mumbai Investment Summit. The hotel Wi-Fi was down, but we captured 200+ leads flawlessly. The AI snapshots are a game changer for prep.",
      author: "Vikram Malhotra",
      role: "Senior RM, Wealth Shield",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
    {
      content:
        "The deterministic ID feature prevented so many awkward double-conversations. Being able to see who my teammate met earlier that morning is invaluable.",
      author: "Ananya Iyer",
      role: "Director of Advisory, FinCore",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
    {
      content:
        "Finally, a CRM that doesn't feel like a data entry chore. The audio capture is the only way to get real context during a busy conference floor.",
      author: "Rajesh Varma",
      role: "Investment Advisor, Global Capital",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
    {
      content:
        "The follow-up discipline has improved our conversion rate by 15%. No lead ever goes stagnant anymore because the dashboard flags them immediately.",
      author: "Priya Singh",
      role: "Head of Sales, Elite Wealth",
      avatar:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
    {
      content:
        "Offline-first isn't just a feature; it's a necessity. FinBridge is the only system we've found that actually works in the chaos of a tech-heavy conference.",
      author: "Siddharth Goel",
      role: "Founder, Alpha Capital",
      avatar:
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
    {
      content:
        "The Tesseract OCR for business cards is surprisingly accurate even under poor lighting. It makes field mode incredibly fast for our team.",
      author: "Meera Nair",
      role: "Operations Lead, Trust Advisory",
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80",
      rating: 5,
    },
  ] as Testimonial[],
  communityAvatars: [
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&q=80",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&q=80",
  ],
} as const;
