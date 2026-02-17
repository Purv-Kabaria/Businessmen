# Audio pipeline test scripts

Scripts to test the **transcriber**, **sentiment analysis**, and **summarizer**. **Audio tests run on WebM only** (`.webm`); use `public/voice.webm` or any path ending in `.webm`.

## Prerequisites

- **Transcriber & summarizer**: Python backend (`main.py`) must be running, e.g.  
  `cd python_backend && uvicorn main:app --host 0.0.0.0 --port 8000`
- **Sentiment**: Analyze microservice (`main_analyze.py`) must be running if you use the sentiment script or full pipeline.  
  If both backends run on the same machine, start the analyze service on another port and set `ANALYZE_SERVICE_URL`:
  - `cd python_backend && uvicorn main_analyze:app --host 0.0.0.0 --port 8001`
  - `ANALYZE_SERVICE_URL=http://localhost:8001 pnpm exec tsx scripts/test-sentiment.ts`
- Put your audio at **`public/voice.webm`** (or any `.webm` file) and pass the path when needed.

## Scripts

| Script | What it does | Backend |
|--------|----------------|--------|
| `test-transcriber.ts` | Uploads a **.webm** file (default `public/voice.webm`), prints transcript + sentiment | main.py :8000 |
| `test-sentiment.ts` | Sends transcript to analyze service, prints per-segment sentiments | main_analyze.py (default :8000) |
| `test-summarizer.ts` | Sends text to summarizer (Ollama), prints summary | main.py :8000 |
| `test-all-pipeline.ts` | Runs transcribe (WebM) → sentiment → summarizer; writes `public/transcript.txt` | main + analyze |
| `seed-interaction-from-audio.ts` | Creates a DB interaction from `public/voice.webm` + `public/transcript.txt` (uploads audio to S3) | DB + MinIO |

## Usage

From the **project root**:

```bash
# Transcribe public/voice.webm (default; WebM only)
pnpm exec tsx scripts/test-transcriber.ts

# Transcribe a specific .webm file
pnpm exec tsx scripts/test-transcriber.ts path/to/audio.webm

# Sentiment on sample text (or use public/transcript.txt if present)
pnpm exec tsx scripts/test-sentiment.ts

# Sentiment from a transcript file
pnpm exec tsx scripts/test-sentiment.ts public/transcript.txt

# Summarize from stdin
cat public/transcript.txt | pnpm exec tsx scripts/test-summarizer.ts -

# Run full pipeline (WebM): transcribe voice.webm → sentiment → summarize
pnpm exec tsx scripts/test-all-pipeline.ts
pnpm exec tsx scripts/test-all-pipeline.ts path/to/other.webm

# Create a DB entry from public/voice.webm + public/transcript.txt (uploads to S3, creates Contact + Interaction)
pnpm seed:interaction
pnpm exec tsx scripts/seed-interaction-from-audio.ts path/to/audio.webm path/to/transcript.txt
```

## Environment

- **PYTHON_BACKEND_URL** – main Python backend (transcribe, summarize). Default: `http://localhost:8000`
- **ANALYZE_SERVICE_URL** – analyze microservice (sentiment + summary). Default: `http://localhost:8000`

If both run on the same host, use different ports and set `ANALYZE_SERVICE_URL` when testing sentiment or the full pipeline.
