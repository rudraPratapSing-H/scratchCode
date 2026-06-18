-- AlterTable
ALTER TABLE "CompetitionLog" ADD COLUMN     "lastStartedAt" TIMESTAMP(3),
ADD COLUMN     "timeTaken" INTEGER NOT NULL DEFAULT 0;
