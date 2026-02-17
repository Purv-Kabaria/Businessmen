import { Queue } from "bullmq";
import { getBullMQConnection } from "./connection";

const QUEUE_NAME = "transcribe";

export type TranscribeJobPayload = {
  interactionId: string;
};

let transcribeQueue: Queue<TranscribeJobPayload> | null = null;

function getQueue(): Queue<TranscribeJobPayload> {
  if (!transcribeQueue) {
    transcribeQueue = new Queue<TranscribeJobPayload>(QUEUE_NAME, {
      connection: getBullMQConnection() as never,
    }) as Queue<TranscribeJobPayload>;
  }
  return transcribeQueue;
}

export function getTranscribeQueue(): Queue<TranscribeJobPayload> {
  return getQueue();
}

export async function addTranscribeJob(payload: TranscribeJobPayload): Promise<{ id: string }> {
  try {
    const job = await getQueue().add("transcribe", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
    });
    return { id: job.id ?? "" };
  } catch (err) {
    console.error("[transcribe queue] Enqueue failed:", err instanceof Error ? err.message : err);
    return { id: "" };
  }
}
