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
                    audioObjectKeys: { isEmpty: false },
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
                    audioObjectKeys: { isEmpty: false },
                },
            }),
        ]);

        const interactionsWithUrls = await Promise.all(
            interactions.map(async (interaction) => {
                const audioUrls: (string | null)[] = [];
                for (const key of interaction.audioObjectKeys) {
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
                    audioObjectKeys: interaction.audioObjectKeys,
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
