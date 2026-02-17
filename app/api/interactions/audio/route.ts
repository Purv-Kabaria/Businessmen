import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import s3Client from "@/lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET_NAME = process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_NAME || "htt-businessmen";

type InteractionWithAudio = {
    id: string;
    createdAt: Date;
    contactId: string;
    audioObjectKeys: string[];
    transcript: string | null;
    structuredSnapshot: unknown;
    tags: unknown;
    createdBy: string;
    contact: { id: string; name: string | null; phone: string; email: string | null; company: string | null; currentStage: string; intentTags: unknown };
    createdByUser: { id: string; fullName: string; email: string };
};

export async function GET(req: NextRequest) {
    try {
        // 1. Verify authentication and role
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, error: { message: "Unauthorized" } },
                { status: 401 }
            );
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return NextResponse.json(
                { success: false, error: { message: "Server configuration error" } },
                { status: 500 }
            );
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
        const userRole = (payload as { role?: string }).role;

        if (!userRole || !["MODERATOR", "ADMIN"].includes(userRole)) {
            return NextResponse.json(
                { success: false, error: { message: "Forbidden" } },
                { status: 403 }
            );
        }

        // 2. Get pagination and search parameters
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const search = searchParams.get("search") || "";
        const skip = (page - 1) * limit;

        const whereClause = {
            audioObjectKeys: { isEmpty: false } as const,
            ...(search && {
                OR: [
                    { transcript: { contains: search, mode: "insensitive" as const } },
                    {
                        contact: {
                            OR: [
                                { name: { contains: search, mode: "insensitive" as const } },
                                { email: { contains: search, mode: "insensitive" as const } },
                                { company: { contains: search, mode: "insensitive" as const } },
                                { phone: { contains: search, mode: "insensitive" as const } },
                            ]
                        }
                    }
                ]
            }),
        };

        const [interactionsRows, total] = await Promise.all([
            prisma.interaction.findMany({
                where: whereClause,
                include: {
                    contact: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            email: true,
                            company: true,
                            currentStage: true,
                            intentTags: true,
                        },
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
            prisma.interaction.count({
                where: whereClause,
            }),
        ]);

        const interactions = interactionsRows as unknown as InteractionWithAudio[];
        const interactionsWithUrls = await Promise.all(
            interactions.map(async (interaction) => {
                const raw = interaction as unknown as { audioObjectKeys?: string[]; audioObjectKey?: string | null };
                const keys = (raw.audioObjectKeys?.length ? raw.audioObjectKeys : raw.audioObjectKey ? [raw.audioObjectKey] : []) as string[];
                const audioUrls: (string | null)[] = [];
                for (const key of keys) {
                    try {
                        const command = new GetObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: key,
                        });
                        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                        audioUrls.push(url);
                    } catch (error) {
                        console.error(`[API /audio] Failed to generate signed URL for ${key}:`, error);
                        audioUrls.push(null);
                    }
                }

                return {
                    id: interaction.id,
                    audioUrls,
                    audioObjectKeys: keys,
                    transcript: interaction.transcript,
                    structuredSnapshot: interaction.structuredSnapshot,
                    tags: interaction.tags,
                    createdAt: interaction.createdAt,
                    contact: interaction.contact,
                    createdBy: interaction.createdByUser,
                };
            })
        );

        return NextResponse.json({
            success: true,
            data: {
                interactions: interactionsWithUrls,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error: unknown) {
        console.error("[API /api/interactions/audio] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : "Failed to fetch audio interactions",
                },
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        // 1. Verify authentication (Similar to GET)
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, error: { message: "Unauthorized" } },
                { status: 401 }
            );
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return NextResponse.json(
                { success: false, error: { message: "Server configuration error" } },
                { status: 500 }
            );
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
        const userRole = (payload as { role?: string }).role;

        if (!userRole || !["MODERATOR", "ADMIN"].includes(userRole)) {
            return NextResponse.json(
                { success: false, error: { message: "Forbidden" } },
                { status: 403 }
            );
        }

        // 2. Parse request body
        const body = await req.json();
        const { interactionId, transcript, structuredSnapshot } = body;

        if (!interactionId) {
            return NextResponse.json(
                { success: false, error: { message: "Missing required fields" } },
                { status: 400 }
            );
        }

        const updateData: { transcript?: string; structuredSnapshot?: Prisma.InputJsonValue } = {};
        if (transcript !== undefined) updateData.transcript = transcript;
        if (structuredSnapshot !== undefined) updateData.structuredSnapshot = structuredSnapshot as Prisma.InputJsonValue;

        const updatedInteraction = await prisma.interaction.update({
            where: { id: interactionId },
            data: updateData,
            include: {
                contact: true
            }
        });

        // 4. Also update contact's transcript history/snapshot if needed?
        // (For now, just updating the interaction itself is the core requirement)

        // 5. Trigger Embedding Pipeline (Fire and Forget)
        if (updatedInteraction.transcript) {
            const embeddingPayload = {
                id: updatedInteraction.id,
                text: updatedInteraction.transcript,
                metadata: {
                    contactId: updatedInteraction.contactId,
                    date: updatedInteraction.createdAt.toISOString(),
                    type: "audio"
                }
            };

            // Non-blocking call to Python backend
            fetch(`${process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000'}/api/simulation/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(embeddingPayload)
            }).catch(err => console.error("[API] Failed to trigger embedding:", err));
        }

        return NextResponse.json({
            success: true,
            data: updatedInteraction
        });

    } catch (error: unknown) {
        console.error("[API /api/interactions/audio] PATCH Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : "Failed to update transcription",
                },
            },
            { status: 500 }
        );
    }
}
