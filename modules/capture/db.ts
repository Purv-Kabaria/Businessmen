const DB_NAME = "finbridge-capture";
const DB_VERSION = 3;
const STORE_DRAFT = "draft";
const STORE_CONTACTS = "contacts";
const STORE_AUDIO_TRANSCRIPT_QUEUE = "audio_transcript_queue";
const DEVICE_ID_KEY = "finbridge-device-id";

export type DraftMode = "stall" | "field";

export type AudioTranscriptQueueItemStatus = "pending" | "processing" | "done" | "failed";

const STALE_PROCESSING_MS = 5 * 60 * 1000;

export type AudioTranscriptQueueItem = {
  id: string;
  audio_blob: Blob;
  contact_local_id: string;
  source_mode: DraftMode;
  status: AudioTranscriptQueueItemStatus;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  processed_at: number | null;
  contact_server_id?: string | null;
  status_updated_at?: number;
};

export type DraftData = {
  mode: DraftMode;
  name?: string;
  phone?: string;
  email?: string;
  intent_tags?: string[];
  updated_at: number;
};

export type ContactRecord = {
  local_id: string;
  server_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  intent_tags: string[];
  source_mode: DraftMode;
  version: number;
  pending_sync: boolean;
  device_id: string;
  updated_at: number;
  event_id: string | null;
  audio_local_id?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT, { keyPath: "mode" });
      }
      if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
        db.createObjectStore(STORE_CONTACTS, { keyPath: "local_id" });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO_TRANSCRIPT_QUEUE)) {
        db.createObjectStore(STORE_AUDIO_TRANSCRIPT_QUEUE, { keyPath: "id" });
      }
    };
  });
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function addContact(contact: ContactRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONTACTS, "readwrite");
    const store = tx.objectStore(STORE_CONTACTS);
    const req = store.add(contact);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}

export async function getAllContacts(): Promise<ContactRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONTACTS, "readonly");
    const store = tx.objectStore(STORE_CONTACTS);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as ContactRecord[]) ?? []);
    };
  });
}

export type UpdateContactPatch = Partial<Omit<ContactRecord, "local_id">>;

export async function updateContact(local_id: string, patch: UpdateContactPatch): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONTACTS, "readwrite");
    const store = tx.objectStore(STORE_CONTACTS);
    const getReq = store.get(local_id);
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
    getReq.onsuccess = () => {
      const existing = getReq.result as ContactRecord | undefined;
      if (!existing) {
        db.close();
        reject(new Error(`Contact not found: ${local_id}`));
        return;
      }
      const updated: ContactRecord = {
        ...existing,
        ...patch,
        local_id: existing.local_id,
        updated_at: Date.now(),
      };
      const putReq = store.put(updated);
      putReq.onerror = () => {
        db.close();
        reject(putReq.error);
      };
      putReq.onsuccess = () => {
        db.close();
        resolve();
      };
    };
  });
}

export async function getUnsyncedContacts(): Promise<ContactRecord[]> {
  const all = await getAllContacts();
  const unsynced = all.filter((c) => c.pending_sync);
  return unsynced.sort((a, b) => a.updated_at - b.updated_at);
}

export type EnqueueAudioTranscriptItemInput = {
  audio_blob: Blob;
  contact_local_id: string;
  source_mode: DraftMode;
};

export async function enqueueAudioTranscriptItem(
  item: EnqueueAudioTranscriptItemInput
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const record: AudioTranscriptQueueItem = {
    id,
    audio_blob: item.audio_blob,
    contact_local_id: item.contact_local_id,
    source_mode: item.source_mode,
    status: "pending",
    retry_count: 0,
    last_error: null,
    created_at: now,
    processed_at: null,
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO_TRANSCRIPT_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_AUDIO_TRANSCRIPT_QUEUE);
    const req = store.add(record);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve(id);
    };
  });
}

async function getAllAudioTranscriptItems(): Promise<AudioTranscriptQueueItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO_TRANSCRIPT_QUEUE, "readonly");
    const store = tx.objectStore(STORE_AUDIO_TRANSCRIPT_QUEUE);
    const req = store.getAll();
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve((req.result as AudioTranscriptQueueItem[]) ?? []);
    };
  });
}

async function resetStaleProcessingItems(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO_TRANSCRIPT_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_AUDIO_TRANSCRIPT_QUEUE);
    const getReq = store.getAll();
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
    getReq.onsuccess = () => {
      const all = (getReq.result as AudioTranscriptQueueItem[]) ?? [];
      const now = Date.now();
      const stale = all.filter(
        (item) =>
          item.status === "processing" &&
          (item.status_updated_at ?? item.created_at) < now - STALE_PROCESSING_MS
      );
      if (stale.length === 0) {
        db.close();
        resolve();
        return;
      }
      let done = 0;
      for (const item of stale) {
        const updated: AudioTranscriptQueueItem = {
          ...item,
          status: "pending",
          status_updated_at: now,
        };
        const putReq = store.put(updated);
        putReq.onerror = () => {
          db.close();
          reject(putReq.error);
        };
        putReq.onsuccess = () => {
          done++;
          if (done === stale.length) {
            db.close();
            resolve();
          }
        };
      }
    };
  });
}

export async function getPendingAudioTranscriptItems(
  limit: number
): Promise<AudioTranscriptQueueItem[]> {
  await resetStaleProcessingItems();
  const all = await getAllAudioTranscriptItems();
  const pending = all.filter((item) => item.status === "pending");
  const sorted = pending.sort((a, b) => a.created_at - b.created_at);
  return sorted.slice(0, limit);
}

export type UpdateAudioTranscriptItemStatusOptions = {
  last_error?: string | null;
  processed_at?: number | null;
};

export async function updateAudioTranscriptItemStatus(
  id: string,
  status: AudioTranscriptQueueItemStatus,
  options?: UpdateAudioTranscriptItemStatusOptions
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO_TRANSCRIPT_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_AUDIO_TRANSCRIPT_QUEUE);
    const getReq = store.get(id);
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
    getReq.onsuccess = () => {
      const existing = getReq.result as AudioTranscriptQueueItem | undefined;
      if (!existing) {
        db.close();
        reject(new Error(`Audio transcript queue item not found: ${id}`));
        return;
      }
      const now = Date.now();
      const updated: AudioTranscriptQueueItem = {
        ...existing,
        status,
        status_updated_at: now,
        ...(options?.last_error !== undefined && { last_error: options.last_error }),
        ...(options?.processed_at !== undefined && { processed_at: options.processed_at }),
      };
      const putReq = store.put(updated);
      putReq.onerror = () => {
        db.close();
        reject(putReq.error);
      };
      putReq.onsuccess = () => {
        db.close();
        resolve();
      };
    };
  });
}

export async function setContactServerId(
  id: string,
  server_id: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO_TRANSCRIPT_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_AUDIO_TRANSCRIPT_QUEUE);
    const getReq = store.get(id);
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
    getReq.onsuccess = () => {
      const existing = getReq.result as AudioTranscriptQueueItem | undefined;
      if (!existing) {
        db.close();
        reject(new Error(`Audio transcript queue item not found: ${id}`));
        return;
      }
      const updated: AudioTranscriptQueueItem = {
        ...existing,
        contact_server_id: server_id,
      };
      const putReq = store.put(updated);
      putReq.onerror = () => {
        db.close();
        reject(putReq.error);
      };
      putReq.onsuccess = () => {
        db.close();
        resolve();
      };
    };
  });
}

export async function getDraft(mode: DraftMode): Promise<DraftData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, "readonly");
    const store = tx.objectStore(STORE_DRAFT);
    const req = store.get(mode);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db.close();
      const draft = req.result as DraftData | undefined;
      resolve(draft ?? null);
    };
  });
}

export async function setDraft(data: DraftData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, "readwrite");
    const store = tx.objectStore(STORE_DRAFT);
    const payload = { ...data, updated_at: Date.now() };
    const req = store.put(payload);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}

export async function clearDraft(mode: DraftMode): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, "readwrite");
    const store = tx.objectStore(STORE_DRAFT);
    const req = store.delete(mode);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}
