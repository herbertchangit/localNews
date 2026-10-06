ALTER TABLE "UserGroup" ADD COLUMN "harmonyGroupId" TEXT;

-- Preserve legacy groups by assigning the Harmony represented by most members.
UPDATE "UserGroup" AS group_record
SET "harmonyGroupId" = ranked."harmonyGroupId"
FROM (
  SELECT "groupId", "harmonyGroupId"
  FROM (
    SELECT
      membership."B" AS "groupId",
      member."harmonyGroupId",
      ROW_NUMBER() OVER (
        PARTITION BY membership."B"
        ORDER BY COUNT(*) DESC, member."harmonyGroupId"
      ) AS rank
    FROM "_UserGroupMembers" AS membership
    JOIN "User" AS member ON member.id = membership."A"
    WHERE member."harmonyGroupId" IS NOT NULL
    GROUP BY membership."B", member."harmonyGroupId"
  ) AS counted
  WHERE rank = 1
) AS ranked
WHERE group_record.id = ranked."groupId";

-- A Harmony-scoped group cannot retain members from another Harmony.
DELETE FROM "_UserGroupMembers" AS membership
USING "UserGroup" AS group_record, "User" AS member
WHERE membership."B" = group_record.id
  AND membership."A" = member.id
  AND group_record."harmonyGroupId" IS NOT NULL
  AND member."harmonyGroupId" IS DISTINCT FROM group_record."harmonyGroupId";

CREATE INDEX "UserGroup_harmonyGroupId_idx" ON "UserGroup"("harmonyGroupId");

ALTER TABLE "UserGroup"
ADD CONSTRAINT "UserGroup_harmonyGroupId_fkey"
FOREIGN KEY ("harmonyGroupId") REFERENCES "HarmonyGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
