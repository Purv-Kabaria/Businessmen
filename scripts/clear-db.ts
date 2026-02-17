import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in .env");
    process.exit(1);
}

console.log("⚠️ Clearing ALL tables except 'User'");
console.log("🔌 Using DATABASE_URL");

const prisma = new PrismaClient();

async function main() {
    type PrismaDelegate = { deleteMany: () => Promise<unknown> };
    const modelNames = Object.keys(prisma).filter(
        (key) =>
            !key.startsWith("$") &&
            !key.startsWith("_") &&
            typeof (prisma as Record<string, PrismaDelegate>)[key]?.deleteMany === "function"
    );

    const filteredModels = modelNames.filter(
        (model) => model !== "user" && model !== "User"
    );

    console.log("📋 Deleting from models:");
    console.log(filteredModels);

    const deleteOperations = filteredModels
        .reverse()
        .map((model) => (prisma as Record<string, PrismaDelegate>)[model].deleteMany());

    await prisma.$transaction(deleteOperations);

    console.log("✅ All non-User tables cleared successfully.");
}

main()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
