CREATE TABLE "ParkingPass" (
  "id" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "visitorName" TEXT NOT NULL,
  "mobileNumber" TEXT NOT NULL,
  "carPlateNumber" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "issuedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParkingPass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParkingPass_publicToken_key" ON "ParkingPass"("publicToken");
CREATE INDEX "ParkingPass_issuedById_createdAt_idx" ON "ParkingPass"("issuedById", "createdAt");
CREATE INDEX "ParkingPass_mobileNumber_idx" ON "ParkingPass"("mobileNumber");
CREATE INDEX "ParkingPass_carPlateNumber_idx" ON "ParkingPass"("carPlateNumber");

ALTER TABLE "ParkingPass"
ADD CONSTRAINT "ParkingPass_issuedById_fkey"
FOREIGN KEY ("issuedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing saved Admin profiles predate this menu. Grant the new Admin function
-- without changing any non-Admin role configuration.
UPDATE "RoleMenuAccess"
SET
  "menuIds" = array_append("menuIds", 'parking_passes'),
  "authorities" = jsonb_set(
    COALESCE("authorities", '{}'::jsonb),
    '{parking_passes}',
    '["new","view","edit","delete","copy_link"]'::jsonb,
    true
  )
WHERE "role" = 'ADMIN'
  AND NOT ('parking_passes' = ANY("menuIds"));
