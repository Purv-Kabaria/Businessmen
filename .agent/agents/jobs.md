# OCR Business Card Scanning Feature – System Design & Implementation Guide

---

# 🎯 Objective

Build an offline-first Business Card OCR scanning system for Stall + Field Mode that:

- Works without internet
- Extracts structured contact information
- Uses phone number as deterministic identity key
- Pre-fills contact form automatically
- Integrates cleanly with existing Interaction API
- Is fast (≤ 3–5 seconds processing target)
- Never blocks UI

This document defines the **exact architecture, flow, implementation steps, and constraints**.

---

# 1️⃣ High-Level Architecture

User (Field or Stall Mode)
        |
        | Capture Card Image (Camera or Upload)
        ↓
Frontend (Next.js PWA)
        |
        | Image Preprocessing
        ↓
Tesseract.js (Client-Side OCR)
        |
        | Raw Extracted Text
        ↓
Text Parsing Engine (Regex + Heuristics)
        |
        | Structured Contact Object
        ↓
Contact Form (Prefilled)
        |
        | User Edits/Confirms
        ↓
Save to IndexedDB (Offline)
        |
        | Sync Later to Backend

IMPORTANT:
OCR runs entirely on client-side.
No network required.

---

# 2️⃣ Design Principles

- Offline-first (no server OCR calls)
- Deterministic parsing
- Phone number required for save
- User confirmation mandatory
- Fast processing
- Lightweight UI
- Progressive enhancement (manual fallback always available)

---

# 3️⃣ Tech Stack

Frontend:
- Next.js 15
- WebRTC getUserMedia (camera)
- Tesseract.js
- Canvas API (image preprocessing)
- Regex-based parsing
- IndexedDB (Dexie.js)

No backend OCR.
No cloud APIs.
No paid tools.

---

# 4️⃣ OCR Processing Flow

## Step 1: Capture Image

Options:
- Camera capture (preferred)
- Image upload fallback

Use:
navigator.mediaDevices.getUserMedia()

Save image as:
- Base64
- Blob
- Canvas image

---

## Step 2: Image Preprocessing (Critical for Accuracy)

Before OCR:

1. Convert to grayscale
2. Increase contrast
3. Resize if too large
4. Crop unnecessary margins
5. Optional: Edge detection

Use:
Canvas API

Pseudo-flow:

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

ctx.drawImage(image, 0, 0);
applyGrayscale();
increaseContrast();

---

## Step 3: Run Tesseract.js

Example:

import Tesseract from 'tesseract.js';

const result = await Tesseract.recognize(
  imageBlob,
  'eng',
  { logger: m => console.log(m) }
);

const rawText = result.data.text;

Important:
- Show loading indicator
- Do NOT freeze UI thread
- Use Web Worker version of Tesseract

---

# 5️⃣ Text Parsing Engine (Critical Layer)

Tesseract gives messy text.
You must structure it.

## Parsing Strategy

Extract:

- Phone number
- Email
- Name
- Company
- Designation

---

## Phone Extraction (Highest Priority)

Regex:

const phoneRegex = /(\+?\d{1,3}[\s-]?)?\d{10}/g;

Rules:
- Remove spaces/dashes
- Normalize country code
- Convert to consistent format

Phone is mandatory.

---

## Email Extraction

const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

---

## Name Heuristic

Heuristic approach:
- First line of card
- Capitalized words
- Not containing numbers
- Not email
- Not company suffix (Pvt Ltd, LLP)

---

## Company Detection

Look for keywords:
- Pvt
- Ltd
- LLP
- Inc
- Advisors
- Capital
- Finance

---

## Output Format

{
  name: string | null,
  phone: string | null,
  email: string | null,
  company: string | null,
  designation: string | null,
  raw_text: string
}

---

# 6️⃣ Identity Handling Integration

After extraction:

if (phone exists in local IndexedDB OR DB):
    show warning:
    "This contact already exists."
    display:
        - Previous RM
        - Last interaction
else:
    allow save

Phone is deterministic key.
No fuzzy dedup.

---

# 7️⃣ UI Flow

User → Scan Card
→ OCR Processing Screen
→ Structured Preview Screen
→ Editable Fields
→ Confirm & Save

Important:
User MUST confirm.
Never auto-save blindly.

---

# 8️⃣ Offline Handling

- OCR runs offline.
- Extracted contact saved in IndexedDB.
- Mark pending_sync = true.
- Sync later via Sync Engine.

No network dependency.

---

# 9️⃣ Performance Targets

- Image capture: < 1s
- OCR processing: 2–5s
- Parsing: < 100ms
- Total time: < 6 seconds

If slower:
- Resize image before OCR
- Limit resolution
- Reduce preprocessing complexity

---

# 🔟 Error Handling

If OCR fails:
- Show "Low confidence. Please enter manually."
- Allow manual entry

If phone not detected:
- Prompt: "Please enter phone number manually."

Never block capture.

---

# 1️⃣1️⃣ Security & Privacy

- No image sent to server.
- OCR entirely client-side.
- No cloud dependency.
- Raw image not stored unless confirmed.
- Delete image after extraction (optional).

---

# 1️⃣2️⃣ File Structure

frontend/
│
├── modules/
│   ├── ocr/
│   │   ├── CardScanner.tsx
│   │   ├── ImageProcessor.ts
│   │   ├── OcrService.ts
│   │   ├── TextParser.ts
│   │   └── IdentityCheck.ts
│

---

# 1️⃣3️⃣ Development Order

Phase 1:
- Camera capture component

Phase 2:
- Integrate Tesseract.js

Phase 3:
- Implement parsing engine

Phase 4:
- Prefill contact form

Phase 5:
- Integrate identity check

Phase 6:
- Polish UX and performance

---

# 1️⃣4️⃣ Testing Strategy

Test with:

- Clean printed cards
- Noisy background
- Tilted cards
- Multiple phone numbers
- Cards without phone
- Cards with multiple emails
- Low lighting
- Blurry image

Manually verify:
- Phone detection accuracy
- Email extraction
- Name heuristic

---

# 1️⃣5️⃣ Definition of Done

✔ Camera capture works  
✔ OCR works offline  
✔ Text parsing extracts phone reliably  
✔ Prefilled form editable  
✔ Identity check works  
✔ Saves offline  
✔ Sync compatible  
✔ UI responsive  

---

# 1️⃣6️⃣ Known Limitations

- Fancy card designs may reduce OCR accuracy
- Multi-language cards not supported (initially English only)
- Manual correction always required

---

# 1️⃣7️⃣ Design Philosophy

- Accuracy > automation
- User confirmation mandatory
- Deterministic identity > fuzzy matching
- Offline-first is non-negotiable
- Fast UX > complex preprocessing

---

# Final Outcome

This OCR feature enables:

- Fast stall capture
- Fast field capture
- Reduced manual typing
- Deterministic identity resolution
- Offline reliability
- Seamless integration with Interaction + AI job pipeline

This document defines the complete system design and implementation flow for the OCR card scanning feature.
