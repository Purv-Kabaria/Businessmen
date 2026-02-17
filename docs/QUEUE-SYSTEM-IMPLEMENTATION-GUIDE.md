# Queue System Implementation Guide

Guide for implementing **two queues** in FinBridge: **contacts queue** (sync to DB when online) and **audio transcripts queue** (generate transcript via LLM when online). Visiting card details are extracted with a **local model** — no queue for card processing.

**Queue layers:** Client = IndexedDB (pending buffer); Server = **BullMQ** (Redis). When online, client sends pending data to API; API enqueues jobs to BullMQ; workers process (contacts → DB, audio → LLM → transcript).

**Cost focus:** This guide recommends cost-effective resources (free-tier Redis, in-process workers, small/cheap LLM usage, minimal infra).

---

## 1. Scope and Goals

### 1.1 Queues (Two Only)

| Queue | Purpose | Client (offline buffer) | Server (BullMQ) |
|-------|---------|-------------------------|-----------------|
| **Contacts** | Sync contacts to DB when online. | IndexedDB `contacts` with `pending_sync: true`. | BullMQ queue `contacts-sync`; worker upserts to DB. |
| **Audio transcripts** | Generate transcript via LLM when online. | IndexedDB `audio_transcript_queue`. | BullMQ queue `audio-transcript`; worker calls LLM, saves transcript. |

### 1.2 Out of Scope (No Queue)

- **Visiting card** – Details are fetched using a **local model** (no server/API). No queue; card data is used immediately in the form.

### 1.3 Implementation Focus

- **Client queue**: IndexedDB stores, enqueue, get pending, update status (client drains and POSTs to API when online).
- **Server queue (BullMQ)**: Redis, two BullMQ queues, API routes that enqueue jobs, workers that process jobs (contacts → DB, audio → LLM + save).

### 1.4 Success Criteria

- Offline: contacts and audio items stored in client IndexedDB without loss.
- When online: client sends pending data to API; API enqueues to BullMQ; workers process (contacts to DB, audio to transcript).
- BullMQ: retries and idempotent job handling.

---

## 2. System Design

### 2.1 High-Level Flow

```
[Client — offline]
  Stall/Field submit contact     → IndexedDB contacts (pending_sync: true)
  Field/Interaction save audio  → IndexedDB audio_transcript_queue (pending)

[Client — when online]
  getUnsyncedContacts()          → POST /api/sync/contacts (body: contacts[])
  getPendingAudioTranscriptItems() → POST /api/sync/audio (body: items with blob + refs)
  On 2xx: updateContact(..., pending_sync: false) / updateAudioTranscriptItemStatus(..., done)

[Server — API]
  POST /api/sync/contacts  → for each contact, contactsSyncQueue.add('upsert', { contact })
  POST /api/sync/audio     → for each item, audioTranscriptQueue.add('generate', { ... })

[Server — BullMQ workers]
  contacts-sync worker     → job: upsert contact to DB (Prisma)
  audio-transcript worker  → job: call LLM, save transcript (e.g. Interaction)
```

### 2.2 Data Models

**Contacts queue**

- Reuses existing **`contacts`** store in `modules/capture/db.ts`.
- **Queue view**: items with `pending_sync === true`.
- **Enqueue**: `addContact(contact)` with `pending_sync: true`.
- **Get pending**: `getUnsyncedContacts()` — already exists; ensure ordering (e.g. by `updated_at` ascending).
- **Update after success**: `updateContact(local_id, { server_id, pending_sync: false, ... })` — must be added.

**Audio transcript queue item (new IndexedDB store `audio_transcript_queue`)**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (keyPath) | UUID; `crypto.randomUUID()` |
| `audio_blob` | Blob | Recorded audio (e.g. webm/wav) |
| `contact_local_id` | string | Links to contact in `contacts` store (for when contact is synced first) |
| `source_mode` | `"stall" \| "field"` | Origin |
| `status` | `"pending" \| "processing" \| "done" \| "failed"` | For consumer and retries |
| `retry_count` | number | Increment on each attempt; cap at max (e.g. 3) |
| `last_error` | string \| null | Last failure message |
| `created_at` | number | `Date.now()` |
| `processed_at` | number \| null | When status became `done` or `failed` (for cleanup) |

Optional: `contact_server_id` (filled after contact is synced so transcript can be attached to the right contact on server).

### 2.3 Processing Order and Idempotency

- **Contacts queue**: Process in ascending `updated_at` (FIFO). Consumer updates local record only after 2xx from server; then item leaves the "pending" set.
- **Audio transcript queue**: Process by `created_at` ascending. Consumer sets `processing` before calling LLM; on success sets `done` and `processed_at`; on failure increments `retry_count` and sets back to `pending` or `failed`. Stale `processing` (e.g. > 5 min) can be reset to `pending` on next run.

### 2.4 Concurrency

- **Client**: One sync run at a time per tab (run guard when draining and POSTing to API).
- **Server**: BullMQ workers can run in a separate process or in the same Node app; one worker per queue name; BullMQ handles concurrency (e.g. concurrency: 5 per worker).

### 2.5 BullMQ (Server) — Overview

- **Dependencies**: `bullmq`, `ioredis`. Redis must be running (e.g. `REDIS_URL` or host/port in env).
- **Connection**: Shared Redis connection with `maxRetriesPerRequest: null` for workers (required by BullMQ).
- **Queues**: Two named queues — e.g. `contacts-sync` and `audio-transcript`. Use a single connection object for Queue and Worker.
- **Job data (contacts)**: `{ local_id, name, phone, email, company, intent_tags, source_mode, event_id, device_id }` so worker can upsert by phone and return `server_id` if needed for client update.
- **Job data (audio)**: `{ id, contact_local_id, contact_server_id?, audio_key }` (or `audio_url`) — **cost-effective:** upload audio to S3/MinIO in the API route and pass only the key/URL in the job; avoid base64 in Redis. Worker fetches by key, generates transcript, creates/updates Interaction.
- **Workers**: Create a Worker per queue; in the processor, call Prisma (contact upsert) or LLM + Prisma (transcript + Interaction). On success/failure use BullMQ's built-in retry (e.g. `attempts: 3`, `backoff`).

### 2.6 Cost-Effective Resource Choices

Use these to keep infra and usage costs low.

| Resource | Cost-effective choice | Why |
|----------|------------------------|-----|
| **Redis (BullMQ)** | **Upstash Redis** (serverless) or **Redis Cloud free tier** | Upstash: free tier ~10K commands/day, pay-per-request; no always-on VM. Redis Cloud: 30MB free. Both work with BullMQ via `REDIS_URL`. Avoid: large managed Redis if volume is low. |
| **Worker process** | **In-process workers** in the same Node app as Next.js | Run BullMQ workers inside the same process that serves the API (e.g. start workers on server boot). No separate worker VM/container = one compute instance. Best for single-instance deploys (VPS, Railway, Render). |
| **Audio in jobs** | **Object storage key, not base64 in Redis** | Upload audio to existing S3/MinIO in the API route; put only `audio_key` or URL in the job payload. Keeps Redis small and avoids large job payloads (Redis memory = cost on managed Redis). |
| **Transcription / LLM** | **Cheaper model + single call per audio** | Prefer Whisper “small” or one cheap LLM call per clip; avoid “large” or multi-step unless needed. Batch jobs in worker (process N items per run) to amortize cold starts. Optional: skip re-transcription for same audio (idempotent key). |
| **Database** | **Existing PostgreSQL (Prisma)** | No extra DB; contact upserts and Interaction rows are cheap. |
| **Hosting** | **Single Node process** (Next.js + workers) on one small VPS or PaaS | e.g. Railway, Render, Fly.io, or a small VPS. One dyno/VM that runs API + workers. If you must use serverless (Vercel): API enqueues to BullMQ; run workers on a separate minimal always-on service (e.g. Railway worker) so you don’t pay for a full app duplicate. |

**Summary:** Prefer Upstash or Redis Cloud free tier for Redis; run workers in the same Node process as the app; store audio in S3/MinIO and pass keys in jobs; use a single cheap LLM/transcription option per audio.

### 2.7 Approximate Cost (Rough Guide)

Prices below are indicative; check each provider for current plans.

| Component | Free / low usage | When you pay more |
|-----------|------------------|--------------------|
| **Redis (BullMQ)** | **$0** — Upstash free tier: 500K commands/month, 256MB, 10GB bandwidth. Redis Cloud: 30MB free. For hundreds of syncs + audio jobs per day, you typically stay in free tier. | Upstash pay-as-you-go: ~\$0.20 per 100K commands after free tier. Fixed plans from ~\$10/mo if you need more. |
| **Compute (API + workers)** | **$0–5/mo** — Single Node process on Railway/Render free tier (limited hours) or Fly.io free allowance. Or **$5–7/mo** for always-on smallest VPS (e.g. 512MB–1GB). | Scale to more instances or bigger VM only if traffic grows. |
| **PostgreSQL** | **$0** — Use existing DB (e.g. same as app). Free tiers on Neon, Supabase, or included in PaaS. | Paid DB plans when you exceed free limits. |
| **Object storage (audio)** | **$0–1/mo** — S3/MinIO: first 5GB often free (e.g. AWS free tier); short clips (e.g. 1–2 min each) are a few MB; hundreds of clips ≈ well under 5GB. | ~\$0.023/GB/month (S3) when over free tier. |
| **Transcription (audio queue)** | **~\$0.006/min** (OpenAI Whisper) or **~\$0.003/min** (e.g. Whisper-style / smaller model). 100 min/month ≈ **\$0.30–0.60**; 500 min ≈ **\$1.50–3**; 2,000 min ≈ **\$6–12**. | Grows with total audio minutes transcribed. |

**Typical total (cost-effective setup):**

- **Very low usage** (e.g. &lt; 100 contacts synced/month, &lt; 100 min audio): **\$0–2/month** (free tiers + minimal transcription).
- **Low–medium** (e.g. 500–1,000 contacts, 200–500 min audio): **\$2–10/month** (still mostly free Redis + one small compute; main cost is transcription).
- **Higher** (thousands of contacts, 1,000+ min audio): **\$10–30/month** (transcription dominates; Redis and compute may still be free or cheap).

**Largest variable:** Transcription/LLM cost scales with **minutes of audio**; contacts sync is effectively free (DB + Redis free tier). Optimize by using the cheapest model that meets quality and batching where possible.

---

## 3. Task List

### A. Contacts Queue

- [x] **Q1** – Add `updateContact(local_id, patch)` in `modules/capture/db.ts` to update a contact by `local_id` (e.g. set `server_id`, `pending_sync`, `version`). Use put over existing record.
- [x] **Q2** – Ensure `getUnsyncedContacts()` returns items ordered by `updated_at` ascending (sort in memory after getAll, or add index if needed for large sets).
- [x] **Q3** – Document contract: enqueue = `addContact` with `pending_sync: true`; get pending = `getUnsyncedContacts()`; update = `updateContact(local_id, patch)`. Consumer (POST to API when online) is out of scope.

### B. Audio Transcript Queue (Storage and API)

- [ ] **Q4** – Bump capture DB version; add IndexedDB store `audio_transcript_queue` with keyPath `id`. Define type `AudioTranscriptQueueItem` (fields above).
- [ ] **Q5** – Implement `enqueueAudioTranscriptItem(item: { audio_blob: Blob; contact_local_id: string; source_mode: "stall" | "field" })` → add to store with `status: "pending"`, `created_at`, `retry_count: 0`.
- [ ] **Q6** – Implement `getPendingAudioTranscriptItems(limit: number)` → return items with `status === "pending"` (or reset stale `processing` first), ordered by `created_at` ascending, limited to `limit`.
- [ ] **Q7** – Implement `updateAudioTranscriptItemStatus(id, status, options?: { last_error?, processed_at? })` and optional `setContactServerId(id, server_id)` to link item to synced contact.
- [ ] **Q8** – Stale reset: helper or in getPending — any item with `status === "processing"` and older than T (e.g. 5 min) set back to `pending` so consumer can retry.

### C. Resilience (Queue Layer)

- [ ] **Q9** – Contacts: no partial state; client only calls `updateContact` after API returns 2xx (and API has enqueued to BullMQ; worker runs async).
- [ ] **Q10** – Audio: on failure, client or API response can signal retry; queue impl provides update function. BullMQ worker retries with backoff on throw.
- [ ] **Q11** – Optional: cleanup audio queue — delete items with status `done` or `failed` and `processed_at` older than 7 days.

### D. BullMQ (Server)

- [ ] **Q12** – Add dependencies: `pnpm add bullmq ioredis`; add `REDIS_URL` to env. Prefer **Upstash Redis** or **Redis Cloud** free tier (see §2.6); both expose a Redis URL.
- [ ] **Q13** – Create shared Redis connection module (e.g. `lib/queue/connection.ts`) using `ioredis` with `maxRetriesPerRequest: null` for workers. Use `REDIS_URL` so one config works for Upstash, Redis Cloud, or self-hosted.
- [ ] **Q14** – Create contacts queue: `lib/queue/contacts-sync.ts` — `Queue` named `contacts-sync`, add job with name `upsert` and payload matching contact fields (local_id, name, phone, email, company, intent_tags, source_mode, event_id, device_id).
- [ ] **Q15** – Create audio transcript queue: `lib/queue/audio-transcript.ts` — `Queue` named `audio-transcript`. Job payload: **prefer `audio_key` (S3/MinIO key) or URL**, not base64, to keep Redis small (cost-effective; see §2.6). Include client item id, contact_local_id, contact_server_id?.
- [ ] **Q16** – API route POST `/api/sync/contacts`: accept array of contacts; for each, `contactsSyncQueue.add('upsert', contactPayload)`; return 200 with `{ enqueued: number }`. Optionally require auth.
- [ ] **Q17** – API route POST `/api/sync/audio`: accept items (id, contact_local_id, audio file). **Upload audio to S3/MinIO**, then enqueue job with `audio_key` or URL only (cost-effective). Return 200 with `{ enqueued: number }`.
- [ ] **Q18** – Worker: contacts-sync — create `Worker` for `contacts-sync`; in processor, upsert contact to DB (Prisma) by phone; on throw BullMQ retries. **Cost-effective:** run worker **in the same Node process** as the app (e.g. start in `instrumentation.ts` or server bootstrap) to avoid a separate worker VM.
- [ ] **Q19** – Worker: audio-transcript — create `Worker` for `audio-transcript`; in processor, fetch audio from storage by key, call **one cheap transcription/LLM** per job, create/update Interaction. **Cost-effective:** run in-process (§2.6); use Whisper small or a single cheap LLM call.

---

## 4. Implementation Plan

### Phase 1: Contacts Queue API

1. **Q1** – Implement `updateContact(local_id, patch)` in `modules/capture/db.ts`.
2. **Q2** – Ensure sorted `getUnsyncedContacts()` (by `updated_at` asc).
3. **Q3** – Document the three operations (enqueue / get pending / update). No consumer code in this phase.

**Exit criteria**: Contacts can be enqueued (existing addContact), listed as pending (getUnsyncedContacts), and updated after sync (updateContact).

### Phase 2: Audio Transcript Queue

4. **Q4** – Add store `audio_transcript_queue` and type `AudioTranscriptQueueItem`; bump DB version.
5. **Q5** – Implement `enqueueAudioTranscriptItem`.
6. **Q6** – Implement `getPendingAudioTranscriptItems(limit)` with ordering and optional stale reset.
7. **Q7** – Implement `updateAudioTranscriptItemStatus` and optional `setContactServerId`.
8. **Q8** – Stale `processing` reset (in getPending or separate).

**Exit criteria**: Audio items can be enqueued, listed as pending, and status updated. Consumer (LLM when online) will use these APIs.

### Phase 3: BullMQ (Server) — cost-effective

9. **Q12**, **Q13** – Install bullmq + ioredis; set `REDIS_URL` (Upstash or Redis Cloud free tier recommended); create shared connection module.
10. **Q14**, **Q15** – Create two Queue instances; audio job payload uses **storage key/URL** only (upload in API).
11. **Q16**, **Q17** – API routes: upload audio to S3/MinIO in /api/sync/audio, then enqueue with key; contacts enqueue as-is.
12. **Q18**, **Q19** – Implement workers; **run in the same Node process** as the app (no separate worker VM) for minimal cost.

**Exit criteria**: Client can POST pending data; API enqueues to BullMQ; workers process jobs; single process + free-tier Redis.

### Phase 4: Hardening (Optional)

13. **Q9–Q11** – Client update only on 2xx; optional cleanup; BullMQ retry/backoff config.

---

## 5. Best Practices (Queue Layer)

- **Single responsibility**: Each store is one queue; contacts queue = contacts with `pending_sync`; audio queue = dedicated store with status.
- **Explicit status**: Use `pending` / `processing` / `done` / `failed` and timestamps so consumers can retry and cleanup.
- **No partial commits**: Update status only after consumer succeeds (contacts: after 2xx; audio: after transcript saved). Queue layer only exposes update; it does not call APIs.
- **Ordering**: Process contacts by `updated_at` asc, audio by `created_at` asc so FIFO is predictable.
- **Run guard**: Enforced by consumer; queue impl can document that consumers should run one at a time per queue.

### 5.5 BullMQ (Server)

- **Connection**: Use one shared Redis connection for all Queue/Worker instances; set `maxRetriesPerRequest: null` for workers. Use `REDIS_URL` (Upstash / Redis Cloud compatible).
- **Job payload**: Keep job data JSON-serializable. For audio, **use storage key or URL only** (upload in API route); avoid large base64 in Redis to save memory and cost.
- **Idempotency**: Contact upsert by phone is idempotent; same job processed twice is safe. Transcript job should write once (e.g. unique constraint or idempotent key).
- **Retries**: Configure `attempts` and `backoff`; worker throws on failure to trigger retry.
- **Cost**: Prefer in-process workers (one Node process); use Upstash or Redis Cloud free tier; one cheap LLM/transcription call per audio job (see §2.6).

---

## 6. Edge Cases (Queue Layer)

| Scenario | Handling |
|----------|----------|
| Tab close during consumer run | Queue state is unchanged; next run will pick same pending items. No partial status update if consumer only updates after success. |
| Same contact enqueued twice | Both records exist; server upsert-by-phone handles dupes; consumer can process both. |
| Audio item never gets contact_server_id | Consumer can resolve `contact_local_id` to `server_id` after contacts sync; queue can store `contact_server_id` when available. |
| Stale `processing` | Reset to `pending` in getPending (or startup) if older than T. |
| Redis down | BullMQ queues cannot enqueue; API can return 503 or queue in memory and retry; workers reconnect when Redis is back. |
| Worker process restart | BullMQ jobs in progress may be lost or retried (stalled job detection); use reasonable `lockDuration` and idempotent processors. |

---

## 7. File and Module Map

| Area | Files / Modules |
|------|------------------|
| Client — contacts queue | `modules/capture/db.ts` — `updateContact`, `getUnsyncedContacts` (sorted), `addContact`. Contract: `docs/CONTACTS-QUEUE-CONTRACT.md`. |
| Client — audio transcript queue | `modules/capture/db.ts` — store `audio_transcript_queue`, `enqueueAudioTranscriptItem`, `getPendingAudioTranscriptItems`, `updateAudioTranscriptItemStatus`. |
| Client — sync when online | e.g. `hooks/use-capture-sync.ts` or similar — getUnsyncedContacts / getPendingAudioTranscriptItems, POST to /api/sync/contacts and /api/sync/audio, then updateContact / updateAudioTranscriptItemStatus on 2xx. |
| Server — Redis | `lib/queue/connection.ts` — shared ioredis connection; use `REDIS_URL` (Upstash / Redis Cloud). |
| Server — BullMQ queues | `lib/queue/contacts-sync.ts`, `lib/queue/audio-transcript.ts` — Queue instances; audio payload uses storage key only. |
| Server — API | `app/api/sync/contacts/route.ts`, `app/api/sync/audio/route.ts` — enqueue jobs; audio route uploads to S3/MinIO first. |
| Server — workers | `lib/queue/workers/` or started from `instrumentation.ts` / server bootstrap — **in-process** Worker for each queue (cost-effective; no separate VM). |

---

## 8. Testing Checklist (Queue Only)

- [ ] Add contact with `pending_sync: true`; call `getUnsyncedContacts()`; verify it appears; call `updateContact(local_id, { pending_sync: false })`; verify it no longer appears.
- [ ] Enqueue audio item; call `getPendingAudioTranscriptItems(5)`; verify ordering by `created_at`; call `updateAudioTranscriptItemStatus(id, "done", { processed_at })`; verify item no longer in pending.
- [ ] Set item to `processing` and do not update; after T, call getPending with stale reset; verify item is back to `pending`.

---

## 9. Cost-Effectiveness Checklist

- [ ] Redis: Using Upstash or Redis Cloud free tier (or self-hosted); `REDIS_URL` set.
- [ ] Workers: Running in the same Node process as the app (no separate worker server).
- [ ] Audio jobs: Payload contains only `audio_key` or URL (audio uploaded to S3/MinIO in API); no large base64 in Redis.
- [ ] Transcription: One cheap model/call per audio (e.g. Whisper small); no unnecessary re-calls or large models for simple transcript.

---

This guide is the source of truth for the **queue implementation**: client IndexedDB (contacts + audio_transcript_queue) and server **BullMQ** (Redis) with queues `contacts-sync` and `audio-transcript**. Cost-effective choices: Upstash/Redis Cloud, in-process workers, audio via storage key, cheap LLM/transcription. Visiting card uses a local model and does not use a queue.
