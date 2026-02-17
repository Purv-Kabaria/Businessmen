# Offline Sync & BullMQ Setup on Your Device

This guide explains how **field** and **stall** capture pages work with offline storage and how to set up the full sync pipeline (Redis, BullMQ workers, MinIO) on your machine.

---

## 1. Architecture Overview

### Capture pages

| Page | Path | What it does |
|------|------|----------------|
| **Stall** | `/(capture)/stall` | Kiosk-style capture: name, phone (required), email, tags. Saves to **IndexedDB** only when offline; when online can POST to API. |
| **Field** | `/(capture)/field` | Field capture: scan card or enter phone, tags, **record audio note**. Saves contact + audio to **IndexedDB** when offline; when online can POST contact and upload audio. |

Both use the same offline store: **IndexedDB** database `finbridge-capture` (see `modules/capture/db.ts`):

- **contacts** – local contacts with `pending_sync: true` until synced
- **audio_transcript_queue** – pending audio blobs with `status: "pending"` until uploaded and processed
- **draft** – draft form state per mode (stall/field)

No server is required for **offline capture**. Data stays in the browser until you run sync.

### Sync flow (when online)

```
[Browser]
  Stall/Field submit     → IndexedDB (contacts + optional audio_transcript_queue)
  User clicks "Sync"     → POST /api/sync/contacts, POST /api/sync/audio

[Next.js API]
  /api/sync/contacts     → Upserts contacts to PostgreSQL, optionally enqueues to BullMQ
  /api/sync/audio         → Uploads audio to MinIO/S3, creates Interaction + AiJob in DB, optionally enqueues to BullMQ

[BullMQ workers – optional]
  contacts-sync worker   → Re-upserts contacts from queue (idempotent by phone)
  audio-transcript worker → Creates Interaction + AiJob from job payload only when not already created (idempotent by contact+audio_key)
  transcribe worker      → Fetches audio from MinIO, calls Python /api/transcribe-by-url, updates interaction transcript + AiJob status; triggers embedding
```

- **Contacts sync**: API upserts contacts to DB immediately, then enqueues to `contacts-sync`. If Redis is down, enqueue fails gracefully (API still returns success).
- **Audio sync**: API uploads to MinIO/S3, creates Interaction + AiJob in DB, then enqueues **only** to `transcribe`. The transcribe worker runs transcription automatically so the moderator does not need to press “Transcribe”. If Redis is down, enqueue fails gracefully.

So:

- **Offline capture**: works with **no** backend.
- **Sync to server**: needs **PostgreSQL**, **auth**, and for audio **MinIO (or S3)**. For the **BullMQ workers** you need **Redis (TCP)** and the same **DATABASE_URL** (and optionally MinIO if workers do upload-related work).

---

## 2. What You Need for Full Sync on Your Device

| Component | Purpose |
|-----------|--------|
| **Node.js & pnpm** | Run Next.js and workers |
| **PostgreSQL** | Stored contacts and interactions (e.g. local Docker or cloud) |
| **Redis (TCP)** | BullMQ queues. Use **Upstash Redis Connect URL** or local Redis. |
| **MinIO or S3** | Audio file storage for sync audio (API uploads here) |
| **Env file** | `.env` or `.env.local.dev` with the variables below |

---

## 3. Step-by-Step Setup

### Step 1: Clone and install

```bash
cd d:\Projects\htt_Businessmen
pnpm install
```

### Step 2: Environment variables

Create or edit **`.env`** (or **`.env.local.dev`** if you run the app with `pnpm dev:local`).

**Required for the app (sync API + DB):**

```env
# Database (required for sync)
DATABASE_URL="postgresql://user:password@localhost:5432/finbridge"

# Auth (required for /api/sync/* – you must be logged in)
JWT_SECRET="your-secret"
JWT_EXPIRES_IN="7d"

# Optional: app URL, etc.
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Required for BullMQ workers:**

Workers are started with `pnpm worker:contacts` and `pnpm worker:audio`. They load **`.env`** by default (no `-e .env.local.dev`). So either:

- Put the variables below in **`.env`**, and run the app with `pnpm dev` (which also uses `.env`), or  
- Put them in `.env.local.dev` and run workers with explicit env, e.g.  
  `dotenv -e .env.local.dev -- tsx workers/contacts-sync-worker.ts`

Add to the env file you use for workers:

```env
# Redis – TCP URL (required for BullMQ)
# Upstash: Dashboard → your Redis → "Redis Connect" → copy URL (starts with rediss:// or redis://)
# Do NOT use the REST URL (https://...) for BullMQ
REDIS_URL="rediss://default:YOUR_PASSWORD@xxx.upstash.io:6379"
```

**Required for sync audio (upload):**

The sync audio API uploads to S3-compatible storage. MinIO (local or Docker) is the default:

```env
# MinIO (default if not set: localhost:9000, minioadmin/minioadmin)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=interactions-audio
# If MinIO is HTTPS:
# MINIO_USE_SSL=true
```

If you use **AWS S3** instead, configure the S3 client in `lib/s3.ts` (endpoint, region, credentials) accordingly and set any `MINIO_*` / AWS vars your code expects.

**Optional – Upstash REST (if you use it elsewhere):**

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

These are for `getRedis()` (REST client), not for BullMQ. BullMQ needs **REDIS_URL** (TCP).

### Step 3: Database

Ensure PostgreSQL is running and migrations are applied:

```bash
pnpm prisma:generate
pnpm prisma:migrate
# Or for local dev env:
pnpm prisma:generate:local
pnpm prisma:migrate:local
```

### Step 4: Redis (for BullMQ)

**Option A – Upstash (no local Redis):**

1. Create a Redis database at [Upstash](https://upstash.com).
2. In the dashboard, open **Redis Connect** (not REST).
3. Copy the **TCP URL** (e.g. `rediss://default:...@xxx.upstash.io:6379`).
4. Set in your env:  
   `REDIS_URL="rediss://default:PASSWORD@xxx.upstash.io:6379"`

**Option B – Local Redis:**

1. Install and start Redis (e.g. `redis-server` or Docker).
2. Set in your env:  
   `REDIS_URL="redis://127.0.0.1:6379"`

### Step 5: MinIO (for sync audio)

**Option A – Docker:**

```bash
docker run -d -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

Use the same `MINIO_*` vars as in Step 2 (defaults point to localhost:9000 and create the bucket if needed).

**Option B – Existing MinIO/S3:**  
Point `MINIO_ENDPOINT` / credentials (or S3 config in `lib/s3.ts`) to your server/bucket.

### Step 6: Run the app

```bash
# From project root
pnpm dev
# Or, if you use a separate env file:
pnpm dev:local   # uses .env.local.dev
```

Open the app (e.g. `http://localhost:3000`), sign in, and go to the **Stall** or **Field** capture page.

### Step 7: Run BullMQ workers (optional but recommended for full queue flow)

Workers read **`.env`** by default. If your app uses `.env.local.dev`, either put `REDIS_URL` and `DATABASE_URL` in `.env` or run with that file:

```bash
# Terminal 1 – contacts worker
pnpm worker:contacts

# Terminal 2 – audio worker
pnpm worker:audio
```

Or all three (including transcribe) in one terminal:

```bash
pnpm workers
```

You should see:

- `[contacts-sync] Worker listening on queue "contacts-sync"`
- `[audio-transcript] Worker listening on queue "audio-transcript"`
- `[transcribe] Worker listening on queue "transcribe"`

The **transcribe** worker runs transcription automatically when audio is synced or when a new interaction with audio is created (no need for the moderator to press Transcribe). Keep these running while testing sync.

### Step 8: Verify end-to-end

1. **Offline capture**  
   - DevTools → Network → set to **Offline**.  
   - Submit a contact on **Stall** (or contact + audio on **Field**).  
   - You should see a “Saved offline”–style message and new rows in IndexedDB (`finbridge-capture` → `contacts` and/or `audio_transcript_queue`).

2. **Sync**  
   - Set network back to **Online**, refresh if needed.  
   - On the capture layout you should see **Sync contacts** / **Sync audio** (and counts if you have pending data).  
   - Click **Sync contacts** then **Sync audio**.  
   - Expect 200 responses and toasts; worker terminals should log job completions; DB should have contacts/interactions; MinIO bucket should have audio objects.

---

## 4. Worker system – edge cases and behaviour

- **Redis down**: All queue `add*` calls catch errors and log; API still returns success. Contacts and interactions are written to DB; only the background job is skipped. Moderator can transcribe manually if needed.
- **Contacts-sync worker**: Upserts by phone (idempotent). Safe to run the same job twice.
- **Audio-transcript worker**: Used only if some other path enqueues to `audio-transcript`. Before creating an interaction it checks for an existing one with the same `contactId` and `audio_key`; if found, skips create (idempotent). Uses `audioObjectKeys: [audio_key]` to match the Prisma schema.
- **Transcribe worker**: Validates `interactionId` (UUID). Skips if interaction already has a transcript or has no audio keys; marks AiJob completed in both cases. On Python/network errors it throws so BullMQ retries (3 attempts, exponential backoff). Parses Python response safely; invalid JSON or non-2xx is treated as failure. S3 signed URL and fetch errors are wrapped in clear messages. Embedding call is fire-and-forget (failure does not fail the job).
- **POST /api/interactions**: When appending audio to an existing interaction we now enqueue transcribe as well, so the new audio is transcribed automatically.
- **Sync/audio**: Creates exactly one interaction and one AiJob per request; enqueues one transcribe job. Does **not** enqueue to `audio-transcript` (that would create a duplicate interaction).

## 5. Quick reference

| Task | Command / Note |
|------|----------------|
| App (default env) | `pnpm dev` |
| App (local env) | `pnpm dev:local` (uses `.env.local.dev`) |
| Workers (both) | `pnpm workers` (uses `.env`) |
| Workers (single) | `pnpm worker:contacts`, `pnpm worker:audio`, or `pnpm worker:transcribe` |
| DB migrations | `pnpm prisma:migrate` or `pnpm prisma:migrate:local` |
| Prisma Studio | `pnpm prisma:studio:local` (or `prisma studio` with your env) |

**Required env for sync:**

- `DATABASE_URL` – PostgreSQL
- `JWT_SECRET` (and auth config) – so sync API can verify session
- `REDIS_URL` – **TCP** Redis URL for BullMQ (Upstash: use Redis Connect URL)
- `MINIO_*` (or S3 config) – for sync audio uploads

**Optional:**  
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for other Redis REST usage; not used by BullMQ workers.

For more detail on the queue design and failure handling, see **docs/QUEUE-SYSTEM-IMPLEMENTATION-GUIDE.md** and **docs/OFFLINE-SYNC-MANUAL-TESTING.md**.
