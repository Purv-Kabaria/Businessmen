import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import s3Client from "@/lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET_NAME = process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_NAME || "htt-businessmen";

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
        const userRole = (payload as any).role;

        // Only MODERATOR and ADMIN can access
        if (!["MODERATOR", "ADMIN"].includes(userRole)) {
            return NextResponse.json(
                { success: false, error: { message: "Forbidden" } },
                { status: 403 }
            );
        }

        // 2. Get pagination parameters
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        // 3. Fetch interactions with audio and related contact
        const [interactions, total] = await Promise.all([
            prisma.interaction.findMany({
                where: {
                    audioObjectKey: {
                        not: null,
                    },
                },
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
                where: {
                    audioObjectKey: {
                        not: null,
                    },
                },
            }),
        ]);

        // 4. Generate signed URLs for audio files
        const interactionsWithUrls = await Promise.all(
            interactions.map(async (interaction) => {
                let audioUrl = null;
                if (interaction.audioObjectKey) {
                    try {
                        console.log(`[API /audio] Generating signed URL for key: ${interaction.audioObjectKey}`);
                        const command = new GetObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: interaction.audioObjectKey,
                        });
                        audioUrl = await getSignedUrl(s3Client, command, {
                            expiresIn: 3600, // 1 hour
                        });
                        console.log(`[API /audio] Successfully generated URL for ${interaction.audioObjectKey}`);
                    } catch (error) {
                        console.error(
                            `[API /audio] Failed to generate signed URL for ${interaction.audioObjectKey}:`,
                            error
                        );
                        console.error(`[API /audio] S3 Config:`, {
                            bucket: BUCKET_NAME,
                            endpoint: process.env.MINIO_ENDPOINT,
                            hasAccessKey: !!process.env.MINIO_ACCESS_KEY,
                            hasSecretKey: !!process.env.MINIO_SECRET_KEY,
                        });
                    }
                } else {
                    console.log(`[API /audio] No audioObjectKey for interaction ${interaction.id}`);
                }

                return {
                    id: interaction.id,
                    audioUrl,
                    audioObjectKey: interaction.audioObjectKey,
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
    } catch (error: any) {
        console.error("[API /api/interactions/audio] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    message: error.message || "Failed to fetch audio interactions",
                },
            },
            { status: 500 }
        );
    }
}
