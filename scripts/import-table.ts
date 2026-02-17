import { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// === DB URL MAP ===
const DB_MAP: Record<string, string | undefined> = {
    main: process.env.DATABASE_MAIN,
    local: process.env.DATABASE_LOCAL,
};

// === READ ARG ===
const dbKey = process.argv[2] || "main";

if (!DB_MAP[dbKey]) {
    console.error(`❌ DB URL missing for "${dbKey}"`);
    process.exit(1);
}

console.log(`🔌 Using database: ${dbKey}`);
console.log(`📥 Importing ALL tables...`);

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DB_MAP[dbKey]!,
        },
    },
});

async function main() {
    const baseDir = path.join("db", dbKey);

    if (!fs.existsSync(baseDir)) {
        console.error(`❌ Directory ${baseDir} does not exist.`);
        process.exit(1);
    }

    const models = Prisma.dmmf.datamodel.models;

    for (const modelMeta of models) {
        const modelName = modelMeta.name;
        const model = (prisma as any)[modelName];

        if (!model?.findMany) continue;

        const dataDir = path.join(baseDir, modelName);

        if (!fs.existsSync(dataDir)) {
            console.log(`⏭️ Skipping ${modelName} (no folder found)`);
            continue;
        }

        console.log(`📂 Importing ${modelName}...`);

        const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));

        const incomingRecords: any[] = [];

        for (const file of files) {
            const filePath = path.join(dataDir, file);
            const content = fs.readFileSync(filePath, "utf-8");

            try {
                incomingRecords.push(JSON.parse(content));
            } catch (err) {
                console.error(`❌ Error parsing ${file}`);
                process.exit(1);
            }
        }

        console.log(`   📦 Loaded ${incomingRecords.length} record(s)`);

        const existing = await model.findMany({ select: { id: true } });
        const existingIds = new Set(existing.map((r: any) => r.id));
        const incomingIds = new Set(incomingRecords.map((r: any) => r.id));

        const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));

        // SAFETY CHECK — prevent accidental wipe
        if (incomingRecords.length === 0 && existingIds.size > 0) {
            console.warn(`⚠️ Skipping delete for ${modelName} (incoming empty)`);
        } else if (idsToDelete.length > 0) {
            console.log(`   🗑️ Deleting ${idsToDelete.length} record(s)`);
            await model.deleteMany({
                where: { id: { in: idsToDelete } },
            });
        }

        console.log(`   ⬆️ Upserting ${incomingRecords.length} record(s)`);

        for (const record of incomingRecords) {
            if (!record.id) {
                console.warn(`⚠️ Skipping record without id`);
                continue;
            }

            await model.upsert({
                where: { id: record.id },
                update: record,
                create: record,
            });
        }

        console.log(`   ✅ ${modelName} import complete`);
    }

    console.log(`🎉 Database import finished!`);
}

main()
    .catch(err => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
