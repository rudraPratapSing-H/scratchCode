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
        return prisma.competitionParticipant.create({
            data: {
                competitionId,
                userId,
                cheatingAttempts: 0,
                score: 0
            }
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
    }
};
