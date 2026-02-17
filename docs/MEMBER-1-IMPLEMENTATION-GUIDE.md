# Member 1 – Implementation Guide  
## FinBridge: Data Ingestion & Offline-First Sync Engine

Senior-engineer-level guide for **Member 1** scope: Dual Capture, Offline Sync, De-duplication with Confidence, and Visiting Card Scan in both modes. Includes system design, terminology, flows, task list, and implementation plan.

---

## 1. Problem Statement & Product Context

**FinBridge** is a Conference Relationship Intelligence System (FinIdeas PS2): offline-first capture at conferences (stall + on-floor networking), structured follow-up, and revenue visibility. Judges care about offline reliability, stall + field capture, de-duplication, and business ROI.

**Member 1** owns the **data ingestion backbone**: everything from user input (manual or card scan) to clean, de-duplicated, synced records in PostgreSQL. No lead is lost; no lead is duplicated unnecessarily; no silent overwrites.

---

## 2. Roles (Plain Language)

| Role | Who | What they do |
|------|-----|----------------|
| **Visitor** | Conference attendee | Fills form at stall (kiosk) or shares details with RM. Does not see backend. |
| **RM (Relationship Manager)** | Field executive | Walks the floor, meets prospects informally, uses Field Mode for quick capture and optional voice notes. |
| **Admin / Leadership** | Managers | Use dashboard and analytics. Expect clean data and no duplicate inflation. |
| **System** | The webapp | Stores leads offline, syncs when online, deduplicates, merges safely, keeps one source of truth. |

**On-floor networking** = team members meeting prospects casually on the conference floor (not only at the stall). Field Mode exists to capture these interactions quickly and offline.

---

## 3. End-to-End Workflow (Simple)

1. **Conference starts** – Event selected; PWA ready; may be offline.
2. **Lead capture** – **Stall**: visitor uses tablet (kiosk). **Field**: RM uses phone/tablet (quick capture, optional audio).
3. **Local storage** – All leads written to IndexedDB first; no dependency on network.
4. **Sync** – When online, unsynced records are sent in batch to the server.
5. **Duplicate check** – Server scores match (email, phone, fuzzy name); high confidence → merge; medium → ask; low → new contact.
6. **Canonical update** – Server returns canonical record; client updates local copy and marks synced.
7. **Intelligence (Member 2)** – Audio transcribed; insights extracted; lead score updated.
8. **Follow-up & dashboard (Member 3)** – Stages, reminders, ROI, heatmaps.

Member 1 owns steps 2–6 (capture, local storage, sync, dedup, canonical update).

---

## 4. Technical Terms Glossary

| Term | Meaning |
|------|--------|
| **Dual Capture** | Two UIs (Stall + Field) writing into the same data schema and local store. |
| **Offline-first** | App works without internet; data is saved locally first, then synced to the cloud when possible. |
| **IndexedDB** | Browser key-value store for structured data. Acts as primary write store for contacts and drafts. |
| **Sync engine** | Logic that detects connectivity, batches unsynced records, calls `/api/sync`, and updates local state from server response. |
| **De-duplication** | Detecting and merging records that represent the same real-world contact (by email, phone, name similarity). Local check runs against **all** contacts in IndexedDB (stall + field) so the same contact is never added twice regardless of capture mode. |
| **Confidence score** | Percentage indicating how likely two records are the same person (e.g. 87% → suggest merge). |
| **Version / versioning** | Integer per record; used for optimistic concurrency: “last write wins” or merge without blind overwrite. |
| **Canonical record** | Authoritative version of a contact after server-side merge/insert; client replaces local copy with this. |
| **Kiosk pattern** | UI for shared device: locked navigation, minimal fields, auto-reset after submit, session isolation. |
| **Intent tags** | Structured labels (e.g. Wealth Management, Tax Planning, PMS, Networking) stored as array; used for scoring and analytics. |
| **pending_sync** | Flag on local record: `true` until server has accepted it and returned canonical data. |
| **local_id** | Client-generated UUID; stable until server returns `server_id`. |
| **device_id** | Identifier for the capture device; used in sync and conflict attribution. |
| **Event sourcing (optional)** | Storing a log of events (ContactCreated, NoteAdded, etc.) instead of only current state; enables audit and advanced merge. |
| **CRDT-style merge** | Conflict-free merge idea: combine updates (e.g. union tags, append notes) instead of overwriting. |
| **Idempotency** | Sending the same request again has the same effect (e.g. same `local_id` → no duplicate insert). |

---

## 5. System Design Principles

- **Local-first** – IndexedDB is primary; server is consistency and dedup layer.
- **Write-first** – Capture never blocks on network; every submit writes to IndexedDB immediately.
- **Eventual consistency** – Local and server converge after sync; no strong consistency requirement during capture.
- **Optimistic concurrency** – Version field; merge rules (append notes, union tags, prefer longer name) instead of blind overwrite.
- **Weighted dedup** – Multiple signals (email, phone, fuzzy name) combined into one confidence score.
- **Idempotent sync** – Same `local_id` re-sent does not create duplicate; server uses it to update or merge.
- **Non-destructive merge** – Never drop data; append or union; keep audit trail where feasible.

---

## 6. Member 1 Scope (What You Own)

| # | Feature | Short description |
|---|--------|-------------------|
| 1 | **Intelligent Dual Capture Engine** | Stall (kiosk) + Field (RM) modes; same schema; context tags (event, booth, time); ~30s capture goal; intent buttons. |
| 2 | **Offline-First Sync Engine** | IndexedDB + batch sync; version-based conflict resolution; per-record processing; no global transaction. |
| 3 | **De-duplication with Confidence Meter** | Weighted matching (email, phone, fuzzy name); confidence %; merge vs keep separate; merge strategy (append notes, union tags). |
| 4 | **Visiting Card Scan (both modes)** | Scan in Stall and Field; image → OCR → structured fields → prefill form; offline queue when no network. |

You **do not** own: transcription, NLP extraction, lead scoring formula, follow-up scheduler, dashboard, or heatmaps (Members 2 & 3).

---

## 7. Where Each Member Works (Flow)

```
[ Stall / Field UI + Card Scan ]  ← Member 1 (Capture)
            ↓
[ IndexedDB: contacts, draft, ocr_queue ]  ← Member 1 (Local storage)
            ↓
[ Sync engine: batch → /api/sync ]  ← Member 1 (Client + API)
            ↓
[ PostgreSQL: contacts, interactions, events ]  ← Member 1 (Dedup + merge in API)
            ↓
[ Audio → Transcribe, Extract, Score ]  ← Member 2 (Intelligence)
            ↓
[ Stages, Follow-ups, Dashboard, Heatmap ]  ← Member 3 (Engagement & analytics)
```

- **Member 1** – Capture UI, IndexedDB schema, sync client, `/api/sync`, dedup/merge logic, OCR queue and prefill (OCR service may be Member 2; you own integration and offline queue).
- **Member 2** – Transcription, structured extraction, lead score inputs.
- **Member 3** – Scoring formula consumption, follow-up engine, ROI dashboard, relationship heatmap.

---

## 8. Detailed Flows

### 8.1 Manual entry (Stall + Field)

1. Open `/stall` or `/field`; load `event_id`, `device_id`; restore draft from IndexedDB if present.
2. User enters name, phone, email (optional), intent tags; draft auto-saved on change.
3. On submit: validate → normalize phone/email → **local duplicate pre-check** (against **all** contacts in IndexedDB, whether from stall or field) → generate `local_id` → write to IndexedDB (`pending_sync = true`, `version = 1`) → clear draft → reset form / success.
4. No server call at submit; sync runs separately (online event, interval, or manual).
5. **Single contacts store:** Stall and field both write to the same IndexedDB contacts store. The duplicate check must consider every contact in that store so a lead captured at the stall is not added again from field (and vice versa).

### 8.2 Visiting card scan (both modes)

1. User taps “Scan card” (Stall and Field).
2. Camera capture → preview → confirm or retake.
3. **If online**: send image to OCR API → receive `{ name, phone, email, company, confidence? }` → prefill form; user edits and confirms.
4. **If offline**: store image in IndexedDB `ocr_queue` (e.g. `status: pending_ocr`); user can continue with manual entry; when online, process queue and prefill when ready.
5. Final save same as manual: normalize → **local dedup check (all contacts, stall + field)** → save to IndexedDB with `pending_sync = true`, `version = 1`.

Offline: OCR runs when back online; optionally link OCR result to existing draft or new contact.

### 8.3 Sync engine

1. Trigger: `navigator.onLine`, periodic timer, or manual “Sync” button.
2. (Optional) Process **OCR queue** first: send pending images to OCR API, get structured data, update draft or create contact, mark queue item processed.
3. Load all contacts where `pending_sync === true`; batch to `POST /api/sync` with `device_id` and array of contacts.
4. For each item in response: update local record with `server_id`, new `version`, `canonical_data`; set `pending_sync = false`.
5. If app restarts mid-sync, same pending records are sent again (idempotent by `local_id`).

### 8.4 Server dedup and merge (`/api/sync`)

For each incoming contact:

1. Normalize: trim, lowercase email, normalize phone (digits, country code).
2. Find candidates: exact email, exact phone, fuzzy name (e.g. Levenshtein or similar) above threshold.
3. Compute weighted confidence (e.g. email 50, phone 40, name 20, company 10; max 120 → `confidence = (score/120)*100`).
4. **No match** → insert new contact; return canonical with `server_id`, `version = 1`.
5. **Match** → resolve by version: if client version newer, merge server data into client; if server newer, merge client into server. Merge rules: keep non-null, longer name wins, union tags, append notes; set `updated_at` server-side; increment version; return canonical.
6. Optional: 60–80% confidence → return “needs_review” and let client show “Possible duplicate – merge?” modal.

---

## 9. Data Models

### 9.1 IndexedDB (Dexie or raw IDB)

- **contacts** (single store for stall + field)  
  `local_id`, `server_id?`, `name`, `phone`, `email?`, `company?`, `intent_tags[]`, `source_mode` (stall|field), `version`, `pending_sync`, `device_id`, `updated_at`, `event_id`, etc.  
  **Duplicate check:** Before adding a contact (from stall or field), check normalized phone/email against **all** contacts in this store **and** (when online) against the **PostgreSQL Contact table** via `POST /api/contacts/check-duplicate`, so the same person is never added twice locally or in the DB.
- **draft**  
  `mode` (stall|field), partial form state (and optionally `event_id`, `device_id`) for recovery after refresh/crash.
- **ocr_queue**  
  `image_id`, `image_blob`, `mode`, `status` (pending_ocr | processed), `linked_contact_id?`, `created_at`.
- **sync_meta** (optional)  
  `last_sync_time`, `device_id`.

### 9.2 PostgreSQL (Prisma) – to extend

Current boilerplate has `User`, `PasswordResetToken`. You add (conceptually):

- **Contact** – id, name, phone, email, company, intent_tags (JSON/array), source_mode, event_id, device_id, version, pending_sync, created_at, updated_at. Used by duplicate check API (`/api/contacts/check-duplicate`) and by sync when uploading local contacts.
- **Interaction** (for Member 2) – contact_id, type, audio_url, transcript, extracted_capacity, etc.
- **Event** – id, name, location, start_date, end_date.
- **Sync/audit** – optional table for merge history or event log.

Exact schema should match team agreement and Prisma migrations.

---

## 10. Kiosk Pattern (Stall Mode) – Technical

- **Constrained UI**: Dedicated route (e.g. `/stall`); no sidebar/full nav; prevent accidental back or exit.
- **Session isolation**: No reliance on logged-in user for submission; each submit gets `event_id`, `device_id`, `source_mode = "stall"`.
- **Auto-reset**: After submit, clear form and draft, focus first field, short success state then ready for next visitor.
- **Draft recovery**: On load, restore draft from IndexedDB; optionally “Continue previous entry?” to avoid loss on refresh/crash.
- **Large intent buttons**: Predefined intent list (e.g. Wealth Management, Tax Planning, PMS, Networking, Just Inquiry); store as `intent_tags[]` for analytics and scoring; large tap targets for speed and fewer typing errors.

---

## 11. Edge Cases (Handling)

| Case | Handling |
|------|----------|
| Double submit | Disable submit button on first click; debounce; idempotent by `local_id`. |
| Same phone entered twice (same device) | Local pre-check; warn; allow override (e.g. office number). |
| Internet drops mid-sync | Per-record processing; only mark synced when server confirms; retry rest on next trigger. |
| App closed during sync | State in IndexedDB; on reopen, resend all `pending_sync` records. |
| Same lead captured on two devices offline | Server dedup merges; both devices get same canonical record. |
| Record edited offline then synced | Version comparison; merge strategy; server assigns canonical `updated_at`. |
| Clock skew | Do not trust client time for authority; server sets `updated_at`. |
| OCR fails / bad image | Show retake; optional confidence per field; never auto-submit without user confirm. |
| Multiple phones in one card | OCR returns array; user selects one (or primary). |
| Same card scanned twice | Optional image hash in queue to skip duplicate OCR; dedup by phone/email at sync. |
| Local storage corrupted | Don’t delete until server confirms; keep `pending_sync`; log for audit. |

---

## 12. Member 1 Task List (Implementation)

Use this as your ordered checklist. Dependencies: DB and API tasks after capture and IndexedDB.

### A. Capture UI

- [x] **A1** – Stall route and layout (kiosk: no nav, locked flow).
- [x] **A2** – Stall form: name, phone, email (optional), intent button grid; validation and normalize (phone/email).
- [x] **A3** – Draft auto-save to IndexedDB on field change; restore draft on load; “Continue previous entry?” when draft exists.
- [x] **A4** – Submit: validate → normalize → local duplicate check (all contacts, stall + field) → generate `local_id` → save to IndexedDB → clear draft → reset + success.
- [x] **A5** – Field route and layout (RM-optimized, one-handed).
- [x] **A6** – Field form: same schema as stall; minimal fields; intent tags; optional audio reference (store `audio_local_id` or similar for Member 2).
- [x] **A7** – Field draft and submit logic (same as stall, `source_mode = "field"`). Use the **same local duplicate check** (all contacts in IndexedDB, stall + field) before saving so a contact already captured at stall is not re-added from field.
- [ ] **A8** – “Scan card” button in both Stall and Field; open camera/capture flow.

### B. Visiting card scan

- [ ] **B1** – Image capture (file input or camera API); preview and retake.
- [ ] **B2** – Compress image (e.g. max width 1000px, JPEG, ~300KB) before upload or store.
- [ ] **B3** – If online: call OCR API (or Next.js proxy to Python service); receive structured JSON; prefill form; show confidence if available.
- [ ] **B4** – If offline: save image in `ocr_queue`; allow manual entry; when online, process queue and prefill.
- [ ] **B5** – Prefill form without auto-submit; user must confirm or edit.
- [ ] **B6** – Handle multiple phones/emails (e.g. dropdown or first/default).
- [ ] **B7** – Optional: image hash to avoid re-OCR for same card.

### C. IndexedDB layer

- [ ] **C1** – Define schema: `contacts`, `draft`, `ocr_queue`, (optional) `sync_meta`.
- [ ] **C2** – Use Dexie (or raw IndexedDB) with transactions for atomic writes.
- [ ] **C3** – `device_id` generation and persistence (e.g. localStorage + fallback UUID).
- [ ] **C4** – Helpers: add contact, update contact, get unsynced, update after sync, draft save/load, OCR queue add/process.

### D. Sync engine (client)

- [ ] **D1** – Online listener (`navigator.onLine`) and optional periodic sync (e.g. 30s).
- [ ] **D2** – Manual “Sync” button; disable when offline or when no pending.
- [ ] **D3** – Fetch all with `pending_sync === true`; batch to `POST /api/sync` with `device_id`.
- [ ] **D4** – Parse response; for each item update local record (canonical_data, server_id, version, pending_sync = false).
- [ ] **D5** – On app load, trigger sync if online and pending count > 0.
- [ ] **D6** – Optional: process OCR queue before contact sync (so prefilled contacts can sync in same session).

### E. Server API and dedup

- [ ] **E1** – `POST /api/sync`: accept `device_id`, `contacts[]`; validate body.
- [ ] **E2** – Per contact: normalize; find candidates (email, phone, fuzzy name); compute confidence.
- [ ] **E3** – No match → insert; match → version compare + merge; return canonical per contact.
- [ ] **E4** – Merge rules: non-null wins, longer name, union tags, append notes; server `updated_at`; version increment.
- [ ] **E5** – Optional: return `needs_review` for 60–80% confidence; client shows merge modal.
- [ ] **E6** – Idempotency: same `local_id` → update or merge, never duplicate insert.
- [ ] **E7** – Prisma schema and migrations for Contact (and related tables agreed with team).

### F. Integration and polish

- [ ] **F1** – Event selector (event_id) for capture; pass to all new contacts.
- [ ] **F2** – Sync status in UI (pending count, last sync time, error message).
- [ ] **F3** – Duplicate/merge modal when server returns “needs_review” or high-confidence match (merge vs keep separate).
- [ ] **F4** – Error handling and toasts (sync failure, OCR failure, validation).
- [ ] **F5** – Optional: audit log or event log for merges (who merged, when).

---

## 13. Implementation Plan (Order)

1. **IndexedDB + device_id** (C1–C4) – foundation for all capture and sync.
2. **Stall mode** (A1–A4) – full manual flow and draft.
3. **Field mode** (A5–A7) – same schema, different UX.
4. **Sync client** (D1–D5) – so stored contacts can sync once API exists.
5. **Sync API + dedup** (E1–E7) – Prisma Contact model, normalize, match, merge, return canonical.
6. **Visiting card** (B1–B7) – capture, queue, prefill, optional OCR service integration.
7. **OCR queue in sync** (D6) – process pending images when online.
8. **Merge UI and errors** (F1–F5).

---

## 14. Integration with Other Members

- **Member 2** – You provide: stable Contact IDs and optional audio reference (e.g. `audio_local_id` or file ref). They consume: contact_id, transcript/audio. They may run OCR service; you call it from Next.js (proxy or direct) and handle offline queue.
- **Member 3** – They read: Contact and related tables for stages, follow-ups, dashboard, heatmap. You guarantee: no duplicate inflation; clean merge and single canonical record per real contact. Optional: emit “contact_merged” or update so they can recompute scores/follow-ups.

---

## 15. Tech Stack (Aligned to Current Repo)

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind, existing UI components (e.g. ShadCN-style), Zustand if needed for capture state.
- **Local DB**: IndexedDB via Dexie (add dependency) or raw IDB.
- **Backend**: Next.js API routes; Prisma; PostgreSQL (existing).
- **OCR**: Next.js route that proxies to external OCR API or Python microservice (e.g. FastAPI + EasyOCR); you own queue and prefill; Member 2 may own OCR implementation.
- **PWA** (optional for offline): next-pwa or similar; Service Worker for caching; not required for first version of sync.

---

## 16. How to Present to Mentors (Short Pitch)

“I own the data ingestion backbone: dual capture (Stall kiosk + Field RM), visiting card scan in both modes with offline OCR queue, and local-first sync with version-based conflict resolution and weighted de-duplication. Leads are written to IndexedDB immediately, then batched to the server where we run fuzzy matching and non-destructive merge. We guarantee no data loss, no silent overwrites, and eventual consistency across devices so the rest of the system can rely on clean, de-duplicated contacts.”

---

## 17. Document Summary

| Section | Content |
|--------|---------|
| 1–2 | Problem, product, roles |
| 3 | End-to-end workflow (simple) |
| 4 | Technical terms glossary |
| 5–6 | System design and Member 1 scope |
| 7 | Where each member works in the flow |
| 8 | Detailed flows (manual, scan, sync, server dedup) |
| 9 | Data models (IndexedDB + PostgreSQL) |
| 10 | Kiosk pattern (Stall) |
| 11 | Edge cases |
| 12 | **Task list (checklist)** |
| 13 | Implementation order |
| 14–16 | Integration, stack, mentor pitch |

Use this doc as the single reference for scope, design, and execution for Member 1.
