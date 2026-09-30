ALTER TABLE "Article" ADD COLUMN "registrationFormId" TEXT;

CREATE INDEX "Article_registrationFormId_idx" ON "Article"("registrationFormId");

ALTER TABLE "Article"
ADD CONSTRAINT "Article_registrationFormId_fkey"
FOREIGN KEY ("registrationFormId") REFERENCES "RegistrationForm"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
