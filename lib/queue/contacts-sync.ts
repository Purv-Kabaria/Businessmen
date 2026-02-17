import { Queue } from "bullmq";
import { getBullMQConnection } from "./connection";

const QUEUE_NAME = "contacts-sync";
const JOB_NAME_UPSERT = "upsert";

export type ContactSyncJobPayload = {
  local_id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  intent_tags?: unknown;
  source_mode: string;
  event_id?: string | null;
  device_id?: string | null;
};

let contactsSyncQueue: Queue<ContactSyncJobPayload> | null = null;

function getQueue(): Queue<ContactSyncJobPayload> {
  if (!contactsSyncQueue) {
    contactsSyncQueue = new Queue<ContactSyncJobPayload>(QUEUE_NAME, {
      connection: getBullMQConnection() as never,
    }) as Queue<ContactSyncJobPayload>;
  }
  return contactsSyncQueue;
}

export function getContactsSyncQueue(): Queue<ContactSyncJobPayload> {
  return getQueue();
}

export async function addContactUpsertJob(
  payload: ContactSyncJobPayload
): Promise<{ id: string }> {
  try {
    const job = await getQueue().add(JOB_NAME_UPSERT, payload);
    return { id: job.id ?? "" };
  } catch (err) {
    console.error("[contacts-sync queue] Enqueue failed:", err instanceof Error ? err.message : err);
    return { id: "" };
  }
}
