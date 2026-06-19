import { prisma } from '../lib/prisma.ts';

export const CompetitionRepository = {
    async findCompetitionById(competitionId: string) {
        return prisma.competition.findUnique({
            where: { id: competitionId }
        });
    },

    async getCompetitionWithProblems(competitionId: string) {
        return prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                problems: {
                    include: {
                        problem: {
                            select: { id: true, title: true }
                        }
                    }
                }
            }
        });
    },

    async getAllCompetitionTitlesAndIds(organizationId: string) {
        return prisma.competition.findMany({
            where: { organizationId },
            select: {
                id: true,
                title: true,
                description: true,
                startTime: true,
                endTime: true,
            }
        });
    },

    async createCompetition(data: {
        title: string;
        description?: string;
        startTime: Date;
        endTime: Date;
        fullScreenMandatory: boolean;
        keyboardShortcutsBlocked: boolean;
        organizationId?: string;
    }) {
        return prisma.competition.create({
            data
        });
    },

    async linkProblemsToCompetition(competitionId: string, problems: { problemId: string, score: number }[]) {
        if (problems.length === 0) {
            return [];
        }

        return prisma.competitionProblem.createMany({
            data: problems.map((p) => ({ competitionId, problemId: p.problemId, score: p.score }))
        });
    },

    async findParticipantByCompetitionAndUser(competitionId: string, userId: string) {
        return prisma.competitionParticipant.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId
                }
            }
        });
    },

    async createParticipant(competitionId: string, userId: string) {
        return prisma.$transaction(async (tx) => {
            const participant = await tx.competitionParticipant.create({
                data: {
                    competitionId,
                    userId,
                    cheatingAttempts: 0,
                    score: 0
                }
            });

            const competitionProblems = await tx.competitionProblem.findMany({
                where: { competitionId }
            });

            if (competitionProblems.length > 0) {
                await tx.competitionLog.createMany({
                    data: competitionProblems.map((cp) => ({
                        competitionParticipantId: participant.id,
                        competitionProblemId: cp.id,
                        status: 'NOT_ATTEMPTED',
                        score: 0
                    }))
                });
            }

            return participant;
        });
    },

    async incrementCheatingAttempts(competitionId: string, userId: string) {
        return prisma.competitionParticipant.update({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId
                }
            },
            data: {
                cheatingAttempts: {
                    increment: 1
                }
            }
        });
    },

    async getCompetitionLeaderboard(competitionId: string) {
        return prisma.$queryRaw`
            WITH FirstAcceptedSubmissions AS (
                SELECT "userId", "problemId", MIN("createdAt") as "timeOfSubmission"
                FROM "Submission"
                WHERE "competitionId" = ${competitionId} AND "status" = 'Accepted'
                GROUP BY "userId", "problemId"
            ),
            UserScores AS (
                SELECT 
                    fas."userId", 
                    CAST(SUM(cp."score") AS INTEGER) as "totalScore", 
                    MAX(fas."timeOfSubmission") as "latestSubmissionTime"
                FROM FirstAcceptedSubmissions fas
                JOIN "CompetitionProblem" cp 
                  ON fas."problemId" = cp."problemId" AND cp."competitionId" = ${competitionId}
                GROUP BY fas."userId"
            )
            SELECT 
                u."username", 
                us."userId", 
                us."totalScore", 
                us."latestSubmissionTime"
            FROM UserScores us
            JOIN "User" u ON us."userId" = u."id"
            ORDER BY 
                us."totalScore" DESC, 
                us."latestSubmissionTime" ASC;
        `;
    },

    async findCompetitionProblem(competitionId: string, problemId: string) {
        return prisma.competitionProblem.findUnique({
            where: {
                competitionId_problemId: {
                    competitionId,
                    problemId
                }
            }
        });
    },

    async updateCompetitionLog(participantId: string, competitionProblemId: string, status: string, score: number, submissionId: string) {
        return prisma.competitionLog.update({
            where: {
                competitionParticipantId_competitionProblemId: {
                    competitionParticipantId: participantId,
                    competitionProblemId: competitionProblemId
                }
            },
            data: {
                status,
                score,
                submissionId
            }
        });
    },

    async startProblemTimer(participantId: string, competitionProblemId: string) {
        return prisma.competitionLog.update({
            where: {
                competitionParticipantId_competitionProblemId: {
                    competitionParticipantId: participantId,
                    competitionProblemId: competitionProblemId
                }
            },
            data: {
                lastStartedAt: new Date()
            }
        });
    },

    async pauseProblemTimer(participantId: string, competitionProblemId: string) {
        return prisma.$transaction(async (tx) => {
            const log = await tx.competitionLog.findUnique({
                where: {
                    competitionParticipantId_competitionProblemId: {
                        competitionParticipantId: participantId,
                        competitionProblemId: competitionProblemId
                    }
                }
            });

            if (!log || !log.lastStartedAt) return log;

            const now = new Date();
            const elapsedSeconds = Math.floor((now.getTime() - log.lastStartedAt.getTime()) / 1000);

            return tx.competitionLog.update({
                where: {
                    competitionParticipantId_competitionProblemId: {
                        competitionParticipantId: participantId,
                        competitionProblemId: competitionProblemId
                    }
                },
                data: {
                    timeTaken: log.timeTaken + elapsedSeconds,
                    lastStartedAt: null
                }
            });
        });
    },

    async getLogsForParticipant(participantId: string) {
        return prisma.competitionLog.findMany({
            where: { competitionParticipantId: participantId },
            select: {
                status: true,
                score: true,
                timeTaken: true,
                lastStartedAt: true,
                problem: {
                    select: {
                        problemId: true,
                        score: true,
                        problem: {
                            select: { title: true }
                        }
                    }
                }
            }
        });
    },

    async updateParticipantTotalScore(participantId: string) {
        const logs = await prisma.competitionLog.findMany({
            where: { competitionParticipantId: participantId },
            select: { score: true }
        });
        const totalScore = logs.reduce((sum, log) => sum + log.score, 0);
        return prisma.competitionParticipant.update({
            where: { id: participantId },
            data: { score: totalScore }
        });
    },

    async finishCompetitionParticipant(competitionId: string, userId: string) {
        return prisma.competitionParticipant.update({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId
                }
            },
            data: {
                finished: true
            }
        });
    },

    async getCompetitionParticipantsForAdmin(competitionId: string) {
        const participants = await prisma.competitionParticipant.findMany({
            where: { competitionId },
            include: {
                user: {
                    select: { id: true, username: true, email: true }
                },
                logs: {
                    select: {
                        status: true,
                        score: true,
                        timeTaken: true
                    }
                }
            }
        });

        return participants.map(p => {
            const totalScore = p.logs.reduce((sum, log) => sum + log.score, 0);
            const totalTimeTaken = p.logs.reduce((sum, log) => sum + log.timeTaken, 0);
            const questionsAccepted = p.logs.filter(log => log.status === 'Accepted').length;
            const totalQuestions = p.logs.length;

            return {
                participantId: p.id,
                userId: p.user.id,
                username: p.user.username,
                email: p.user.email,
                score: totalScore,
                cheatingAttempts: p.cheatingAttempts,
                finished: p.finished,
                totalTimeTaken,
                questionsAccepted,
                totalQuestions
            };
        });
    },

    async getParticipantDetailForAdmin(participantId: string) {
        const participant = await prisma.competitionParticipant.findUnique({
            where: { id: participantId },
            include: {
                user: {
                    select: { id: true, username: true, email: true }
                },
                logs: {
                    include: {
                        problem: {
                            include: {
                                problem: {
                                    select: { title: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!participant) return null;

        // For each log that has a submissionId, fetch the submission code
        const logsWithCode = await Promise.all(
            participant.logs.map(async (log) => {
                let submittedCode: string | null = null;
                let language: string | null = null;

                if (log.submissionId) {
                    const submission = await prisma.submission.findUnique({
                        where: { id: log.submissionId },
                        select: { code: true, language: true }
                    });
                    if (submission) {
                        submittedCode = submission.code;
                        language = submission.language;
                    }
                }

                return {
                    problemTitle: log.problem.problem.title,
                    status: log.status,
                    score: log.score,
                    timeTaken: log.timeTaken,
                    submittedCode,
                    language
                };
            })
        );

        return {
            userId: participant.user.id,
            username: participant.user.username,
            email: participant.user.email,
            questions: logsWithCode
        };
    }
};
