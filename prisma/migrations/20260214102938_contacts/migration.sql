/*
  Warnings:

  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "company" TEXT,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "intentTags" JSONB,
ADD COLUMN     "pendingSync" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "Contact";
