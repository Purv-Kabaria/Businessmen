# FinBridge – Offline-First Conference Continuity & Follow-Up System

---

# 1️⃣ Project Overview

## Objective
Build a unified, offline-first follow-up and relationship continuity system for investment advisory conferences.

## Core Principles
- Offline-first capture
- Deterministic identity (phone-based UNIQUE key)
- Append-only interaction memory
- AI-powered context compression (NOT revenue prediction)
- Follow-up discipline enforcement
- Cross-team awareness
- Zero data loss under poor connectivity

## Non-Goals
- Revenue prediction engines
- Probabilistic deduplication
- Fancy ROI dashboards
- Overengineered microservices

---

# 2️⃣ System Architecture

## High-Level Architecture

User Device (Offline First)
    |
IndexedDB (Contacts + Audio Blobs)
    |
Background Sync Engine
    |
Next.js API Layer
    |
PostgreSQL (Structured Data)
    |
MinIO (Object Storage - Audio Files)
    |
AI Worker (Whisper + LLM + Validation)

## Architectural Principles

- Capture never depends on internet.
- Audio stored locally first.
- Sync is asynchronous and retry-based.
- AI processing never blocks UI.
- Identity resolved deterministically via phone number.
- Interactions are immutable (append-only).
- CRM works even if AI layer fails.

---

# 3️⃣ Final Tech Stack

## Frontend
- Next.js 15 (App Router)
- next-pwa
- Dexie.js (IndexedDB wrapper)
- TailwindCSS + ShadCN
- Web Audio API
- Tesseract.js (Business card OCR)

## Backend
- Next.js API Routes
- PostgreSQL (Docker)
- Prisma ORM (or direct pg driver)

## Object Storage
- MinIO (Docker, S3-compatible)

## AI Worker
- FastAPI (Python)
- Whisper.cpp (transcription)
- spaCy (NER + deterministic extraction)
- LLM (Local model or external API)
- Pydantic validation

## Infrastructure
- Docker Compose:
  - Next.js
  - PostgreSQL
  - MinIO
  - AI Worker

---

# 4️⃣ Database Schema

## Contacts Table

CREATE TABLE contacts (
    id UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT UNIQUE NOT NULL,
    current_stage TEXT DEFAULT 'Met',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

## Interactions Table (Append-only)

CREATE TABLE interactions (
    id UUID PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    audio_object_key TEXT,
    transcript TEXT,
    structured_snapshot JSONB,
    tags JSONB,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

## Followups Table

CREATE TABLE followups (
    id UUID PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    due_date TIMESTAMP,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT NOW()
);

## AI Jobs Table

CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY,
    interaction_id UUID REFERENCES interactions(id),
    status TEXT DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

---

# 5️⃣ Offline Capture Flow

## Stall Mode Flow

1. Open Kiosk Mode.
2. Enter Name + Phone (mandatory).
3. Optional: Email, tags.
4. Save locally to IndexedDB.
5. Confirm “Saved Offline”.

## Field Mode Flow

1. Scan business card OR enter phone.
2. Add quick tags.
3. Record short audio note.
4. Save locally with UUID.
5. Mark as pending_sync = true.

## Offline Rules

- No blocking network calls.
- Audio stored as Blob in IndexedDB.
- Local UUID generated per record.
- Minimal required fields: name + phone.

---

# 6️⃣ Sync Engine

## Client-Side Sync Logic

if (navigator.onLine) {
    fetchUnsyncedRecords()
        .forEach(record => {
            POST /api/sync
        });

    if (serverSuccess) {
        markAsSynced();
    } else {
        retryWithBackoff();
    }
}

## Server-Side Sync Rules

- Upsert contact using phone number.
- Append new interaction (never overwrite).
- Upload audio to MinIO.
- Create AI job entry.
- Return canonical contact data.

## Conflict Handling

- Phone number UNIQUE constraint prevents duplication.
- If contact exists:
  - Reuse existing contact_id.
  - Append new interaction.

---

# 7️⃣ Deterministic Identity Engine

## Rule

Phone number is UNIQUE.

## On New Scan

1. Query contact by phone.
2. If exists:
   - Show prior interaction snapshot.
   - Display RM name + last meeting date.
3. If not:
   - Create new contact.

No fuzzy matching.
No probabilistic scoring.
Fully deterministic resolution.

---

# 8️⃣ Context Vault (Immutable Timeline)

## Design

- Interactions are append-only.
- Never overwrite transcript.
- Never delete historical entries.
- Each interaction tied to created_by RM.

## Timeline View

Met
  → Audio Note
  → Snapshot
  → Follow-up
  → Meeting
  → Outcome

This ensures relationship continuity.

---

# 9️⃣ AI Conversation Processing Pipeline

Audio
  ↓
Whisper Transcription
  ↓
Pre-cleaning
  ↓
Deterministic Extraction
  ↓
LLM Structured JSON Output
  ↓
Validation Layer
  ↓
Save Structured Snapshot

## AI Job Worker (Pseudo Code)

job = fetch_pending_job()
transcript = whisper(audio)
deterministic_data = regex_extract(transcript)
llm_output = structured_llm_call(transcript)
validated = validate_output(llm_output, deterministic_data)

if validated:
    save_snapshot()
    mark_job_complete()
else:
    fallback_to_deterministic()

## AI Constraints

- Asynchronous processing.
- LLM must output strict JSON.
- Temperature low (<= 0.3).
- Reject non-JSON output.
- Validate numeric and enum fields.

AI augments CRM.
AI never blocks CRM.

---

# 🔟 Conversation Snapshot Format

Example JSON:

{
  "summary_points": [
    "Interested in PMS",
    "Concerned about volatility",
    "Prefers WhatsApp"
  ],
  "agreed_next_step": "Send brochure",
  "risk_sentiment": "cautious",
  "confidence": 87
}

Displayed in UI as:
“Conversation Snapshot”

Purpose:
Improve meeting preparedness.
Not predict revenue.

---

# 1️⃣1️⃣ Follow-Up Orchestration Engine

## Stage Flow

Met → Follow-up → Engaged → Meeting → Outcome

## Rules

- Cannot skip stages.
- Follow-up date required before moving from Met.
- Overdue follow-ups flagged.
- Stage stagnation detection (> X days).

Example Rule:

if (stage === "Follow-up" && !due_date) {
    throw Error("Follow-up date required");
}

---

# 1️⃣2️⃣ Follow-Up Discipline Dashboard

## Metrics

Per RM:
- Pending follow-ups
- Overdue follow-ups
- Average follow-up delay
- Stagnant contacts (> threshold days)

Focus:
Operational discipline.
Not revenue analytics.

---

# 1️⃣3️⃣ Cross-Team Awareness

When phone already exists:

Display:

- Previously met by: <RM Name>
- Last interaction date
- Snapshot summary
- Current stage

Purpose:
Prevent duplicate awkward conversations.
Ensure continuity.

---

# 1️⃣4️⃣ Coding Order (Strict Execution Plan)

## Phase 1
- Database schema
- API routes for contacts + interactions
- Unique phone constraint

## Phase 2
- Offline capture (IndexedDB + audio)
- Stall + Field flows

## Phase 3
- Sync engine
- MinIO upload integration
- Conflict resolution testing

## Phase 4
- Follow-up stage logic
- Discipline dashboard

## Phase 5
- AI worker integration
- Whisper transcription
- Snapshot generation

## Phase 6
- UI polish
- Cross-team awareness display
- Demo testing

AI is enhancement.
Offline reliability is foundation.

---

# 1️⃣5️⃣ Failure Handling Strategy

## If Internet Fails
- Continue local capture.
- Mark records pending_sync.

## If MinIO Fails
- Retry upload.
- Local blob remains authoritative.

## If AI Fails
- CRM remains fully usable.
- Retry AI job with backoff.

## If Duplicate Phone
- UNIQUE constraint prevents duplication.
- System reuses existing contact_id.

---

# 1️⃣6️⃣ Security & Data Principles

- Audio stored in private MinIO bucket.
- Structured data stored in Postgres.
- LLM receives transcript only (no raw audio if external API).
- Strict validation before persistence.
- No blind AI trust.

---

# 1️⃣7️⃣ Design Philosophy Summary

- Offline-first is a constraint, not a feature.
- Identity must be deterministic.
- Interactions are immutable.
- AI augments, never blocks.
- Follow-up discipline > revenue prediction.
- Simplicity > flashy intelligence.
- Build reliability first, intelligence second.

---

# Final Product Positioning

FinBridge is an offline-first conversation continuity and follow-up discipline system designed specifically for investment advisory conferences operating under unreliable network conditions.

It guarantees:
- No data loss
- No duplicate identity confusion
- Preserved conversational context
- Structured follow-up discipline
- AI-enhanced meeting preparedness

This document serves as the authoritative implementation guide for the AI coding agent.

cd python_backend
venv\Scripts\activate