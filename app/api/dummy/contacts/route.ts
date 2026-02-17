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
          where: { audioObjectKeys: { isEmpty: false } },
          select: {
            id: true,
            audioObjectKeys: true,
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
          (c.interactions as { id: string; audioObjectKeys: string[]; createdAt: Date }[]).map(
            async (i) => {
              const firstKey = i.audioObjectKeys?.length ? i.audioObjectKeys[0] : null;
              let audioUrl: string | null = null;
              if (firstKey) {
                try {
                  const command = new GetObjectCommand({
                    Bucket: BUCKET,
                    Key: firstKey,
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
                audioObjectKeys: i.audioObjectKeys,
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
