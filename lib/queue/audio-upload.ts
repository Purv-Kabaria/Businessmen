import { Queue } from "bullmq";
import { getBullMQConnection } from "./connection";

const QUEUE_NAME = "audio-upload";
const JOB_NAME = "upload";

export type AudioUploadJobPayload = {
  id: string;
  contact_local_id: string;
  contact_server_id?: string | null;
  created_by: string;
};

let audioUploadQueue: Queue<AudioUploadJobPayload> | null = null;

function getQueue(): Queue<AudioUploadJobPayload> {
  if (!audioUploadQueue) {
    audioUploadQueue = new Queue<AudioUploadJobPayload>(QUEUE_NAME, {
      connection: getBullMQConnection() as never,
    }) as Queue<AudioUploadJobPayload>;
  }
  return audioUploadQueue;
}

export function getAudioUploadQueue(): Queue<AudioUploadJobPayload> {
  return getQueue();
}

export async function addAudioUploadJob(
  payload: AudioUploadJobPayload
): Promise<{ id: string }> {
  const job = await getQueue().add(JOB_NAME, payload);
  return { id: job.id ?? "" };
}

export async function addAudioUploadJobs(
  payloads: AudioUploadJobPayload[]
): Promise<{ enqueued: number }> {
  if (payloads.length === 0) return { enqueued: 0 };
  const queue = getQueue();
  const jobs = payloads.map((p) => ({ name: JOB_NAME, data: p }));
  await queue.addBulk(jobs);
  return { enqueued: payloads.length };
}
