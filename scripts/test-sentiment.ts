/**
 * Test sentiment analysis (ONNX) via the analyze microservice.
 * Usage: pnpm exec tsx scripts/test-sentiment.ts [path/to/transcript.txt]
 * If no file: uses sample text. You can also pipe: cat transcript.txt | pnpm exec tsx scripts/test-sentiment.ts -
 *
 * Requires: Analyze service (main_analyze.py) on ANALYZE_SERVICE_URL (default http://localhost:8000)
 */

import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";

const ANALYZE_SERVICE_URL = process.env.ANALYZE_SERVICE_URL || "http://localhost:8000";
const sampleText =
  "I'm really excited about this product. The team did an amazing job. However, the last update was frustrating and caused some issues for our clients.";

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
  // Check for a transcript file next to voice.webm (e.g. from a previous test)
  const transcriptPath = join(process.cwd(), "public", "transcript.txt");
  if (existsSync(transcriptPath)) return readFileSync(transcriptPath, "utf-8").trim();
  return sampleText;
}

async function main() {
  const transcript = await getTranscript();
  console.log("Sentiment test");
  console.log("  Service:", ANALYZE_SERVICE_URL);
  console.log("  Input length:", transcript.length, "chars");
  console.log("");

  const res = await fetch(`${ANALYZE_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error:", res.status, json?.detail || json?.error || res.statusText);
    process.exit(1);
  }

  if (json.error) {
    console.error("Analyze error:", json.error);
    process.exit(1);
  }

  console.log("--- Sentiments (per segment) ---");
  const sentiments = json.sentiments;
  if (Array.isArray(sentiments) && sentiments.length > 0) {
    sentiments.forEach((s: Record<string, unknown>, i: number) => {
      console.log(`  [${i + 1}]`, JSON.stringify(s));
    });
  } else {
    console.log("  (none)");
  }
  console.log("");
  if (json.summary) {
    console.log("--- Summary (from analyze) ---");
    console.log(JSON.stringify(json.summary, null, 2));
  }
}

main();
