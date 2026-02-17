import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { getBullMQConnection } from "../lib/queue/connection";
import type { AudioTranscriptJobPayload } from "../lib/queue/audio-transcript";
import { prisma } from "../lib/prisma";

const QUEUE_NAME = "audio-transcript";
const JOB_NAME_UPLOAD = "upload";

async function processUpload(payload: AudioTranscriptJobPayload) {
  const { contact_local_id, contact_server_id, audio_key, created_by } = payload;
  const db = prisma as unknown as {
    contact: { findUnique: (args: { where: { id?: string; offlineLocalId?: string } }) => Promise<{ id: string } | null> };
    interaction: { create: (args: { data: { contactId: string; audioObjectKey: string; createdBy: string } }) => Promise<{ id: string }> };
    aiJob: { create: (args: { data: { interactionId: string; status: string } }) => Promise<unknown> };
  };
  let contactId: string;
  if (contact_server_id) {
    const contact = await db.contact.findUnique({ where: { id: contact_server_id } });
    if (!contact) throw new Error(`Contact not found: ${contact_server_id}`);
    contactId = contact.id;
  } else {
    const contact = await db.contact.findUnique({ where: { offlineLocalId: contact_local_id } });
    if (!contact) throw new Error(`Contact not found by offline_local_id: ${contact_local_id}`);
    contactId = contact.id;
  }

  const interaction = await db.interaction.create({
    data: { contactId, audioObjectKey: audio_key, createdBy: created_by },
  });

  await db.aiJob.create({
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
