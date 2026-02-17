ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "audio_object_keys" TEXT[] DEFAULT '{}';

UPDATE "interactions" SET "audio_object_keys" = ARRAY["audio_object_key"]::TEXT[] WHERE "audio_object_key" IS NOT NULL;
UPDATE "interactions" SET "audio_object_keys" = '{}' WHERE "audio_object_key" IS NULL;

ALTER TABLE "interactions" DROP COLUMN IF EXISTS "audio_object_key";
