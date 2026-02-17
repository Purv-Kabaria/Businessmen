/*
  Warnings:

  - A unique constraint covering the columns `[offline_local_id]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "offline_local_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contacts_offline_local_id_key" ON "contacts"("offline_local_id");
