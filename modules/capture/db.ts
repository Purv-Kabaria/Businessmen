const DB_NAME = "finbridge-capture";
const DB_VERSION = 2;
const STORE_DRAFT = "draft";
const STORE_CONTACTS = "contacts";
const DEVICE_ID_KEY = "finbridge-device-id";

export type DraftMode = "stall" | "field";

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
