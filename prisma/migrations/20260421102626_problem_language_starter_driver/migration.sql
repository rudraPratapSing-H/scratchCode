-- Rename existing boilerplate to starterCode to preserve data
ALTER TABLE "ProblemLanguage"
RENAME COLUMN "boilerplate" TO "starterCode";

-- Add required driverCode safely for existing rows, then remove default
ALTER TABLE "ProblemLanguage"
ADD COLUMN "driverCode" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProblemLanguage"
ALTER COLUMN "driverCode" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Problem_title_idx" ON "Problem"("title");
