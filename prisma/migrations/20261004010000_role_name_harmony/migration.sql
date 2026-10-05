ALTER TABLE "RoleMenuAccess"
ADD COLUMN "name" TEXT,
ADD COLUMN "harmonyGroupId" TEXT;

UPDATE "RoleMenuAccess"
SET "name" = INITCAP(REPLACE(COALESCE("roleKey", "role"::TEXT), '_', ' '));

CREATE INDEX "RoleMenuAccess_harmonyGroupId_idx"
ON "RoleMenuAccess"("harmonyGroupId");

ALTER TABLE "RoleMenuAccess"
ADD CONSTRAINT "RoleMenuAccess_harmonyGroupId_fkey"
FOREIGN KEY ("harmonyGroupId") REFERENCES "HarmonyGroup"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
