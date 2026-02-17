export const STALL_INTENTS = [
  "Wealth Management",
  "Tax Planning",
  "PMS Investment",
  "Networking",
  "Just Inquiry",
] as const;

export type StallIntent = (typeof STALL_INTENTS)[number];
