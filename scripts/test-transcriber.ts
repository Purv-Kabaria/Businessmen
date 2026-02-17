/**
 * Test the transcriber (Whisper) with a local WebM audio file.
 * Usage: pnpm exec tsx scripts/test-transcriber.ts [path/to/audio.webm]
 * Default: public/voice.webm. Only .webm files are accepted.
 *
 * Requires: Python backend (main.py) on PYTHON_BACKEND_URL (default http://localhost:8000)
 */

import { createReadStream, existsSync } from "fs";
import { join } from "path";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
const WEBM_EXT = ".webm";
const defaultAudioPath = join(process.cwd(), "public", "voice.webm");
const audioPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : defaultAudioPath;

function ensureWebm(path: string): void {
  if (!path.toLowerCase().endsWith(WEBM_EXT)) {
    console.error("Audio tests run on WebM only. File must have a .webm extension:", path);
    process.exit(1);
  }
}

async function main() {
  if (!existsSync(audioPath)) {
    console.error("Audio file not found:", audioPath);
    console.error("Usage: pnpm exec tsx scripts/test-transcriber.ts [path/to/audio.webm]");
    process.exit(1);
  }
  ensureWebm(audioPath);

  const filename = audioPath.split(/[/\\]/).pop() || "voice.webm";
  console.log("Transcriber test (WebM)");
  console.log("  Backend:", PYTHON_BACKEND_URL);
  console.log("  Audio:  ", audioPath);
  console.log("");

  const buf = await readFile(audioPath);
  const form = new FormData();
  form.set("audio", new Blob([new Uint8Array(buf)], { type: "audio/webm" }), filename);

  const res = await fetch(`${PYTHON_BACKEND_URL}/api/transcribe`, {
    method: "POST",
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error:", res.status, json?.detail || json?.error || res.statusText);
    process.exit(1);
  }

  if (!json.success) {
    console.error("Transcription failed:", json.error || "Unknown error");
    process.exit(1);
  }

  const data = json.data || {};
  console.log("--- Transcript ---");
  console.log(data.transcript || "(empty)");
  console.log("");
  if (data.sentiment) {
    console.log("--- Sentiment (from transcriber) ---");
    console.log(JSON.stringify(data.sentiment, null, 2));
  }
  if (data.voiceEmotion) {
    console.log("--- Voice emotion ---");
    console.log(JSON.stringify(data.voiceEmotion, null, 2));
  }
  if (json.meta) {
    console.log("--- Meta ---");
    console.log(JSON.stringify(json.meta, null, 2));
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

main();
