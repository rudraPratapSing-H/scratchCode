-- CreateIndex
CREATE INDEX "Submission_userId_problemId_language_createdAt_idx" ON "Submission"("userId", "problemId", "language", "createdAt" DESC);
