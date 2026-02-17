import { randomUUID } from "node:crypto";
import {
    createErrorResponse,
    createSuccessResponse,
    verifySession,
} from "@/lib/api-utils";
import s3Client, { ensureBucketExists, PutObjectCommand } from "@/lib/s3";
import { addTranscribeJob } from "@/lib/queue/transcribe";
import { prisma } from "@/lib/prisma";

function isPrismaTableMissingError(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
}

export async function POST(req: Request) {
    const session = await verifySession();
    if (!session) {
        return createErrorResponse("UNAUTHORIZED", "You must be logged in to sync audio", 401);
    }

    const formData = await req.formData();
    const id = formData.get("id") as string | null;
    const contact_local_id = formData.get("contact_local_id") as string | null;
    const contact_server_id = (formData.get("contact_server_id") as string) || undefined;
    const audio_file = formData.get("audio") as File | null;

    if (!id || !contact_local_id) {
        return createErrorResponse("VALIDATION_ERROR", "id and contact_local_id are required", 400);
    }

    if (!audio_file || typeof audio_file.arrayBuffer !== "function") {
        return createErrorResponse("VALIDATION_ERROR", "audio file is required", 400);
    }

    const bucket_name = process.env.MINIO_BUCKET || "interactions-audio";
    try {
        await ensureBucketExists(bucket_name);
    } catch (s3Error: unknown) {
        const message = s3Error instanceof Error ? s3Error.message : "Storage unavailable";
        return createErrorResponse(
            "AUDIO_STORAGE_FAILED",
            process.env.NODE_ENV === "development" ? message : "Audio storage failed. Check MinIO.",
            503
        );
    }

    const audio_key = `interactions/${id}-${randomUUID()}.webp`;
    const audio_buffer = Buffer.from(await audio_file.arrayBuffer());

    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucket_name,
                Key: audio_key,
                Body: audio_buffer,
                ContentType: "audio/webp",
            })
        );
    } catch (s3Error: unknown) {
        const message = s3Error instanceof Error ? s3Error.message : "Upload failed";
        return createErrorResponse(
            "AUDIO_STORAGE_FAILED",
            process.env.NODE_ENV === "development" ? message : "Audio upload failed.",
            503
        );
    }

    try {
        let contactId: string | null = null;
        if (contact_server_id) {
            const c = await (prisma as any).contact.findUnique({ where: { id: contact_server_id }, select: { id: true } });
            contactId = c?.id ?? null;
        }
        if (!contactId) {
            const c = await (prisma as any).contact.findUnique({
                where: { offlineLocalId: contact_local_id },
                select: { id: true },
            });
            contactId = c?.id ?? null;
        }
        if (!contactId) {
            return createErrorResponse(
                "CONTACT_NOT_FOUND",
                "Contact not found. Sync contacts first so the contact exists with offlineLocalId.",
                404
            );
        }

        const interaction = await (prisma as any).interaction.create({
            data: {
                contactId,
                audioObjectKeys: [audio_key],
                createdBy: session.id,
            },
        });
        await (prisma as any).aiJob.create({
            data: { interactionId: interaction.id, status: "pending" },
        });

        await addTranscribeJob({ interactionId: interaction.id });

        return createSuccessResponse({ enqueued: 1, interactionId: interaction.id });
    } catch (dbError: unknown) {
        if (isPrismaTableMissingError(dbError)) {
            return createErrorResponse(
                "SCHEMA_MISSING",
                "Database tables are missing. Run: pnpm prisma:migrate (or npx prisma migrate deploy).",
                503
            );
        }
        console.error("[sync/audio] DB error:", dbError);
        return createErrorResponse(
            "DATABASE_ERROR",
            process.env.NODE_ENV === "development" && dbError instanceof Error
                ? dbError.message
                : "Failed to save interaction.",
            500
        );
    }
}
