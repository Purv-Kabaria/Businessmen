"use client";

import type { LucideIcon } from "lucide-react";
import {
  Zap,
  Fingerprint,
  History,
  Cpu,
  ArrowRightCircle,
  LayoutDashboard,
  Users,
  ShieldCheck,
} from "lucide-react";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const FEATURES_CONTENT = {
  id: "features",
  eyebrow: "Core System",
  title: "Built for Conference Continuity",
  description:
    "A unified toolkit designed to preserve conversational context and enforce follow-up discipline under any conditions.",
  items: [
    {
      icon: Zap,
      title: "Offline-First Capture",
      description:
        "Data is saved locally to IndexedDB first. Capture never depends on a stable internet connection.",
    },
    {
      icon: Fingerprint,
      title: "Deterministic Identity",
      description:
        "Identity resolved via unique phone numbers. No fuzzy matching or probabilistic deduplication.",
    },
    {
      icon: History,
      title: "Immutable Timeline",
      description:
        "Append-only interaction memory. Never overwrite transcriptions or delete historical context.",
    },
    {
      icon: Cpu,
      title: "AI Context Pipeline",
      description:
        "Asynchronous Whisper transcription and LLM structured snapshots to compress interaction context.",
    },
    {
      icon: ArrowRightCircle,
      title: "Follow-Up Engine",
      description:
        "Enforceable stage transitions. Follow-up dates are mandatory before moving beyond the initial meeting.",
    },
    {
      icon: LayoutDashboard,
      title: "Discipline Dashboard",
      description:
        "Track pending and overdue follow-ups per RM. Focus on operational discipline, not revenue.",
    },
    {
      icon: Users,
      title: "Cross-Team Awareness",
      description:
        "Instant visibility into prior RM interactions with a contact to prevent duplicate conversations.",
    },
    {
      icon: ShieldCheck,
      title: "Secure Vault",
      description:
        "Private audio storage in MinIO and encrypted structured data in PostgreSQL for maximum security.",
    },
  ] as FeatureItem[],
} as const;


