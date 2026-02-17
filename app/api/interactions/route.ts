import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import s3Client, { ensureBucketExists, PutObjectCommand } from "@/lib/s3";
import {
    handleUnexpectedError,
    createErrorResponse,
    createSuccessResponse,
    verifySession,
} from "@/lib/api-utils";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
    try {
        const session = await verifySession();
        if (!session) {
            return createErrorResponse("UNAUTHORIZED", "You must be logged in to create interactions", 401);
        }

        const formData = await req.formData();
        const contact_id = formData.get("contact_id") as string;
        const audio_file = formData.get("audio_file") as File | null;
        const tags_json = formData.get("tags") as string | null;

        if (!contact_id) {
            return createErrorResponse("MISSING_CONTACT_ID", "Contact ID is required", 400);
        }

        // 1. Validate contact exists
        const contact = await prisma.contact.findUnique({
            where: { id: contact_id },
        });

        if (!contact) {
            return createErrorResponse("CONTACT_NOT_FOUND", "The specified contact does not exist", 404);
        }

        const interaction_id = randomUUID();
        let audio_object_key: string | null = null;

        if (audio_file && typeof audio_file.arrayBuffer === "function") {
            try {
                const bucket_name = process.env.MINIO_BUCKET || "interactions-audio";
                await ensureBucketExists(bucket_name);
                audio_object_key = `interactions/${interaction_id}.webm`;
                const audio_buffer = Buffer.from(await audio_file.arrayBuffer());
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: bucket_name,
                        Key: audio_object_key,
                        Body: audio_buffer,
                        ContentType: audio_file.type || "audio/webm",
                    })
                );
            } catch (s3Error: unknown) {
                const message = s3Error instanceof Error ? s3Error.message : "Storage unavailable";
                return createErrorResponse(
                    "AUDIO_STORAGE_FAILED",
                    process.env.NODE_ENV === "development" ? message : "Audio storage failed. Check MinIO is running.",
                    503,
                    process.env.NODE_ENV === "development" && s3Error instanceof Error ? { details: s3Error.message } : undefined
                );
            }
        }

        let tags: unknown = null;
        if (tags_json) {
            try {
                tags = JSON.parse(tags_json);
            } catch {
                tags = null;
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // @ts-ignore: Prisma client needs regeneration to include Interaction model
            const interaction = await tx.interaction.create({
                data: {
                    id: interaction_id,
                    contactId: contact_id,
                    audioObjectKey: audio_object_key,
                    tags: (tags ?? undefined) as Prisma.InputJsonValue | undefined,
                    createdBy: session.id,
                },
            });

            // @ts-ignore: Prisma client needs regeneration to include AiJob model
            const ai_job = await tx.aiJob.create({
                data: {
                    interactionId: interaction.id,
                    status: "pending",
                },
            });

            return { interaction, ai_job };
        });

        return createSuccessResponse({
            interaction_id: result.interaction.id,
            ai_job_id: result.ai_job.id,
            status: "Interaction created and AI job scheduled",
        });
    } catch (error) {
        return handleUnexpectedError(error, "CREATE_INTERACTION");
    }
}
