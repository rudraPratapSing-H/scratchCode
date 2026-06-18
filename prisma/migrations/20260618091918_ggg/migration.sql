-- CreateTable
CREATE TABLE "CompetitionLog" (
    "id" TEXT NOT NULL,
    "competitionParticipantId" TEXT NOT NULL,
    "competitionProblemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionLog_competitionParticipantId_competitionProblemI_key" ON "CompetitionLog"("competitionParticipantId", "competitionProblemId");

-- AddForeignKey
ALTER TABLE "CompetitionLog" ADD CONSTRAINT "CompetitionLog_competitionParticipantId_fkey" FOREIGN KEY ("competitionParticipantId") REFERENCES "CompetitionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionLog" ADD CONSTRAINT "CompetitionLog_competitionProblemId_fkey" FOREIGN KEY ("competitionProblemId") REFERENCES "CompetitionProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
