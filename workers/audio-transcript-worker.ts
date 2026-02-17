import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { getBullMQConnection } from "../lib/queue/connection";
import type { AudioTranscriptJobPayload } from "../lib/queue/audio-transcript";
import { prisma } from "../lib/prisma";

const QUEUE_NAME = "audio-transcript";
const JOB_NAME_UPLOAD = "upload";

async function processUpload(payload: AudioTranscriptJobPayload) {
  const { contact_local_id, contact_server_id, audio_key, created_by } = payload;
  let contactId: string;
  if (contact_server_id) {
    const contact = await prisma.contact.findUnique({ where: { id: contact_server_id }, select: { id: true } });
    if (!contact) throw new Error(`Contact not found: ${contact_server_id}`);
    contactId = contact.id;
  } else {
    const contact = await prisma.contact.findFirst({ where: { offlineLocalId: contact_local_id }, select: { id: true } });
    if (!contact) throw new Error(`Contact not found by offline_local_id: ${contact_local_id}`);
    contactId = contact.id;
  }

  // Idempotency: if an interaction already exists for this contact with this audio key, skip create
  const existing = await prisma.interaction.findFirst({
    where: { contactId, audioObjectKeys: { has: audio_key } },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  const interaction = await prisma.interaction.create({
    data: {
      contactId,
      audioObjectKeys: [audio_key],
      createdBy: created_by,
    },
  });

  await prisma.aiJob.create({
    data: { interactionId: interaction.id, status: "pending" },
  });
}

function run() {
  const connection = getBullMQConnection();
  const worker = new Worker<AudioTranscriptJobPayload>(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_NAME_UPLOAD) {
        await processUpload(job.data);
      }
    },
    { connection: connection as ConnectionOptions, concurrency: 3 }
  );

  worker.on("completed", (job) => {
    console.log(`[audio-transcript] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[audio-transcript] Job ${job?.id} failed:`, err?.message);
  });

  const shutdown = async () => {
    console.log("[audio-transcript] Shutting down...");
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[audio-transcript] Worker listening on queue "${QUEUE_NAME}"`);
}

run();
