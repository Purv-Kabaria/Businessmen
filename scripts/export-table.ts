import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// === DB URL MAP FROM ENV ===
const DB_MAP: Record<string, string | undefined> = {
    main: process.env.DATABASE_MAIN,
    local: process.env.DATABASE_LOCAL, // Ensure this matches your local .env key
};

// === READ ARGUMENTS ===
const tableName = process.argv[2];
const dbKey = process.argv[3] || "main";

if (!tableName) {
    console.error("❌ Please provide a table name.\nUsage: pnpm export-table User [main|local]");
    process.exit(1);
}

if (!DB_MAP[dbKey]) {
    console.error(`❌ Missing env for DB: "${dbKey}".`);
    console.error(`Add DATABASE_MAIN or DATABASE_LOCAL to your .env file.`);
    process.exit(1);
}

console.log(`🔌 Connecting to database: ${dbKey}`);
console.log(`📦 Exporting table: ${tableName}`);

// === CREATE DYNAMIC PRISMA CLIENT ===
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

    const records = await model.findMany();

    const outputDir = path.join("db", dbKey, tableName);
    fs.mkdirSync(outputDir, { recursive: true });

    for (const record of records) {
        const id = record.id || crypto.randomUUID();
        fs.writeFileSync(
            path.join(outputDir, `${id}.json`),
            JSON.stringify(record, null, 2)
        );
    }

    console.log(`✅ Export complete! Wrote ${records.length} file(s) to ${outputDir}`);
}

main()
    .catch(err => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
