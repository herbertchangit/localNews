ALTER TABLE "Article" ADD COLUMN "harmony" TEXT;

UPDATE "Article" AS article
SET "harmony" = harmony_group."name"
FROM "User" AS creator
LEFT JOIN "HarmonyGroup" AS harmony_group
  ON harmony_group."id" = creator."harmonyGroupId"
WHERE article."authorId" = creator."id";
