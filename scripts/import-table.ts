import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// === DB URL MAP FROM ENV ===
const DB_MAP: Record<string, string | undefined> = {
    main: process.env.DATABASE_MAIN,
    local: process.env.DATABASE_LOCAL,
};

// === READ ARGS ===
const tableName = process.argv[2];
const dbKey = process.argv[3] || "main";

if (!tableName) {
    console.error("❌ Please provide a table name.\nUsage: pnpm import-table User [main|local]");
    process.exit(1);
}

if (!DB_MAP[dbKey]) {
    console.error(`❌ DB URL missing for "${dbKey}".`);
    console.error(`Add DATABASE_MAIN or DATABASE_LOCAL to your .env file.`);
    process.exit(1);
}

console.log(`🔌 Using database: ${dbKey}`);
console.log(`📥 Importing into table: ${tableName}`);

// === INIT PRISMA WITH DYNAMIC URL ===
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DB_MAP[dbKey]!,
        },
    },
});

async function main() {
    const model = (prisma as any)[tableName];

    if (!model || typeof model.findMany !== "function") {
        console.error(`❌ Model "${tableName}" not found in Prisma schema.`);
        process.exit(1);
    }

    const dataDir = path.join("db", dbKey, tableName);

    if (!fs.existsSync(dataDir)) {
        console.error(`❌ Directory ${dataDir} does not exist.`);
        process.exit(1);
    }

    console.log(`📂 Reading JSON files from: ${dataDir}`);

    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    const incomingRecords: any[] = [];

    for (const filename of files) {
        const filePath = path.join(dataDir, filename);
        const content = fs.readFileSync(filePath, "utf-8");

        try {
            incomingRecords.push(JSON.parse(content));
        } catch (err) {
            console.error(`❌ Error parsing ${filename}:`, err);
            process.exit(1);
        }
    }

    console.log(`📦 Loaded ${incomingRecords.length} record(s).`);

    // Fetch existing
    const existing = await model.findMany();
    const existingIds = new Set(existing.map((r: any) => r.id));
    const incomingIds = new Set(incomingRecords.map((r: any) => r.id));

    // Determine what to delete
    // Only delete if we have incoming records to replace them with, or if the directory was explicitly empty?
    // Safety: If incomingRecords is empty, we might be wiping the table.
    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));

    console.log(`🗑️ Deleting ${idsToDelete.length} removed record(s)...`);
    if (idsToDelete.length > 0) {
        await model.deleteMany({
            where: { id: { in: idsToDelete } },
        });
    }

    // Upsert incoming
    console.log(`⬆️ Upserting ${incomingRecords.length} record(s)...`);

    for (const record of incomingRecords) {
        if (!record.id) {
            console.warn("⚠️ Skipping record without id:", record);
            continue;
        }

        await model.upsert({
            where: { id: record.id },
            update: record,
            create: record,
        });
    }

    console.log(`✅ Import complete!`);
    console.log(`   ✔ Upserted: ${incomingRecords.length}`);
    console.log(`   ✔ Deleted: ${idsToDelete.length}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
