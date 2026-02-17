import Dexie, { Table } from 'dexie';

// --- Types ---

export interface OfflineContact {
    id: string; // UUID
    name: string;
    email?: string;
    phone: string;
    currentStage: string;
    createdAt: string; // ISO string for easier storage
    updatedAt: string;
    syncStatus: 'pending' | 'synced' | 'failed';
    lastError?: string;
}

export interface OfflineInteraction {
    id: string; // UUID
    contactId: string;
    audioBlob?: Blob; // Stored locally
    transcript?: string;
    tags?: Record<string, any>;
    createdAt: string;
    createdBy: string; // RM ID
    syncStatus: 'pending' | 'synced' | 'failed';
    lastError?: string;
}

// --- Database Definition ---

export class FinBridgeDB extends Dexie {
    contacts!: Table<OfflineContact>;
    interactions!: Table<OfflineInteraction>;

    constructor() {
        super('FinBridgeDB');

        // Define tables and indexes
        // 'id' is the primary key
        // 'syncStatus' is indexed for quick filtering of pending items
        // 'phone' is indexed for quick lookup
        this.version(2).stores({
            contacts: 'id, phone, name, syncStatus, updatedAt',
            interactions: 'id, contactId, syncStatus, createdAt'
        });
    }
}

export const db = new FinBridgeDB();
