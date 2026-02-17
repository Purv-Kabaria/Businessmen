import { Queue } from "bullmq";
import { getBullMQConnection } from "./connection";

const QUEUE_NAME = "audio-transcript";

export type AudioTranscriptJobPayload = {
  id: string;
  contact_local_id: string;
  contact_server_id?: string | null;
  audio_key: string;
  created_by: string;
};

let audioTranscriptQueue: Queue<AudioTranscriptJobPayload> | null = null;

function getQueue(): Queue<AudioTranscriptJobPayload> {
  if (!audioTranscriptQueue) {
    audioTranscriptQueue = new Queue<AudioTranscriptJobPayload>(QUEUE_NAME, {
      connection: getBullMQConnection(),
    });
  }
  return audioTranscriptQueue;
}

export function getAudioTranscriptQueue(): Queue<AudioTranscriptJobPayload> {
  return getQueue();
}

export async function addAudioTranscriptJob(
  payload: AudioTranscriptJobPayload
): Promise<{ id: string }> {
  const job = await getQueue().add("upload", payload);
  return { id: job.id ?? "" };
}
