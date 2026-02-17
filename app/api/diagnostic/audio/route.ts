import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        // Get basic statistics
        const [
            totalInteractions,
            withAudio,
            sampleInteractions
        ] = await Promise.all([
            prisma.interaction.count(),
            prisma.interaction.count({
                where: {
                    audioObjectKey: {
                        not: null,
                    },
                },
            }),
            prisma.interaction.findMany({
                where: {
                    audioObjectKey: {
                        not: null,
                    },
                },
                take: 3,
                select: {
                    id: true,
                    audioObjectKey: true,
                    createdAt: true,
                    contact: {
                        select: {
                            name: true,
                            phone: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                stats: {
                    totalInteractions,
                    withAudio,
                    withoutAudio: totalInteractions - withAudio,
                },
                sampleInteractions,
                minioConfig: {
                    endpoint: process.env.MINIO_ENDPOINT || "not set",
                    region: process.env.MINIO_REGION || "not set",
                    bucket: process.env.MINIO_BUCKET_NAME || "not set",
                    hasAccessKey: !!process.env.MINIO_ACCESS_KEY,
                    hasSecretKey: !!process.env.MINIO_SECRET_KEY,
                },
            },
        });
    } catch (error: any) {
        console.error("[Diagnostic] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}
