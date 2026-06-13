-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "competitionId" TEXT;

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "fullScreenMandatory" BOOLEAN NOT NULL DEFAULT false,
    "keyboardShortcutsBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionProblem" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,

    CONSTRAINT "CompetitionProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionParticipant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cheatingAttempts" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionProblem_competitionId_problemId_key" ON "CompetitionProblem"("competitionId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionParticipant_competitionId_userId_key" ON "CompetitionParticipant"("competitionId", "userId");

-- CreateIndex
CREATE INDEX "Submission_competitionId_idx" ON "Submission"("competitionId");

-- AddForeignKey
ALTER TABLE "CompetitionProblem" ADD CONSTRAINT "CompetitionProblem_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionProblem" ADD CONSTRAINT "CompetitionProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
