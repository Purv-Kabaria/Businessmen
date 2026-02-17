import {
    createErrorResponse,
    createSuccessResponse,
    verifySession,
} from "@/lib/api-utils";
import { addAudioUploadJobs } from "@/lib/queue/audio-upload";

const itemSchema = {
    id: (v: unknown) => typeof v === "string",
    contact_local_id: (v: unknown) => typeof v === "string",
    contact_server_id: (v: unknown) =>
        v === null || v === undefined || typeof v === "string",
};

function parseItem(raw: Record<string, unknown>): { id: string; contact_local_id: string; contact_server_id?: string | null } | null {
    if (
        !itemSchema.id(raw.id) ||
        !itemSchema.contact_local_id(raw.contact_local_id)
    )
        return null;
    return {
        id: raw.id as string,
        contact_local_id: raw.contact_local_id as string,
        contact_server_id: (raw.contact_server_id as string | null) ?? null,
    };
}

export async function POST(req: Request) {
    const session = await verifySession();
    if (!session) {
        return createErrorResponse("UNAUTHORIZED", "You must be logged in to sync audio", 401);
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return createErrorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    const raw = body as Record<string, unknown>;
    const arr = Array.isArray(raw?.items) ? raw.items : [];
    const payloads: Array<{ id: string; contact_local_id: string; contact_server_id?: string | null; created_by: string }> = [];
    for (const item of arr) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
            const parsed = parseItem(item as Record<string, unknown>);
            if (parsed) {
                payloads.push({
                    ...parsed,
                    created_by: session.id,
                });
            }
        }
    }

    const { enqueued } = await addAudioUploadJobs(payloads);
    return createSuccessResponse({ enqueued });
}
