import { db, OfflineContact, OfflineInteraction } from './db';

const SYNC_BATCH_SIZE = 10;
const API_BASE_URL = '/api';

export type SyncStats = {
    contactsTotal: number;
    contactsSuccess: number;
    interactionsTotal: number;
    interactionsSuccess: number;
    errors: string[];
};

class SyncService {
    /**
     * Syncs all pending data (contacts first, then interactions)
     */
    async syncPendingData(): Promise<SyncStats> {
        const stats: SyncStats = {
            contactsTotal: 0,
            contactsSuccess: 0,
            interactionsTotal: 0,
            interactionsSuccess: 0,
            errors: [],
        };

        if (!navigator.onLine) {
            stats.errors.push('No internet connection');
            return stats;
        }

        try {
            // Keep track of contacts that failed to sync, to avoid syncing their interactions
            const failedContactIds = new Set<string>();

            // 1. Sync Contacts first (needed for dependency)
            const pendingContacts = await db.contacts
                .where('syncStatus')
                .equals('pending')
                .limit(SYNC_BATCH_SIZE)
                .toArray();

            stats.contactsTotal = pendingContacts.length;

            for (const contact of pendingContacts) {
                try {
                    await this.syncContact(contact);
                    stats.contactsSuccess++;
                } catch (error: any) {
                    failedContactIds.add(contact.id);
                    stats.errors.push(`Failed to sync contact ${contact.phone}: ${error.message}`);
                }
            }

            // 2. Sync Interactions
            const pendingInteractions = await db.interactions
                .where('syncStatus')
                .equals('pending')
                .limit(SYNC_BATCH_SIZE)
                .toArray();

            stats.interactionsTotal = pendingInteractions.length;

            for (const interaction of pendingInteractions) {
                // SKIP interactions if their parent contact failed to sync
                if (failedContactIds.has(interaction.contactId)) {
                    // Optionally log a warning or just skip
                    continue;
                }

                try {
                    await this.syncInteraction(interaction);
                    stats.interactionsSuccess++;
                } catch (error: any) {
                    stats.errors.push(`Failed to sync interaction ${interaction.id}: ${error.message}`);
                }
            }
        } catch (error: any) {
            stats.errors.push(`Sync process failed: ${error.message}`);
        }

        return stats;
    }

    /**
     * Syncs a single contact to the server
     */
    private async syncContact(contact: OfflineContact) {
        const response = await fetch(`${API_BASE_URL}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: contact.id, // Try to suggest ID, but server might ignore/override if upsert matches phone
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            await db.contacts.update(contact.id, {
                syncStatus: 'failed',
                lastError: errorText,
            });
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        const serverContact = responseData.data; // Assuming API returns structure { status, data: { ... } }

        // ID RE-MAPPING: Check if server returned a different ID than what we have locally
        if (serverContact && serverContact.id && serverContact.id !== contact.id) {
            console.log(`ID Mismatch detected: Local ${contact.id} -> Server ${serverContact.id}. Remapping references...`);

            // 1. Update all local interactions to point to the new Server ID
            await db.interactions
                .where('contactId')
                .equals(contact.id)
                .modify({ contactId: serverContact.id });

            // 2. Replace the local contact with the new ID
            // We can't update PK, so we copy, add new, delete old
            const newContact = { ...contact, ...serverContact, id: serverContact.id, syncStatus: 'synced', lastError: undefined };

            await db.transaction('rw', db.contacts, async () => {
                await db.contacts.put(newContact);
                await db.contacts.delete(contact.id);
            });
        } else {
            // IDs match (or server accepted our ID), just mark as synced
            await db.contacts.update(contact.id, {
                syncStatus: 'synced',
                lastError: undefined,
                // Update other fields that might have changed on server (normalization)
                updatedAt: serverContact?.updatedAt || new Date().toISOString()
            });
        }
    }

    /**
     * Syncs a single interaction to the server
     */
    private async syncInteraction(interaction: OfflineInteraction) {
        // Validation: Ensure contact exists locally
        // In a robust system, we might check if the contact is 'synced' locally. 
        // If the server returns 404, we might need to "undelete" or "re-sync" the contact.

        const formData = new FormData();
        formData.append('contact_id', interaction.contactId); // Snake case for form data

        if (interaction.tags) {
            formData.append('tags', JSON.stringify(interaction.tags));
        }

        if (interaction.audioBlob) {
            // Audio blobs from DB are typically simpler; append directly
            formData.append('audio_file', interaction.audioBlob, `offline_${interaction.id}.wav`);
        }

        const response = await fetch(`${API_BASE_URL}/interactions`, {
            method: 'POST',
            body: formData, // Browser sets multipart boundary automatically
        });

        if (!response.ok) {
            const errorText = await response.text();

            // Self-Healing: If contact not found on server, but exists locally, re-queue the contact!
            if (response.status === 404 && errorText.includes("CONTACT_NOT_FOUND")) {
                const parentContact = await db.contacts.get(interaction.contactId);
                if (parentContact) {
                    // Reset parent contact to pending so it syncs next time
                    await db.contacts.update(parentContact.id, { syncStatus: 'pending' });
                    throw new Error(`Parent contact missing on server. Re-queued contact ${parentContact.name} for sync. Please retry sync.`);
                }
            }

            await db.interactions.update(interaction.id, {
                syncStatus: 'failed',
                lastError: errorText,
            });
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        // Mark as Synced locally
        await db.interactions.update(interaction.id, {
            syncStatus: 'synced',
            lastError: undefined,
        });
    }
}

export const syncService = new SyncService();
