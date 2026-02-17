import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { getBullMQConnection } from "../lib/queue/connection";
import type { TranscribeJobPayload } from "../lib/queue/transcribe";
import { prisma } from "../lib/prisma";
import s3Client, { getSignedUrl, GetObjectCommand } from "../lib/s3";

const QUEUE_NAME = "transcribe";
const JOB_NAME = "transcribe";
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
const BUCKET_NAME = process.env.MINIO_BUCKET || "interactions-audio";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTranscribeResponse(body: string): { success?: boolean; data?: Record<string, unknown>; error?: string; detail?: string } {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return {
      success: parsed.success as boolean | undefined,
      data: parsed.data as Record<string, unknown> | undefined,
      error: typeof parsed.error === "string" ? parsed.error : undefined,
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
    };
  } catch {
    return {};
  }
}

async function processTranscribe(payload: TranscribeJobPayload): Promise<void> {
  const { interactionId } = payload;

  if (!interactionId || typeof interactionId !== "string" || !UUID_REGEX.test(interactionId.trim())) {
    throw new Error(`Invalid interactionId: ${interactionId}`);
  }

  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    select: {
      id: true,
      audioObjectKeys: true,
      transcript: true,
      contactId: true,
      createdAt: true,
    },
  });

  if (!interaction) {
    throw new Error(`Interaction not found: ${interactionId}`);
  }

  if (interaction.transcript != null && interaction.transcript.trim().length > 0) {
    await markAiJobCompleted(interactionId);
    return;
  }

  const keys = Array.isArray(interaction.audioObjectKeys)
    ? interaction.audioObjectKeys.filter((k): k is string => typeof k === "string" && k.length > 0)
    : [];
  if (keys.length === 0) {
    await markAiJobCompleted(interactionId);
    return;
  }

  const transcriptParts: string[] = [];
  let finalSnapshot: Record<string, unknown> = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    let audioUrl: string;
    try {
      audioUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (s3Err) {
      const msg = s3Err instanceof Error ? s3Err.message : "Failed to get signed URL";
      throw new Error(`S3 signed URL for key ${key}: ${msg}`);
    }

    let response: Response;
    try {
      response = await fetch(`${PYTHON_BACKEND_URL}/api/transcribe-by-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioUrl }),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      throw new Error(`Transcribe request failed: ${msg}`);
    }

    const rawBody = await response.text();
    const result = parseTranscribeResponse(rawBody);
    if (!response.ok || !result.success) {
      const errMsg = result.error || result.detail || (response.status ? `HTTP ${response.status}` : "Transcribe failed");
      throw new Error(errMsg);
    }

    const data = result.data ?? {};
    const text = typeof data.transcript === "string" ? data.transcript : "";
    if (keys.length > 1) {
      transcriptParts.push(`[Audio Part ${i + 1}]\n${text}`);
    } else {
      transcriptParts.push(text);
    }

    if (data.sentiment != null) finalSnapshot.sentiment = data.sentiment;
    if (data.emotions != null) finalSnapshot.emotions = data.emotions;
    if (data.sentimentFlow != null) finalSnapshot.sentimentFlow = data.sentimentFlow;
    if (data.voiceEmotion != null) finalSnapshot.voiceEmotion = data.voiceEmotion;
    if (data.hotspots != null) finalSnapshot.hotspots = data.hotspots;
  }

  const fullTranscript = transcriptParts.join("\n\n");

  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      transcript: fullTranscript,
      structuredSnapshot: finalSnapshot as Parameters<typeof prisma.interaction.update>[0]["data"]["structuredSnapshot"],
    },
  });

  await markAiJobCompleted(interactionId);

  try {
    await fetch(`${PYTHON_BACKEND_URL}/api/simulation/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: interactionId,
        text: fullTranscript,
        metadata: {
          contactId: interaction.contactId,
          date: interaction.createdAt.toISOString(),
          type: "audio",
        },
      }),
    });
  } catch {
    // Embedding is best-effort; do not fail the job
  }
}

async function markAiJobCompleted(interactionId: string): Promise<void> {
  await prisma.aiJob.updateMany({
    where: { interactionId },
    data: { status: "completed" },
  });
}

function run(): void {
  const connection = getBullMQConnection();
  const worker = new Worker<TranscribeJobPayload>(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_NAME) {
        await processTranscribe(job.data);
      }
    },
    {
      connection: connection as ConnectionOptions,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[transcribe] Job ${job.id} completed (interaction ${job.data.interactionId})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[transcribe] Job ${job?.id} failed:`, err?.message);
  });

  const shutdown = async () => {
    console.log("[transcribe] Shutting down...");
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[transcribe] Worker listening on queue "${QUEUE_NAME}"`);
}

run();
