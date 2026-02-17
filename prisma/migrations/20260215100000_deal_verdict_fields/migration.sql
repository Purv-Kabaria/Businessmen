ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "deal_profitable" BOOLEAN;
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "deal_engaging" BOOLEAN;
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "deal_worthy" BOOLEAN;
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "deal_notes" TEXT;
