import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    },
    forcePathStyle: true, // Necessary for MinIO
});

export async function ensureBucketExists(bucketName: string) {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        } else {
            console.error(`[S3] Failed to head bucket ${bucketName}:`, error);
            throw error;
        }
    }
}

export { PutObjectCommand };
export default s3Client;
