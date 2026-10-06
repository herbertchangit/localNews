CREATE TYPE "ArticleVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'GROUP');

ALTER TABLE "Article"
ADD COLUMN "visibility" "ArticleVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "visibilityGroupId" TEXT;

UPDATE "Article"
SET "visibility" = CASE WHEN "isPublic" THEN 'PUBLIC'::"ArticleVisibility" ELSE 'PRIVATE'::"ArticleVisibility" END;

CREATE INDEX "Article_visibilityGroupId_idx" ON "Article"("visibilityGroupId");

ALTER TABLE "Article"
ADD CONSTRAINT "Article_visibilityGroupId_fkey"
FOREIGN KEY ("visibilityGroupId") REFERENCES "UserGroup"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
