CREATE TABLE "UserGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_UserGroupMembers" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");
CREATE UNIQUE INDEX "_UserGroupMembers_AB_unique" ON "_UserGroupMembers"("A", "B");
CREATE INDEX "_UserGroupMembers_B_index" ON "_UserGroupMembers"("B");

ALTER TABLE "_UserGroupMembers"
ADD CONSTRAINT "_UserGroupMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_UserGroupMembers"
ADD CONSTRAINT "_UserGroupMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
