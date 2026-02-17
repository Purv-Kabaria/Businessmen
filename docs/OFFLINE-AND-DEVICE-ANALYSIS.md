# FinBridge: Offline & Device Analysis

Deep analysis of where features work offline vs online, and where they fail (including mobile and scan-card / Gemma limitations).

---

## 1. Architecture Overview: Two Parallel Systems

The codebase has **two separate capture/sync paths** that are not unified:

| System | Routes | Storage | Sync to server |
|--------|--------|---------|----------------|
| **Capture (Stall / Field)** | `/(capture)/stall`, `/(capture)/field` | IndexedDB `finbridge-capture` (`modules/capture/db.ts`) — contacts + draft | **Not implemented** — no code POSTs to API |
| **Offline page** | `/offline` | Dexie `FinBridgeDB` (`lib/db.ts`) — contacts + interactions | **Implemented** — `sync-service` + `useSyncManager` sync when online |

Implication: contacts saved on **Stall/Field** never leave the device. Contacts saved on **Offline page** sync when online (if user is logged in).

---

## 2. Feature-by-Feature Analysis

### 2.1 Scan Card / Visiting Card

| Where | What happens | Offline? | Mobile? | Fails / limitations |
|-------|----------------|----------|---------|---------------------|
| **Stall & Field** (`CardScanButton`) | User picks "Upload image" or "Scan card" → camera or file picker → **image stored in React state only**. No OCR, no API call. | ✅ Yes — capture only, no network | ✅ Yes — camera/upload work on mobile browsers (HTTPS required) | **No extraction.** Image is not used to prefill form; user must type everything. Card is "attached" in UI only (e.g. for future use). |
| **Offline page** ("Scan Business Card (AI)") | Uses `CameraCapture` → capture/upload image → **POST /api/ocr** → server calls **Ollama** (Gemma) at `OLLAMA_HOST` (default `http://127.0.0.1:11434`) → returns name/phone/email/company → form prefilled. | ❌ No | ❌ No (in typical deployment) | See below. |

**Why "Scan Business Card (AI)" fails on mobile and often offline:**

1. **Requires network**  
   `fetch("/api/ocr")` needs the browser to reach the Next.js server. If the user is offline, the request fails.

2. **Ollama runs on the server, not on the user’s device**  
   `/api/ocr` calls `OLLAMA_HOST` (default `127.0.0.1:11434`). That is the **server’s** localhost (the machine running Next.js), not the phone or laptop. So:
   - **Mobile:** User opens the app in a browser; the request hits your hosted Next.js (e.g. Vercel/Railway). The API runs on that host and tries `127.0.0.1:11434`. There is no Ollama on Vercel/Railway. **Result: OCR fails on mobile** unless you deploy Next.js on a machine where Ollama is also installed and running.
   - **Desktop (same machine):** If the user runs Next.js locally and Ollama locally on the same machine, `127.0.0.1:11434` works. **Scan works only in that setup** (e.g. dev laptop with `ollama run gemma3:4b`).

3. **Gemma 3 must be present where Ollama runs**  
   `OLLAMA_MODEL` defaults to `gemma3:4b`. That model must be pulled on the same machine that runs Ollama (`ollama pull gemma3:4b`). If that machine is a server, Gemma must be downloaded there; it does **not** run in the browser or on the user’s phone.

**Summary:**  
- **Stall/Field "Scan card":** Works offline and on mobile, but only captures an image; no automatic extraction, no Gemma.  
- **Offline page "Scan Business Card (AI)":** Uses Gemma via Ollama; works only when (a) online, (b) Next.js and Ollama run on the same host, (c) Gemma is installed on that host. **Fails on mobile** in normal cloud deployments and **fails offline** always.

---

### 2.2 Contact Form & Save (Stall / Field)

| Step | Offline? | Mobile? | Fails / limitations |
|------|----------|---------|---------------------|
| Load draft from IndexedDB | ✅ Yes | ✅ Yes | None. |
| Duplicate check | Partial | ✅ Yes | **Offline:** Only IndexedDB is checked. If the contact already exists only on the server, duplicate is not detected. **Online:** IndexedDB + POST `/api/contacts/check-duplicate` (no auth). |
| Submit (save contact) | ✅ Yes | ✅ Yes | Data saved to IndexedDB `finbridge-capture` with `pending_sync: true`. **Sync to server is not implemented** — nothing calls `getUnsyncedContacts()` and POSTs to `/api/contacts`. Contacts stay on device. |
| Success / "We'll sync when you're back online" | ✅ Yes | ✅ Yes | Message is shown but sync does not exist for this flow. |

---

### 2.3 Contact Form & Save (Offline Page)

| Step | Offline? | Mobile? | Fails / limitations |
|------|----------|---------|---------------------|
| QuickCaptureForm save | ✅ Yes | ✅ Yes | Saves to **Dexie** `FinBridgeDB`, not capture IndexedDB. |
| Sync when online | ✅ Yes (sync runs when online) | ✅ Yes | **Requires login.** `POST /api/contacts` and `POST /api/interactions` use `verifySession()`. If the user is not logged in, sync returns 401 and pending data stays local. |
| SyncIndicator / useSyncManager | N/A (needs online) | ✅ Yes | Counts pending in Dexie; on "online" event triggers sync. Works on mobile if online and logged in. |

---

### 2.4 Audio Recording

| Where | Offline? | Mobile? | Fails / limitations |
|-------|----------|---------|---------------------|
| **Field page** | ✅ Yes (ref only) | ✅ Yes | Optional "Add voice note ref" stores `audio_local_id` on the contact in IndexedDB. No actual audio blob is stored in capture DB; no transcript. |
| **Offline page** (InteractionCapture) | ✅ Yes | ✅ Yes (HTTPS) | `getUserMedia({ audio: true })`; records to Blob; saves to Dexie with `audioBlob`. **Mobile:** Requires secure context (HTTPS or localhost). HTTP on mobile often blocks mic. |

---

### 2.5 Duplicate Check (Stall / Field)

| Scenario | Behavior |
|----------|----------|
| Offline | Only IndexedDB (capture store) is checked. Server-side duplicates are not seen → user can add a contact that already exists in PostgreSQL. |
| Online | IndexedDB + `POST /api/contacts/check-duplicate`. No auth. Works from mobile/desktop. |

---

### 2.6 Sync (When Online)

| Data source | Synced? | Auth | Note |
|-------------|---------|------|------|
| **Capture (Stall/Field)** — IndexedDB `finbridge-capture` | ❌ No | N/A | No sync worker or API call implemented. `getUnsyncedContacts()` exists but is never used to POST. |
| **Offline page** — Dexie contacts + interactions | ✅ Yes | Required | `sync-service` + `useSyncManager` sync to `/api/contacts` and `/api/interactions`. Both require session; unauthenticated sync fails. |

---

### 2.7 Camera & Microphone Access

| Feature | Offline? | Mobile? | Fails / limitations |
|---------|----------|---------|---------------------|
| Camera (capture/upload) | ✅ Yes (no OCR) | ✅ Yes on HTTPS | `getUserMedia({ video })` or file input. **Mobile:** Must be secure context (HTTPS). HTTP on mobile often denies camera. |
| Microphone (Offline page) | ✅ Yes | ✅ Yes on HTTPS | Same secure-context requirement. |
| CameraCapture (Offline page) | ❌ No (needs OCR API) | ❌ No (Ollama on server) | Camera works, but "Use Photo" triggers `/api/ocr` which fails offline and on mobile in typical deployments. |

---

### 2.8 Auth & Capture Routes

| Route | Auth required? | Note |
|-------|-----------------|------|
| `/(capture)/stall`, `/(capture)/field` | No | No `verifySession` in layout or page. Kiosk/guest can use. |
| `/offline` | Not enforced in UI | Page loads without login; sync will fail with 401 if not logged in. |
| `POST /api/contacts` | Yes | Used by sync-service; stall/field don’t call it yet. |
| `POST /api/contacts/check-duplicate` | No | Public. |
| `POST /api/ocr` | No | Public; fails if Ollama unreachable. |

---

### 2.9 PWA / Offline Shell

| Item | Status |
|------|--------|
| Service worker | **None** found. No offline caching of app shell or static assets. |
| First load | Requires network. Once loaded, SPA can continue to work offline for in-memory/IndexedDB operations. |
| Reload / new tab while offline | Fails if the app is not cached by the browser (e.g. no service worker). |

---

## 3. Summary Tables

### Where features work offline vs fail

| Feature | Works offline? | Fails when |
|---------|----------------|------------|
| Stall/Field: form, draft, save to IndexedDB | ✅ Yes | — |
| Stall/Field: duplicate check (server-side) | ❌ No | Offline: only local duplicates considered. |
| Stall/Field: sync to server | N/A | Sync not implemented; data never sent. |
| Stall/Field: Scan card (capture image only) | ✅ Yes | — |
| Stall/Field: Scan card (extract text) | N/A | No extraction in this flow. |
| Offline page: save contact/interaction to Dexie | ✅ Yes | — |
| Offline page: sync to server | ❌ No (until online) | Requires online + logged in. |
| Offline page: Scan Business Card (AI) | ❌ No | Needs network + Ollama on server. |
| Camera (image capture) | ✅ Yes | — |
| Microphone (audio) | ✅ Yes | — |

### Where features work on mobile vs fail

| Feature | Works on mobile? | Fails when |
|---------|-------------------|------------|
| Stall/Field: full flow (no OCR) | ✅ Yes | If not HTTPS: camera/file may be restricted. |
| Offline page: save contact/interaction | ✅ Yes | Same HTTPS note. |
| Offline page: Sync when online | ✅ Yes | If not logged in, 401. |
| Offline page: Scan Business Card (AI) | ❌ No (typical deployment) | API calls server’s localhost Ollama; server usually has no Ollama. |
| Camera / mic | ✅ Yes on HTTPS | HTTP or insecure context can block. |

### Scan card: two flows

| Flow | Location | Extraction | Offline? | Mobile? |
|------|----------|------------|----------|---------|
| Capture only | Stall, Field | None — image in state only | ✅ Yes | ✅ Yes |
| AI scan (Gemma/Ollama) | Offline page | Server: Ollama + Gemma 3 | ❌ No | ❌ No (unless server runs Ollama and is reachable) |

---

## 4. Recommendations (Brief)

1. **Unify or document the two systems** — Either sync capture IndexedDB to the same API (with or without auth), or clearly document that Stall/Field are kiosk-only and never sync.
2. **Scan card (Stall/Field)** — To get extraction on mobile/offline, use client-side OCR (e.g. Tesseract.js as in `.agent/agents/jobs.md`) or a cloud OCR API when online; keep current capture-only flow as fallback.
3. **OCR (Offline page)** — If AI scan must work on mobile, run Ollama (or another vision model) on a reachable server and set `OLLAMA_HOST` to that server; or switch to a cloud vision/OCR API.
4. **Sync (Stall/Field)** — Implement a client that calls `getUnsyncedContacts()` and POSTs to `/api/contacts` when online; decide auth (e.g. device token for kiosk vs session for logged-in users).
5. **HTTPS** — Use HTTPS in production so camera/mic work on mobile.
6. **Service worker** — Add a minimal service worker to cache the app shell so the app loads from cache when offline (optional but improves offline UX).

This document reflects the state of the codebase at the time of analysis; implementation may have changed since.
