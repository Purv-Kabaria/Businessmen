import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// === DB URL MAP FROM ENV ===
const DB_MAP: Record<string, string | undefined> = {
    main: process.env.DATABASE_MAIN,
    local: process.env.DATABASE_LOCAL,
};

// === READ ARGUMENT ===
const dbKey = process.argv[2] || "main";

if (!DB_MAP[dbKey]) {
    console.error(`❌ Missing env for DB: "${dbKey}"`);
    process.exit(1);
}

console.log(`🔌 Connecting to database: ${dbKey}`);
console.log(`📦 Exporting ALL tables...`);

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DB_MAP[dbKey]!,
        },
    },
});

async function main() {
    const models = Prisma.dmmf.datamodel.models;

    for (const modelMeta of models) {
        const modelName = modelMeta.name;
        const model = (prisma as any)[modelName];

        if (!model?.findMany) continue;

        console.log(`⬇️ Exporting ${modelName}...`);

        const records = await model.findMany();

        const outputDir = path.join("db", dbKey, modelName);
        fs.mkdirSync(outputDir, { recursive: true });

        for (const record of records) {
            const id = record.id || crypto.randomUUID();
            fs.writeFileSync(
                path.join(outputDir, `${id}.json`),
                JSON.stringify(record, null, 2)
            );
        }

        console.log(`   ✅ ${records.length} record(s) exported.`);
    }

    console.log(`🎉 Database export complete!`);
}

main()
    .catch(err => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
