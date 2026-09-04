CREATE TABLE "PhotoUserTag" (
  "photoId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "PhotoUserTag_pkey" PRIMARY KEY ("photoId", "userId"),
  CONSTRAINT "PhotoUserTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "ArticlePhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PhotoUserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PhotoUserTag_userId_idx" ON "PhotoUserTag"("userId");
