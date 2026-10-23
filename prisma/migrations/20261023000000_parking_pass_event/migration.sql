ALTER TABLE "ParkingPass"
ADD COLUMN "eventName" TEXT NOT NULL DEFAULT 'Visitor Parking',
ADD COLUMN "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ParkingPass"
SET
  "eventName" = 'Visitor Parking',
  "eventDate" = "createdAt"
WHERE "eventName" = 'Visitor Parking';
