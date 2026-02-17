import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import s3Client, { ensureBucketExists, PutObjectCommand } from "@/lib/s3";
import { addTranscribeJob } from "@/lib/queue/transcribe";
import {
    handleUnexpectedError,
    createErrorResponse,
    createSuccessResponse,
    verifySession,
} from "@/lib/api-utils";
import { normalizePhone } from "@/modules/capture/utils";
import { randomUUID } from "node:crypto";

type ContactDelegate = {
    findUnique: (args: { where: { id: string } | { phone: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
};
type InteractionDelegate = {
    findFirst: (args: { where: { contactId: string }; orderBy: { createdAt: "desc" } }) => Promise<{ id: string; audioObjectKeys: string[] } | null>;
    update: (args: { where: { id: string }; data: { audioObjectKeys: string[] } }) => Promise<{ id: string; audioObjectKeys: string[] }>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; audioObjectKeys: string[] }>;
};
type AiJobDelegate = {
    create: (args: { data: { interactionId: string; status: string } }) => Promise<{ id: string }>;
};
type PrismaWithModels = typeof prisma & { contact: ContactDelegate; interaction: InteractionDelegate; aiJob: AiJobDelegate };

export async function POST(req: Request) {
    try {
        const session = await verifySession();
        if (!session) {
            return createErrorResponse("UNAUTHORIZED", "You must be logged in to create interactions", 401);
        }

        const formData = await req.formData();
        const contact_id_from_body = (formData.get("contact_id") as string) || undefined;
        const phone = (formData.get("phone") as string) || undefined;
        const contact_name = (formData.get("contact_name") as string) || undefined;
        const contact_email = (formData.get("contact_email") as string) || undefined;
        const audio_file = formData.get("audio_file") as File | null;
        const tags_json = formData.get("tags") as string | null;

        let contact_id: string;

        const client = prisma as PrismaWithModels;
        if (contact_id_from_body) {
            const existing = await client.contact.findUnique({
                where: { id: contact_id_from_body },
            });
            if (!existing) {
                return createErrorResponse("CONTACT_NOT_FOUND", "The specified contact does not exist", 404);
            }
            contact_id = existing.id;
        } else if (phone) {
            const normalizedPhone = normalizePhone(phone);
            const existingByPhone = await client.contact.findUnique({
                where: { phone: normalizedPhone },
            });
            if (existingByPhone) {
                contact_id = existingByPhone.id;
            } else {
                const newContact = await client.contact.create({
                    data: {
                        name: contact_name || "Unknown",
                        email: contact_email?.trim() || null,
                        phone: normalizedPhone,
                        sourceMode: "manual",
                        pendingSync: false,
                    },
                });
                contact_id = newContact.id;
            }
        } else {
            return createErrorResponse("MISSING_CONTACT_ID", "Contact ID or phone is required.", 400);
        }

        const audio_upload_id = randomUUID();
        let audio_object_key: string | null = null;

        if (audio_file && typeof audio_file.arrayBuffer === "function") {
            try {
                const bucket_name = process.env.MINIO_BUCKET || "interactions-audio";
                await ensureBucketExists(bucket_name);
                audio_object_key = `interactions/${audio_upload_id}.webm`;
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

        const result = await client.$transaction(async (tx) => {
            const txClient = tx as PrismaWithModels;
            const existingInteraction = await txClient.interaction.findFirst({
                where: { contactId: contact_id },
                orderBy: { createdAt: "desc" },
            });

            if (existingInteraction && audio_object_key) {
                await txClient.interaction.update({
                    where: { id: existingInteraction.id },
                    data: {
                        audioObjectKeys: [...existingInteraction.audioObjectKeys, audio_object_key],
                    },
                });
                return {
                    interaction: { ...existingInteraction, audioObjectKeys: [...existingInteraction.audioObjectKeys, audio_object_key] },
                    ai_job: null as { id: string } | null,
                };
            }

            const new_interaction_id = randomUUID();
            const interaction = await txClient.interaction.create({
                data: {
                    id: new_interaction_id,
                    contactId: contact_id,
                    audioObjectKeys: audio_object_key ? [audio_object_key] : [],
                    tags: (tags ?? undefined) as Prisma.InputJsonValue | undefined,
                    createdBy: session.id,
                },
            });

            const ai_job = await txClient.aiJob.create({
                data: {
                    interactionId: interaction.id,
                    status: "pending",
                },
            });

            return { interaction, ai_job };
        });

        if (result.interaction.audioObjectKeys?.length) {
            await addTranscribeJob({ interactionId: result.interaction.id });
        }

        return createSuccessResponse({
            interaction_id: result.interaction.id,
            ai_job_id: result.ai_job?.id ?? null,
            status: result.ai_job ? "Interaction created and AI job scheduled" : "Audio appended to existing interaction",
        });
    } catch (error) {
        return handleUnexpectedError(error, "CREATE_INTERACTION");
    }
}
