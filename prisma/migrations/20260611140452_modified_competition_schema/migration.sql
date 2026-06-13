-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "CompetitionProblem" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;
