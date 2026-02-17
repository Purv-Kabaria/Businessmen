# Offline Sync Flow – Will It Work? & Manual Testing

## Will the complete flow work?

**Yes**, provided:

1. **You are signed in** – Both `/api/sync/contacts` and `/api/sync/audio` use `verifySession()`; unauthenticated requests get 401.
2. **Backend services when syncing**:
   - **Sync contacts**: Redis (BullMQ) optional; API upserts contacts to DB first, then enqueues to `contacts-sync` for async processing. If Redis is down, enqueue fails silently and contacts are still in DB.
   - **Sync audio**: MinIO (or S3) must be running so the audio file can be uploaded. The API creates the interaction and AiJob in DB, then enqueues a **transcribe** job. If Redis is down, enqueue fails silently and the moderator can transcribe manually.

**Flow summary:**

| Step | What happens |
|------|----------------|
| **Offline – Stall** | Add contact → `addContact(..., pending_sync: true)` in IndexedDB. |
| **Offline – Field** | Add contact + record audio → `addContact` + `enqueueAudioTranscriptItem` (blob in IndexedDB). |
| **Offline – Interaction capture** | Select contact, record audio, Save → `enqueueAudioTranscriptItem(contact_local_id, blob)`. |
| **Online – Sync contacts** | Button visible; click → POST to `/api/sync/contacts` → BullMQ; client sets `pending_sync: false` for enqueued contacts. |
| **Online – Sync audio** | Button visible; click → for each pending item: POST to `/api/sync/audio` (upload to MinIO/S3, create interaction + AiJob, enqueue **transcribe** job); client marks item `done`. When the transcribe worker runs, it transcribes the audio and updates the interaction (no manual “Transcribe” needed). |

So: **offline capture works without any server**. **Sync works when online and when Redis + (for audio) MinIO/S3 are available.**

---

## How to test it manually

### Prerequisites

- App running (`npm run dev` or similar).
- Logged in so sync API calls are authenticated.
- For **full** sync: Redis and MinIO (or S3) configured and running (see `.env` / queue docs).

---

### Test 1: Offline contacts (Stall)

1. Open DevTools → **Application** (or **Storage**) → **Network**.
2. Set throttling to **Offline** (or uncheck “Online”).
3. Go to **Stall** capture page.
4. Fill name, phone, email, add a tag, submit.
5. **Expect**: Toast like “Saved. We'll sync when you're back online.”
6. **Verify**: In **Application → IndexedDB → finbridge-capture → contacts**, you should see one new row with `pending_sync: true`.

---

### Test 2: Offline contact + audio (Field)

1. Keep **Offline** (or disconnect network).
2. Go to **Field** capture page.
3. Fill the form and **record a voice note** (required).
4. Submit.
5. **Expect**: Toast like “Saved offline. Use Sync contacts and Sync audio when online.”
6. **Verify**:
   - **IndexedDB → finbridge-capture → contacts**: one new contact with `pending_sync: true`.
   - **IndexedDB → finbridge-capture → audio_transcript_queue**: one new row with your blob and `status: "pending"`.

---

### Test 3: Offline audio only (Interaction capture)

1. Ensure you have at least one contact in the capture DB (e.g. from Test 1 or 2, or add one on Stall while offline).
2. Stay **Offline**.
3. Open the page that uses **Interaction capture** (the UI where you search contact + record + Save).
4. Search and select a contact, record audio, click **Save**.
5. **Expect**: Toast like “Audio saved offline. Use Sync audio when online.”
6. **Verify**: **IndexedDB → audio_transcript_queue**: one more pending item with the selected contact’s `contact_local_id`.

---

### Test 4: Sync buttons only when online

1. With network **Offline**, go to any capture page (e.g. Field or Stall).
2. **Expect**: The header **does not** show “Sync contacts” / “Sync audio” (component returns `null` when `!navigator.onLine`).
3. Set network back to **Online** and refresh.
4. **Expect**: Header shows “Sync contacts” and “Sync audio”; if you have pending data, counts appear e.g. “Sync contacts (1)”, “Sync audio (1)”.

---

### Test 5: Sync contacts (online)

1. Be **Online** and **signed in**.
2. Have at least one unsynced contact (e.g. from Test 1 or 2).
3. On a capture page, click **Sync contacts**.
4. **Expect**:
   - Request to `POST /api/sync/contacts` with 200.
   - Toast like “Enqueued N contact(s) for sync.”
   - Button count for contacts goes to 0 (or down).
5. **Verify**: In IndexedDB, those contacts have `pending_sync: false`. (Server-side: Redis/BullMQ has the job; your worker will create/update the contact in the DB.)

---

### Test 6: Sync audio (online)

1. Be **Online** and **signed in**.
2. MinIO (or S3) and Redis running and configured.
3. Have at least one pending item in **audio_transcript_queue** (e.g. from Test 2 or 3).
4. Click **Sync audio**.
5. **Expect**:
   - One or more `POST /api/sync/audio` (multipart) with 200.
   - Toast like “Synced N audio recording(s) to S3.”
   - “Sync audio” count drops (e.g. to 0).
6. **Verify**:
   - IndexedDB → **audio_transcript_queue**: those items have `status: "done"` and `processed_at` set.
   - MinIO/S3 bucket: new object(s) under e.g. `interactions/<id>-<uuid>.webm`.

---

### Test 7: Field online path (no fallback needed)

1. **Online**, go to **Field**, fill form and record audio, submit.
2. **Expect**: Request to `POST /api/contacts`, then `POST /api/interactions`; toast “Saved successfully.” No IndexedDB queue used for that submit.

---

### Test 8: Field online → API failure → offline fallback

1. **Online** but make the API fail (e.g. block ` /api/contacts` in DevTools, or stop your backend).
2. On **Field**, fill form, record audio, submit.
3. **Expect**: First request fails; app falls back to offline path and shows “Saved offline. Use Sync contacts and Sync audio when online.”
4. **Verify**: New contact and one audio item in IndexedDB as in Test 2.

---

## Quick checklist

| # | Scenario | What to do | Expected |
|---|----------|------------|----------|
| 1 | Offline stall contact | Submit contact on Stall while offline | Saved; contact in IDB with `pending_sync: true` |
| 2 | Offline field contact + audio | Submit with recording on Field while offline | Contact + audio row in IDB |
| 3 | Offline interaction audio | Save recording in Interaction capture while offline | New pending row in audio_transcript_queue |
| 4 | Sync UI | Offline → no buttons; Online → buttons + counts | Buttons hidden offline; visible with counts online |
| 5 | Sync contacts | Online, click Sync contacts | 200, toast, counts decrease, `pending_sync: false` |
| 6 | Sync audio | Online, click Sync audio (MinIO up) | 200, toast, items marked done, file in S3 |
| 7 | Field online | Submit on Field while online | Direct API save, success toast |
| 8 | Field API fail | Submit on Field, API fails | Fallback to offline save, IDB updated |

If all of the above pass, the end-to-end flow is working as designed.

---

## End-to-end queue testing (IndexedDB → BullMQ → Workers → DB)

Use this when you **already have data** in IndexedDB (`contacts` with `pending_sync: true` and/or `audio_transcript_queue` with pending items) and want to test the full path: **Sync buttons → API → BullMQ (Redis) → Workers → PostgreSQL + S3**.

### Prerequisites

| Requirement | Purpose |
|-------------|---------|
| **Redis (TCP)** | BullMQ needs a **TCP** connection. If using Upstash: in the dashboard use **Redis Connect** (not REST). Set `REDIS_URL` to that URL (e.g. `rediss://default:YOUR_PASSWORD@xxx.upstash.io:6379`). The REST URL (`https://...`) does **not** work with BullMQ workers. |
| **PostgreSQL** | `DATABASE_URL` in env. Workers upsert contacts and create interactions here. |
| **MinIO or S3** | For sync audio: API uploads the blob here; workers use the stored key. Set bucket + credentials in env (e.g. `MINIO_*` or AWS vars). |
| **App running** | e.g. `pnpm dev` or `pnpm dev:local`, and you are **logged in** (sync APIs require session). |
| **Workers running** | So jobs enqueued by the API are actually processed. |

### Step 1: Set REDIS_URL for BullMQ

- In `.env` or `.env.local.dev`: set **`REDIS_URL`** to the **Redis Connect (TCP)** URL.
- Upstash: Dashboard → your Redis → **Redis Connect** tab → copy the URL (starts with `rediss://` or `redis://`). Do **not** use the REST URL here for the workers.

### Step 2: Start the workers

In **two separate terminals** (or one with both):

```bash
# Terminal 1 – contacts worker
pnpm worker:contacts

# Terminal 2 – audio worker
pnpm worker:audio
```

Or run both together:

```bash
pnpm workers
```

You should see logs like:

- `[contacts-sync] Worker listening on queue "contacts-sync"`
- `[audio-transcript] Worker listening on queue "audio-transcript"`

Leave these running for the whole test.

### Step 3: Confirm IndexedDB data

1. Open the app in the browser (capture area, e.g. Field or Stall).
2. DevTools → **Application** → **Storage** → **IndexedDB** → **finbridge-capture**.
3. **contacts**: Note how many rows have `pending_sync: true` (these will be synced).
4. **audio_transcript_queue**: Note how many rows have `status: "pending"` and `contact_local_id` **not** starting with `draft-` (only these are synced; draft items are skipped).

If you have no pending contacts or no non-draft pending audio, add some offline first (e.g. go offline, add a contact on Stall, add contact + audio on Field), then continue.

### Step 4: Sync contacts first

1. Ensure you are **online** and **logged in**.
2. On a capture page you should see **Sync contacts (N)** and/or **Sync audio (M)** in the header.
3. Click **Sync contacts**.
4. **Expect**: Toast like “Enqueued N contact(s) for sync.”; the contacts count goes to 0 (or down).
5. In the **worker terminal** (contacts): you should see `[contacts-sync] Job &lt;id&gt; completed` for each job.
6. **Verify in DB**: In PostgreSQL, `contacts` table should have the new/updated rows, with **`offline_local_id`** set to the client’s `local_id` (so the audio worker can link later). You can use Prisma Studio (`pnpm prisma:studio:local`) or any SQL client.

### Step 5: Sync audio

1. Still online and logged in.
2. Click **Sync audio**.
3. **Expect**: One or more `POST /api/sync/audio` (multipart) with 200; toast like “Synced N audio recording(s) to S3.”; the audio count goes to 0 (or down).
4. In the **worker terminal** (audio): you should see `[audio-transcript] Job &lt;id&gt; completed` for each job.
5. **Verify**:
   - **IndexedDB** → **audio_transcript_queue**: synced items have `status: "done"` and `processed_at` set.
   - **S3/MinIO**: Bucket has new objects (e.g. `interactions/&lt;id&gt;-&lt;uuid&gt;.webm`).
   - **PostgreSQL**:  
     - **interactions** table has new rows with `audio_object_key` and `contact_id` pointing to the contact (resolved via `offline_local_id`).  
     - **ai_jobs** table has new rows linked to those interactions.

### Step 6: Order matters

- **Always sync contacts before audio** when testing. The audio worker looks up the contact by `offlineLocalId` (or `contact_server_id`). That id is set by the **contacts-sync** worker when it upserts. If you sync audio first, the contact may not exist yet and the audio job can fail with “Contact not found by offline_local_id”.

### Troubleshooting

| Issue | Check |
|-------|--------|
| “REDIS_URL must be set” or worker won’t start | Use the **Redis Connect (TCP)** URL in `REDIS_URL`, not the Upstash REST URL. |
| Sync contacts 200 but no DB rows | Workers not running, or wrong `DATABASE_URL` in the process that runs the workers (use same env as app). |
| Sync audio 200 but no Interaction in DB | Contacts not synced first (no `offlineLocalId`), or audio worker not running / wrong DB. |
| Sync audio 503 / upload failed | MinIO or S3 not reachable or env (bucket, credentials) wrong. |
| 401 on sync | Not logged in; sign in and try again. |

### Quick E2E checklist (you have data in IndexedDB)

| Step | Action | What to verify |
|------|--------|----------------|
| 1 | Set `REDIS_URL` (TCP), start workers | Worker logs “listening on queue …” |
| 2 | Open app, go to capture, stay online + logged in | Sync contacts (N) / Sync audio (M) visible |
| 3 | Click **Sync contacts** | 200, toast, worker logs “Job … completed”, contacts in DB with `offline_local_id` |
| 4 | Click **Sync audio** | 200, toast, worker logs “Job … completed”, items `done` in IDB, files in S3, rows in `interactions` + `ai_jobs` |
| 5 | (Optional) Prisma Studio | Inspect `contacts`, `interactions`, `ai_jobs` |
