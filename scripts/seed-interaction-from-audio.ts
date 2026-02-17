/**
 * Create a DB entry (Contact + Interaction) using public/voice.webm and public/transcript.txt.
 * Uploads the WebM to S3 (MinIO), then creates the interaction with the given transcript.
 *
 * Usage: pnpm exec tsx scripts/seed-interaction-from-audio.ts [path/to/audio.webm] [path/to/transcript.txt]
 * Defaults: public/voice.webm, public/transcript.txt
 *
 * Requires: DATABASE_URL, MinIO/S3 env (MINIO_* or AWS). Optional: CREATED_BY_USER_ID (default: first user).
 */

import { createReadStream, existsSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import s3Client, { ensureBucketExists, PutObjectCommand } from "@/lib/s3";

dotenv.config();

const prisma = new PrismaClient();

const WEBM_EXT = ".webm";
const defaultAudioPath = join(process.cwd(), "public", "voice.webm");
const defaultTranscriptPath = join(process.cwd(), "public", "transcript.txt");
const audioPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : defaultAudioPath;
const transcriptPath = process.argv[3] ? join(process.cwd(), process.argv[3]) : defaultTranscriptPath;

function readFile(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path)
      .on("data", (chunk: string | Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!existsSync(audioPath)) {
    console.error("Audio file not found:", audioPath);
    process.exit(1);
  }
  if (!audioPath.toLowerCase().endsWith(WEBM_EXT)) {
    console.error("Audio must be a .webm file");
    process.exit(1);
  }
  if (!existsSync(transcriptPath)) {
    console.error("Transcript file not found:", transcriptPath);
    process.exit(1);
  }

  const transcript = readFileSync(transcriptPath, "utf-8").trim();
  if (!transcript) {
    console.error("Transcript is empty");
    process.exit(1);
  }

  const bucketName = process.env.MINIO_BUCKET || "interactions-audio";
  await ensureBucketExists(bucketName);

  const audioKey = `interactions/seed-${randomUUID()}.webm`;
  const audioBuffer = await readFile(audioPath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: "audio/webm",
    })
  );
  console.log("Uploaded audio to S3:", audioKey);

  let createdByUserId = process.env.CREATED_BY_USER_ID;
  if (!createdByUserId) {
    const user = await prisma.user.findFirst({ select: { id: true, fullName: true } });
    if (!user) {
      console.error("No user in DB. Create a user first or set CREATED_BY_USER_ID.");
      process.exit(1);
    }
    createdByUserId = user.id;
    console.log("Using user:", user.fullName, createdByUserId);
  }

  const testPhone = process.env.SEED_CONTACT_PHONE || "+15550000001";
  const contact = await prisma.contact.upsert({
    where: { phone: testPhone },
    update: {},
    create: {
      name: "Test Contact (seed)",
      phone: testPhone,
      email: "test-seed@example.com",
      company: "Seed Co",
      currentStage: "Met",
      sourceMode: "manual",
    },
    select: { id: true, name: true, phone: true },
  });
  console.log("Contact:", contact.name, contact.phone, contact.id);

  const interaction = await prisma.interaction.create({
    data: {
      contactId: contact.id,
      audioObjectKeys: [audioKey],
      transcript,
      createdBy: createdByUserId,
    },
    select: { id: true, createdAt: true },
  });

  await prisma.aiJob.create({
    data: { interactionId: interaction.id, status: "completed" },
  });

  console.log("Created interaction:", interaction.id, interaction.createdAt);
  console.log("Done. View in moderator audio list.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
