"use client";

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_CONTENT = {
  id: "faq",
  eyebrow: "FAQ",
  title: "Frequently Asked Questions",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
  items: [
    {
      question: "Placeholder",
      answer:
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus, officiis!",
    },
  ] as FaqItem[],
} as const;


