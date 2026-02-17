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

**Audio queue item (IndexedDB store `audio_transcript_queue`)**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (keyPath) | UUID; `crypto.randomUUID()` |
| `audio_blob` | **Blob** | Recorded audio when offline (e.g. audio/webm); stored as Blob in IndexedDB; sent to API when online |
| `contact_local_id` | string | Links to contact in `contacts` store (for when contact is synced first) |
| `source_mode` | `"stall" \| "field"` | Origin (`DraftMode`) |
| `status` | `"pending" \| "processing" \| "done" \| "failed"` | For consumer and retries |
| `retry_count` | number | Increment on each attempt; cap at `MAX_AUDIO_TRANSCRIPT_RETRIES` (3) |
| `last_error` | string \| null | Last failure message |
| `created_at` | number | `Date.now()` |
| `processed_at` | number \| null | When status became `done` or `failed` (for cleanup) |
| `contact_server_id` | string \| null (optional) | Filled after contact is synced so asset can be attached to the right contact on server |
| `status_updated_at` | number (optional) | Set on status change; used for stale `processing` reset (T = 5 min) |

**Current codebase reference — audio offline storage**

Implementation lives in **`modules/capture/db.ts`**.

- **IndexedDB**: `DB_NAME = "finbridge-capture"`, `DB_VERSION = 3`. Store **`audio_transcript_queue`** with `keyPath: "id"`.
- **Types**: `AudioTranscriptQueueItem` (full item), `AudioTranscriptQueueItemStatus`, `EnqueueAudioTranscriptItemInput` (`{ audio_blob: Blob; contact_local_id: string; source_mode: "stall" | "field" }`), `DraftMode = "stall" | "field"`.
- **Enqueue**: `enqueueAudioTranscriptItem(item)` — adds record with `status: "pending"`, `retry_count: 0`, `created_at: Date.now()`, `processed_at: null`; returns item `id`.
- **Get pending**: `getPendingAudioTranscriptItems(limit)` — runs `resetStaleProcessingItems()` first (items in `"processing"` with `(status_updated_at ?? created_at)` older than 5 min are reset to `"pending"`), then returns items with `status === "pending"` ordered by `created_at` ascending, sliced to `limit`.
- **Update status**: `updateAudioTranscriptItemStatus(id, status, options?)` with `options`: `last_error`, `processed_at`, `retry_count_increment`. Sets `status_updated_at` on update.
- **Failure**: `recordAudioTranscriptItemFailure(id, last_error)` — increments `retry_count`, sets `last_error`; if `retry_count < MAX_AUDIO_TRANSCRIPT_RETRIES` sets status back to `"pending"`, else `"failed"` and `processed_at`. Rejects if item is already `"done"` or `"failed"`.
- **Link contact**: `setContactServerId(id, server_id)`.
- **Cleanup**: `cleanupAudioTranscriptQueue(options?)` — deletes items with `status` in `["done","failed"]` and `processed_at` older than `olderThanMs` (default `DEFAULT_CLEANUP_AGE_MS` = 7 days). Returns `{ deleted }`.
- **Constants**: `STALE_PROCESSING_MS = 5 * 60 * 1000`, `MAX_AUDIO_TRANSCRIPT_RETRIES = 3`, `DEFAULT_CLEANUP_AGE_MS = 7 * 24 * 60 * 60 * 1000`.

Audio is stored **only as Blob** in IndexedDB when offline; no base64 or transcript. When online, the consumer sends the blob to the API (e.g. in multipart body); API uploads to S3 (e.g. WebP or webm per product choice) and enqueues a job with storage key only.

### 2.3 Processing Order and Idempotency

- **Contacts queue**: Process in ascending `updated_at` (FIFO). Consumer updates local record only after 2xx from server; then item leaves the "pending" set.
- **Audio transcript queue**: Process by `created_at` ascending. Consumer sets `processing` before calling LLM; on success sets `done` and `processed_at`; on failure increments `retry_count` and sets back to `pending` or `failed`. Stale `processing` (e.g. > 5 min) can be reset to `pending` on next run.

### 2.4 Concurrency

- **Client**: One sync run at a time per tab (run guard when draining and POSTing to API).
- **Server**: BullMQ workers can run in a separate process or in the same Node app; one worker per queue name; BullMQ handles concurrency (e.g. concurrency: 5 per worker).

### 2.5 BullMQ (Server) — Overview

- **Dependencies**: `bullmq`, `ioredis` (or `@upstash/redis` where REST is used). **Env**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` for Upstash Redis.
- **Connection**: Shared Redis connection for queues; when using BullMQ with Upstash, use connection built from the above env vars (see §Q13).
- **Queues**: Two named queues — e.g. `contacts-sync` and `audio-transcript`. Use a single connection object for Queue and Worker.
- **Job data (contacts)**: `{ local_id, name, phone, email, company, intent_tags, source_mode, event_id, device_id }` so worker can upsert by phone and return `server_id` if needed for client update.
- **Job data (audio)**: `{ id, contact_local_id, contact_server_id?, audio_key }` (or `audio_url`) — **cost-effective:** upload audio to S3/MinIO in the API route and pass only the key/URL in the job; avoid base64 in Redis. Worker fetches by key, generates transcript, creates/updates Interaction.
- **Workers**: Create a Worker per queue; in the processor, call Prisma (contact upsert) or LLM + Prisma (transcript + Interaction). On success/failure use BullMQ's built-in retry (e.g. `attempts: 3`, `backoff`).

### 2.5.1 BullMQ workers (implemented)

- **Connection**: `lib/queue/connection.ts` uses **`REDIS_URL`** (TCP URL, e.g. Upstash Redis Connect URL). Required for both API enqueue and workers. Set in `.env` or `.env.local.dev`.
- **Contacts worker**: `workers/contacts-sync-worker.ts` — processes `contacts-sync` queue, job name `upsert`; upserts contact to DB by phone and sets `offlineLocalId` from payload `local_id` so audio jobs can resolve contact later.
- **Audio worker**: `workers/audio-transcript-worker.ts` — processes `audio-transcript` queue, job name `upload`; resolves contact by `contact_server_id` or `offlineLocalId` (Contact.offlineLocalId), creates Interaction with `audioObjectKey` and `createdBy`, then creates AiJob (pending).
- **Run workers** (from project root, with env loaded):
  - `pnpm worker:contacts` — contacts-sync worker only
  - `pnpm worker:audio` — audio-transcript worker only
  - `pnpm workers` — both workers (concurrently)
- **Env**: `REDIS_URL`, `DATABASE_URL`; for sync audio API also MinIO/S3 and session auth. Run workers in a separate terminal (or same Node process if you bootstrap them at server start).

### 2.6 Cost-Effective Resource Choices

Use these to keep infra and usage costs low.

| Resource | Cost-effective choice | Why |
|----------|------------------------|-----|
| **Redis (BullMQ)** | **Upstash Redis** (serverless) | Use **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** in env. Free tier ~10K commands/day, pay-per-request; no always-on VM. |
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

- [x] **Q4** – Bump capture DB version; add IndexedDB store `audio_transcript_queue` with keyPath `id`. Define type `AudioTranscriptQueueItem` (fields above).
- [x] **Q5** – Implement `enqueueAudioTranscriptItem(item: { audio_blob: Blob; contact_local_id: string; source_mode: "stall" | "field" })` → add to store with `status: "pending"`, `created_at`, `retry_count: 0`.
- [x] **Q6** – Implement `getPendingAudioTranscriptItems(limit: number)` → return items with `status === "pending"` (or reset stale `processing` first), ordered by `created_at` ascending, limited to `limit`.
- [x] **Q7** – Implement `updateAudioTranscriptItemStatus(id, status, options?: { last_error?, processed_at? })` and optional `setContactServerId(id, server_id)` to link item to synced contact.
- [x] **Q8** – Stale reset: helper or in getPending — any item with `status === "processing"` and older than T (e.g. 5 min) set back to `pending` so consumer can retry.

### C. Resilience (Queue Layer)

- [x] **Q9** – Contacts: no partial state; client only calls `updateContact` after API returns 2xx (and API has enqueued to BullMQ; worker runs async).
- [x] **Q10** – Audio: on failure, client or API response can signal retry; queue impl provides update function. BullMQ worker retries with backoff on throw.
- [x] **Q11** – Optional: cleanup audio queue — delete items with status `done` or `failed` and `processed_at` older than 7 days.

### D. BullMQ (Server)

- [x] **Q12** – Add dependencies: `pnpm add bullmq ioredis` (and/or `@upstash/redis`); add **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** to env (Upstash Redis; see §2.6).
- [x] **Q13** – Create shared Redis connection module (e.g. `lib/queue/connection.ts`) for **Upstash Redis**. Use **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** (e.g. with `@upstash/redis`). For BullMQ workers that require a TCP connection, use the same Upstash database’s Redis Connect URL as `REDIS_URL` in addition.
- [x] **Q14** – Create contacts queue: `lib/queue/contacts-sync.ts` — `Queue` named `contacts-sync` on **Upstash Redis** (shared connection), add job with name `upsert` and payload matching contact fields (local_id, name, phone, email, company, intent_tags, source_mode, event_id, device_id).
- [x] **Q15** – Create audio transcript queue: `lib/queue/audio-transcript.ts` — `Queue` named `audio-transcript`. Job payload: **prefer `audio_key` (S3/MinIO key) or URL**, not base64, to keep Redis small (cost-effective; see §2.6). Include client item id, contact_local_id, contact_server_id?.
- [x] **Q16** – API route POST `/api/sync/contacts`: accept array of contacts; for each, `contactsSyncQueue.add('upsert', contactPayload)`; return 200 with `{ enqueued: number }`. Auth required.
- [x] **Q17** – API route POST `/api/sync/audio`: accept items (id, contact_local_id, audio file). Upload audio to S3/MinIO, then enqueue job with `audio_key` and `created_by`. Return 200 with `{ enqueued: number }`.
- [x] **Q18** – Worker: contacts-sync — `workers/contacts-sync-worker.ts`; upsert contact to DB by phone, set `offlineLocalId` from `local_id`; run with `pnpm worker:contacts`.
- [x] **Q19** – Worker: audio-transcript — `workers/audio-transcript-worker.ts`; resolve contact by `contact_server_id` or `offlineLocalId`, create Interaction + AiJob; run with `pnpm worker:audio`.

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

9. **Q12**, **Q13** – Install bullmq + ioredis (and/or @upstash/redis); set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** (Upstash Redis); create shared connection module.
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

- **Connection**: Use one shared Redis connection for all Queue/Worker instances. Use **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** (Upstash Redis); for BullMQ TCP use `maxRetriesPerRequest: null` when using ioredis.
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
| Stale `processing` | Reset to `pending` in getPending (or startup) if older than T (5 min in codebase). Uses `status_updated_at ?? created_at`. |
| Redis down | BullMQ queues cannot enqueue; API can return 503 or queue in memory and retry; workers reconnect when Redis is back. |
| Worker process restart | BullMQ jobs in progress may be lost or retried (stalled job detection); use reasonable `lockDuration` and idempotent processors. |
| Audio blob missing or too large | Consumer must send the Blob from IndexedDB; if item was deleted or blob unavailable, API/consumer should call `recordAudioTranscriptItemFailure` or set status `failed`. Avoid sending base64 in JSON; use multipart form for blob. |
| IndexedDB quota exceeded | Browser may evict or block writes; capture layer cannot persist new items. Consumer should surface error and optionally retry sync to free space (cleanup done/failed items). |
| Already done / already failed | `recordAudioTranscriptItemFailure` rejects; do not call for items already in terminal state. |

---

## 7. File and Module Map

| Area | Files / Modules |
|------|------------------|
| Client — contacts queue | `modules/capture/db.ts` — `updateContact`, `getUnsyncedContacts` (sorted), `addContact`. Contract: `docs/CONTACTS-QUEUE-CONTRACT.md`. |
| Client — audio queue (offline storage) | **`modules/capture/db.ts`** — IndexedDB store `audio_transcript_queue` (keyPath `id`). Audio stored as **Blob** only. Exports: `enqueueAudioTranscriptItem`, `getPendingAudioTranscriptItems`, `updateAudioTranscriptItemStatus`, `recordAudioTranscriptItemFailure`, `setContactServerId`, `cleanupAudioTranscriptQueue`; types `AudioTranscriptQueueItem`, `EnqueueAudioTranscriptItemInput`, `AudioTranscriptQueueItemStatus`; constants `MAX_AUDIO_TRANSCRIPT_RETRIES`, `DEFAULT_CLEANUP_AGE_MS`. Contract: `docs/AUDIO-QUEUE-CONTRACT.md`. |
| Client — sync when online | e.g. `hooks/use-capture-sync.ts` or similar — getUnsyncedContacts / getPendingAudioTranscriptItems, POST to /api/sync/contacts and /api/sync/audio, then updateContact / updateAudioTranscriptItemStatus on 2xx. |
| Server — Redis | `lib/queue/connection.ts` — shared Upstash Redis connection; use **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**. |
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

- [ ] Redis: Using Upstash Redis; **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** set in env.
- [ ] Workers: Running in the same Node process as the app (no separate worker server).
- [ ] Audio jobs: Payload contains only `audio_key` or URL (audio uploaded to S3/MinIO in API); no large base64 in Redis.
- [ ] Transcription: One cheap model/call per audio (e.g. Whisper small); no unnecessary re-calls or large models for simple transcript.

---

This guide is the source of truth for the **queue implementation**: client IndexedDB (contacts + audio_transcript_queue) and server **BullMQ** (Redis) with queues `contacts-sync` and `audio-transcript**. Cost-effective choices: Upstash/Redis Cloud, in-process workers, audio via storage key, cheap LLM/transcription. Visiting card uses a local model and does not use a queue.
