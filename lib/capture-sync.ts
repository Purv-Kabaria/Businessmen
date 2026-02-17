import {
    getUnsyncedContacts,
    getPendingAudioTranscriptItems,
    updateContact,
    updateAudioTranscriptItemStatus,
} from "@/modules/capture/db";

const API_BASE = "/api";

export type CaptureSyncContactsResult = {
    enqueued: number;
    error?: string;
};

export type CaptureSyncAudioResult = {
    enqueued: number;
    errors: string[];
};

export async function syncContactsFromQueue(): Promise<CaptureSyncContactsResult> {
    const contacts = await getUnsyncedContacts();
    if (contacts.length === 0) {
        return { enqueued: 0 };
    }

    const payload = contacts.map((c) => ({
        local_id: c.local_id,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        company: c.company ?? null,
        intent_tags: c.intent_tags ?? undefined,
        source_mode: c.source_mode,
        event_id: c.event_id ?? null,
        device_id: c.device_id ?? null,
    }));

    const res = await fetch(`${API_BASE}/sync/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data?.error?.message ?? data?.message ?? res.statusText) as string;
        return { enqueued: 0, error: message };
    }

    const data = await res.json();
    const enqueued = data?.data?.enqueued ?? 0;

    if (enqueued > 0) {
        for (let i = 0; i < Math.min(enqueued, contacts.length); i++) {
            const c = contacts[i];
            await updateContact(c.local_id, { pending_sync: false });
        }
    }

    return { enqueued };
}

export async function syncAudioFromQueue(): Promise<CaptureSyncAudioResult> {
    const items = await getPendingAudioTranscriptItems(50);
    if (items.length === 0) return { enqueued: 0, errors: [] };

    const batchRes = await fetch(`${API_BASE}/sync/audio/enqueue-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            items: items.map((i) => ({
                id: i.id,
                contact_local_id: i.contact_local_id,
                contact_server_id: i.contact_server_id ?? null,
            })),
        }),
    });

    if (!batchRes.ok) {
        const data = await batchRes.json().catch(() => ({}));
        const message = (data?.error?.message ?? data?.message ?? batchRes.statusText) as string;
        return { enqueued: 0, errors: [message] };
    }

    const errors: string[] = [];
    let enqueued = 0;

    for (const item of items) {
        try {
            await updateAudioTranscriptItemStatus(item.id, "processing");

            const formData = new FormData();
            formData.set("id", item.id);
            formData.set("contact_local_id", item.contact_local_id);
            if (item.contact_server_id) formData.set("contact_server_id", item.contact_server_id);
            formData.set("audio", item.audio_blob, `${item.id}.webp`);

            const res = await fetch(`${API_BASE}/sync/audio`, {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const msg = (errData?.error?.message ?? errData?.message ?? res.statusText) as string;
                errors.push(`${item.id}: ${msg}`);
                await updateAudioTranscriptItemStatus(item.id, "pending");
                continue;
            }

            enqueued++;
            const now = Date.now();
            await updateAudioTranscriptItemStatus(item.id, "done", { processed_at: now });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            errors.push(`${item.id}: ${message}`);
            await updateAudioTranscriptItemStatus(item.id, "pending").catch(() => {});
        }
    }

    return { enqueued, errors };
}
