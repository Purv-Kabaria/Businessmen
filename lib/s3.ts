import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Build endpoint URL from env variables
const MINIO_HOST = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = process.env.MINIO_PORT || "9000";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
const MINIO_PROTOCOL = MINIO_USE_SSL ? "https" : "http";

// Construct full endpoint (handle case where MINIO_ENDPOINT might already include protocol)
const ENDPOINT = MINIO_HOST.startsWith("http")
    ? MINIO_HOST
    : `${MINIO_PROTOCOL}://${MINIO_HOST}:${MINIO_PORT}`;

console.log("[S3 Client] Initializing with endpoint:", ENDPOINT);

const s3Client = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint: ENDPOINT,
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    },
    forcePathStyle: true, // Necessary for MinIO
});

export async function ensureBucketExists(bucketName: string) {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`[S3 Client] Bucket "${bucketName}" exists`);
    } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            console.log(`[S3 Client] Creating bucket "${bucketName}"...`);
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log(`[S3 Client] Bucket "${bucketName}" created`);
        } else {
            console.error(`[S3] Failed to head bucket ${bucketName}:`, error);
            throw error;
        }
    }
}

export { PutObjectCommand, GetObjectCommand, getSignedUrl };
export default s3Client;
