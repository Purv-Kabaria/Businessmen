# System Architecture Analysis (February 2026)

## 1. High-Level Architecture
 The application has evolved into a **Hybrid Architecture** splitting responsibilities between Next.js and a Python FastAPI backend.

### **Frontend (Next.js)**
- **Role**: UI rendering, User Authentication, Database CRUD (Prisma), Interaction Management.
- **Key Pages**:
  - `app/moderator/audio`: Audio review dashboard.
  - `app/(capture)/stall`: Business card capture interface.
- **API Routes (Next.js)**:
  - `/api/interactions`: Data persistence.
  - `/api/contacts`: Contact management.
  - **Removed**: `/api/ocr/route.ts` (Legacy Node.js implementation removed).

### **AI Backend (Python FastAPI)**
- **Role**: Heavy compute tasks (OCR, Audio Transcription, LLM Intelligence).
- **Port**: `8000` (Localhost).
- **Key Endpoints**:
  - `POST /api/ocr`: Ensemble OCR pipeline.
  - `POST /api/transcribe`: Smart Audio Transcription.
  - `POST /api/extract-contact`: Contact information extraction from text.
  - `POST /api/summarize`: Meeting summarization.

---

## 2. Deep Dive: OCR Pipeline (Ensemble Approach)
Located in `python_backend/api/ocr.py` and `utils/ocr_utils.py`.

The system uses a **Tri-Stage Pipeline** to ensure maximum accuracy, even on blurry images:

1.  **Vision Pass (Llama 3.2 Vision 11B)**
    - **Preprocessor**: High-quality Upscaling + Unsharp Masking + Contrast Enhancement.
    - **Engine**: Ollama running `llama3.2-vision:11b`.
    - **Prompting**: "Two-stage" prompting (Transcribe literally -> Map to JSON) to reduce hallucinations.

2.  **Text Pass (Tesseract)**
    - **Engine**: `pytesseract` (Google Tesseract OCR).
    - **Configuration**: Multi-config (Standard + LSTM).
    - **Role**: Captures raw text that Vision models might miss or simplify (like complex URLs).

3.  **Consolidation Pass ("The Judge")**
    - **Engine**: `gemma3:4b` (Text-only LLM).
    - **Logic**: Compares Vision JSON and Tesseract Raw Text to resolve conflicts.
    - **Benefit**: Combines the structural understanding of Vision models with the character-level precision of OCR.

---

## 3. Deep Dive: Transcription Pipeline
Located in `python_backend/api/transcribe.py`.

1.  **Smart Segmentation**
    - Audio is split into ~25s chunks, but *only* at natural silence points (VAD-based).
    - Prevents cutting words in half.

2.  **Whisper Transcription**
    - Uses `faster-whisper` (CTranslate2 backend) for speed.
    - Runs on GPU if available, CPU otherwise.

3.  **Business Intelligence (Hotspots)**
    - Post-transcription, an LLM scans the text for "Hotspots" (Financial figures, Dates, Contact Info).
    - Frontend highlights these segments in yellow.

---

## 4. Environment Configuration
The `.env.shared.dev` file coordinates the services:

```env
# Next.js App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend Services Links
NEXT_PUBLIC_OCR_API_URL=http://localhost:8000
NEXT_PUBLIC_TRANSCRIBE_API_URL=http://localhost:8000

# AI Configuration
OLLAMA_MODEL=llama3.2-vision:11b
OLLAMA_HOST=http://127.0.0.1:11434
```

## 5. Recommendations & Cleanup
1.  **Proxy Configuration**: Currently, the frontend calls `localhost:8000` directly. This requires CORS and fails if the Python backend is on a different domain in production.
    - *Improvement*: Use Next.js Rewrites in `next.config.ts` to proxy `/api/python/*` to the Python backend.
3.  **Error Handling**: Ensure the Python backend has robust error reporting. Currently, it prints to console. Integrating Sentry or similar would be beneficial.

---

## 6. Setup Requirements
To run the full stack:
1.  **Node.js**: `npm run dev` (Port 3000)
2.  **Python**: `python -m uvicorn main:app --reload` (Port 8000)
3.  **Ollama**: `ollama serve` (Port 11434)
4.  **Tesseract**: Must be installed in system PATH.
