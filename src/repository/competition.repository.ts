import { prisma } from '../lib/prisma.ts';

export const CompetitionRepository = {
    async findCompetitionById(competitionId: string) {
        return prisma.competition.findUnique({
            where: { id: competitionId }
        });
    },

    async createCompetition(data: {
        title: string;
        startTime: Date;
        endTime: Date;
        fullScreenMandatory: boolean;
        keyboardShortcutsBlocked: boolean;
    }) {
        return prisma.competition.create({
            data
        });
    },

    async linkProblemsToCompetition(competitionId: string, problemIds: string[]) {
        if (problemIds.length === 0) {
            return [];
        }

        return prisma.competitionProblem.createMany({
            data: problemIds.map((problemId) => ({ competitionId, problemId }))
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
    }
};
