import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import s3Client from "@/lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.MINIO_BUCKET || "interactions-audio";

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        interactions: {
          where: { audioObjectKey: { not: null } },
          select: {
            id: true,
            audioObjectKey: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const withUrls = await Promise.all(
      contacts.map(async (c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        company: c.company,
        interactions: await Promise.all(
          (c.interactions as { id: string; audioObjectKey: string | null; createdAt: Date }[]).map(
            async (i) => {
              let audioUrl: string | null = null;
              if (i.audioObjectKey) {
                try {
                  const command = new GetObjectCommand({
                    Bucket: BUCKET,
                    Key: i.audioObjectKey,
                  });
                  audioUrl = await getSignedUrl(s3Client, command, {
                    expiresIn: 3600,
                  });
                } catch {
                  audioUrl = null;
                }
              }
              return {
                id: i.id,
                audioObjectKey: i.audioObjectKey,
                audioUrl,
                createdAt: i.createdAt,
              };
            }
          )
        ),
      }))
    );

    return NextResponse.json({
      success: true,
      data: { contacts: withUrls },
    });
  } catch (e) {
    console.error("[dummy/contacts]", e);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch contacts" } },
      { status: 500 }
    );
  }
}
