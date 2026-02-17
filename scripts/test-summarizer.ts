/**
 * Test the summarizer (Ollama/Gemma) via the main Python backend.
 * Usage: pnpm exec tsx scripts/test-summarizer.ts [path/to/transcript.txt]
 * If no file: uses sample text. Pipe: cat transcript.txt | pnpm exec tsx scripts/test-summarizer.ts -
 *
 * Requires: Python backend (main.py) on PYTHON_BACKEND_URL (default http://localhost:8000)
 */

import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
const sampleText = `Meeting notes: We discussed the Q3 roadmap. Engineering will ship the new API by Friday. 
Sales reported strong interest in the enterprise tier. Support asked for more documentation. 
Next steps: schedule follow-up with legal for the contract template.`;

async function getTranscript(): Promise<string> {
  const arg = process.argv[2];
  if (arg === "-") {
    const rl = createInterface({ input: process.stdin });
    const lines: string[] = [];
    for await (const line of rl) lines.push(line);
    return lines.join("\n").trim() || sampleText;
  }
  if (arg) {
    const path = join(process.cwd(), arg);
    if (existsSync(path)) return readFileSync(path, "utf-8").trim();
  }
  const transcriptPath = join(process.cwd(), "public", "transcript.txt");
  if (existsSync(transcriptPath)) return readFileSync(transcriptPath, "utf-8").trim();
  return sampleText;
}

async function main() {
  const text = await getTranscript();
  console.log("Summarizer test");
  console.log("  Backend:", PYTHON_BACKEND_URL);
  console.log("  Input length:", text.length, "chars");
  console.log("");

  const res = await fetch(`${PYTHON_BACKEND_URL}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, model: "gemma3:4b" }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error:", res.status, json?.detail || json?.error || res.statusText);
    process.exit(1);
  }

  if (!json.success) {
    console.error("Summarize failed:", json.error || "Unknown error");
    process.exit(1);
  }

  console.log("--- Summary ---");
  console.log(json.summary || "(empty)");
  console.log("");
  if (json.meta) {
    console.log("--- Meta ---");
    console.log(JSON.stringify(json.meta, null, 2));
  }
}

main();
