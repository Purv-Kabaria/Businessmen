import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { getBullMQConnection } from "../lib/queue/connection";
import type { ContactSyncJobPayload } from "../lib/queue/contacts-sync";
import { prisma } from "../lib/prisma";

const QUEUE_NAME = "contacts-sync";
const JOB_NAME_UPSERT = "upsert";

async function processUpsert(payload: ContactSyncJobPayload) {
  const { local_id, name, phone, email, company, intent_tags, source_mode, event_id, device_id } =
    payload;
  await prisma.contact.upsert({
    where: { phone },
    update: {
      name: name ?? undefined,
      email: email ?? undefined,
      company: company ?? undefined,
      intentTags: intent_tags ?? undefined,
      sourceMode: source_mode,
      eventId: event_id ?? undefined,
      deviceId: device_id ?? undefined,
      offlineLocalId: local_id,
      pendingSync: false,
    },
    create: {
      name: name ?? "Unknown",
      phone,
      email: email ?? null,
      company: company ?? null,
      intentTags: intent_tags ?? undefined,
      sourceMode: source_mode,
      eventId: event_id ?? null,
      deviceId: device_id ?? null,
      offlineLocalId: local_id,
      pendingSync: false,
    },
  });
}

function run() {
  const connection = getBullMQConnection();
  const worker = new Worker<ContactSyncJobPayload>(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_NAME_UPSERT) {
        await processUpsert(job.data);
      }
    },
    { connection: connection as ConnectionOptions, concurrency: 5 }
  );

  worker.on("completed", (job) => {
    console.log(`[contacts-sync] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[contacts-sync] Job ${job?.id} failed:`, err?.message);
  });

  const shutdown = async () => {
    console.log("[contacts-sync] Shutting down...");
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[contacts-sync] Worker listening on queue "${QUEUE_NAME}"`);
}

run();
