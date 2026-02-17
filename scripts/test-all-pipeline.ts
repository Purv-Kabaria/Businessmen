/**
 * Run transcriber → sentiment → summarizer in sequence. Audio must be WebM (.webm).
 * Default: public/voice.webm. Writes public/transcript.txt after transcription.
 *
 * Usage: pnpm exec tsx scripts/test-all-pipeline.ts [path/to/audio.webm]
 *
 * Requires:
 *   - Python backend (main.py) on PYTHON_BACKEND_URL (default http://localhost:8000)
 *   - Analyze service (main_analyze.py) on ANALYZE_SERVICE_URL (default http://localhost:8000)
 *     If both run on the same machine, start analyze on 8001 and set ANALYZE_SERVICE_URL=http://localhost:8001
 */

import { createReadStream, existsSync, writeFileSync } from "fs";
import { join } from "path";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
const ANALYZE_SERVICE_URL = process.env.ANALYZE_SERVICE_URL || "http://localhost:8000";
const WEBM_EXT = ".webm";
const defaultAudioPath = join(process.cwd(), "public", "voice.webm");
const transcriptPath = join(process.cwd(), "public", "transcript.txt");
const audioPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : defaultAudioPath;

function ensureWebm(path: string): void {
  if (!path.toLowerCase().endsWith(WEBM_EXT)) {
    console.error("Audio tests run on WebM only. File must have a .webm extension:", path);
    process.exit(1);
  }
}

function readFile(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path)
      .on("data", (chunk: string | Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

async function step1Transcribe(): Promise<string> {
  const filename = audioPath.split(/[/\\]/).pop() || "voice.webm";
  console.log("1. Transcribe (main backend, WebM)");
  const buf = await readFile(audioPath);
  const form = new FormData();
  form.set("audio", new Blob([new Uint8Array(buf)], { type: "audio/webm" }), filename);
  const res = await fetch(`${PYTHON_BACKEND_URL}/api/transcribe`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error || json?.detail || res.statusText);
  }
  const transcript = (json.data?.transcript as string) || "";
  writeFileSync(transcriptPath, transcript, "utf-8");
  console.log("   Transcript length:", transcript.length, "chars (saved to public/transcript.txt)");
  return transcript;
}

async function step2Sentiment(transcript: string): Promise<void> {
  console.log("2. Sentiment (analyze service)");
  const res = await fetch(`${ANALYZE_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  const sentiments = json.sentiments;
  console.log("   Segments with sentiment:", Array.isArray(sentiments) ? sentiments.length : 0);
}

async function step3Summarize(transcript: string): Promise<void> {
  console.log("3. Summarize (main backend)");
  const res = await fetch(`${PYTHON_BACKEND_URL}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: transcript, model: "gemma3:4b" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json?.error || res.statusText);
  console.log("   Summary length:", (json.summary || "").length, "chars");
}

async function main() {
  if (!existsSync(audioPath)) {
    console.error("Audio not found:", audioPath);
    process.exit(1);
  }
  ensureWebm(audioPath);
  console.log("Pipeline test (WebM): transcriber → sentiment → summarizer");
  console.log("  Audio:  ", audioPath);
  console.log("  Main:   ", PYTHON_BACKEND_URL);
  console.log("  Analyze:", ANALYZE_SERVICE_URL);
  console.log("");

  try {
    const transcript = await step1Transcribe();
    if (!transcript.trim()) {
      console.log("   (empty transcript, skipping sentiment/summary)");
      return;
    }
    await step2Sentiment(transcript);
    await step3Summarize(transcript);
    console.log("");
    console.log("Done.");
  } catch (e) {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
