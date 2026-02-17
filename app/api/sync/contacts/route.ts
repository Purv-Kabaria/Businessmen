import {
    createErrorResponse,
    createSuccessResponse,
    verifySession,
} from "@/lib/api-utils";
import { addContactUpsertJob, type ContactSyncJobPayload } from "@/lib/queue/contacts-sync";
import { addTranscribeJob } from "@/lib/queue/transcribe";
import { prisma } from "@/lib/prisma";

type PrismaWithContactAndInteraction = typeof prisma & {
    contact: {
        upsert: (args: {
            where: { phone: string };
            update: Record<string, unknown>;
            create: Record<string, unknown>;
        }) => Promise<unknown>;
    };
    interaction: {
        findMany: (args: {
            where: { audioObjectKeys: { isEmpty: false }; OR: Array<{ transcript: null } | { transcript: "" }> };
            select: { id: true };
            take: number;
        }) => Promise<{ id: string }[]>;
    };
};

const contactPayloadSchema = {
    local_id: (v: unknown) => typeof v === "string",
    name: (v: unknown) => typeof v === "string",
    phone: (v: unknown) => typeof v === "string" && (v as string).length >= 10,
    email: (v: unknown) => v === null || v === undefined || typeof v === "string",
    company: (v: unknown) => v === null || v === undefined || typeof v === "string",
    intent_tags: () => true,
    source_mode: (v: unknown) => typeof v === "string",
    event_id: (v: unknown) => v === null || v === undefined || typeof v === "string",
    device_id: (v: unknown) => v === null || v === undefined || typeof v === "string",
};

function parseContact(raw: Record<string, unknown>): ContactSyncJobPayload | null {
    if (
        !contactPayloadSchema.local_id(raw.local_id) ||
        !contactPayloadSchema.name(raw.name) ||
        !contactPayloadSchema.phone(raw.phone)
    )
        return null;
    return {
        local_id: raw.local_id as string,
        name: raw.name as string,
        phone: raw.phone as string,
        email: (raw.email as string | null) ?? null,
        company: (raw.company as string | null) ?? null,
        intent_tags: raw.intent_tags,
        source_mode: (raw.source_mode as string) || "manual",
        event_id: (raw.event_id as string | null) ?? null,
        device_id: (raw.device_id as string | null) ?? null,
    };
}

function isPrismaTableMissingError(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
}

export async function POST(req: Request) {
    const session = await verifySession();
    if (!session) {
        return createErrorResponse("UNAUTHORIZED", "You must be logged in to sync contacts", 401);
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return createErrorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    const arr = Array.isArray(body) ? body : [body];
    const payloads: ContactSyncJobPayload[] = [];
    for (const item of arr) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
            const payload = parseContact(item as Record<string, unknown>);
            if (payload) payloads.push(payload);
        }
    }

    let upserted = 0;
    try {
        for (const p of payloads) {
            await (prisma as PrismaWithContactAndInteraction).contact.upsert({
                where: { phone: p.phone },
                update: {
                    name: p.name ?? undefined,
                    email: p.email ?? undefined,
                    company: p.company ?? undefined,
                    intentTags: p.intent_tags ?? undefined,
                    sourceMode: p.source_mode,
                    eventId: p.event_id ?? undefined,
                    deviceId: p.device_id ?? undefined,
                    offlineLocalId: p.local_id,
                    pendingSync: false,
                },
                create: {
                    name: p.name ?? "Unknown",
                    phone: p.phone,
                    email: p.email ?? null,
                    company: p.company ?? null,
                    intentTags: p.intent_tags ?? undefined,
                    sourceMode: p.source_mode,
                    eventId: p.event_id ?? null,
                    deviceId: p.device_id ?? null,
                    offlineLocalId: p.local_id,
                    pendingSync: false,
                },
            });
            upserted++;
        }
        for (const p of payloads.slice(0, upserted)) {
            await addContactUpsertJob(p);
        }

        const client = prisma as PrismaWithContactAndInteraction;
        const needTranscript = await client.interaction.findMany({
            where: {
                audioObjectKeys: { isEmpty: false },
                OR: [{ transcript: null }, { transcript: "" }],
            },
            select: { id: true },
            take: 100,
        });
        for (const row of needTranscript) {
            await addTranscribeJob({ interactionId: row.id });
        }

        return createSuccessResponse({
            enqueued: upserted,
            transcribeEnqueued: needTranscript.length,
        });
    } catch (dbError: unknown) {
        if (isPrismaTableMissingError(dbError)) {
            return createErrorResponse(
                "SCHEMA_MISSING",
                "Database tables are missing. Run: pnpm prisma:migrate (or npx prisma migrate deploy).",
                503
            );
        }
        console.error("[sync/contacts] DB error:", dbError);
        return createErrorResponse(
            "DATABASE_ERROR",
            process.env.NODE_ENV === "development" && dbError instanceof Error
                ? (dbError as Error).message
                : "Failed to sync contacts.",
            500
        );
    }
}
