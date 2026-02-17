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
    "Everything you need to know about the FinBridge offline-first conference system.",
  items: [
    {
      question: "What does 'offline-first' actually mean for conference use?",
      answer:
        "It means you can capture every contact, business card, and voice note without any internet connection. The data is saved to your device's IndexedDB and automatically synced once a stable connection is detected.",
    },
    {
      question: "How does deterministic identity prevent duplicate contacts?",
      answer:
        "We use the phone number as the unique identifier. If you scan a lead who was already met by another Relationship Manager, FinBridge immediately pulls up their existing profile and interaction history.",
    },
    {
      question: "What is the AI Pipeline and does it require internet?",
      answer:
        "The AI Pipeline handles transcription and context compression (snapshots). While capture is offline, the AI processing happens asynchronously in the cloud or local worker once synced, ensuring the UI remains fast.",
    },
    {
      question: "Can I use external LLMs or local models?",
      answer:
        "FinBridge is designed to be flexible. You can connect it to external APIs like OpenAI/Anthropic or run local models via the FastAPI AI worker for maximum data privacy.",
    },
    {
      question: "How is the follow-up discipline enforced?",
      answer:
        "The system prevents moving leads to subsequent stages (like 'Engaged' or 'Meeting') unless a follow-up date has been committed. Overdue follow-ups are flagged on the RM dashboard.",
    },
  ] as FaqItem[],
} as const;


