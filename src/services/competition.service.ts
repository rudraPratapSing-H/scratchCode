import { CompetitionRepository } from '../repository/competition.repository.ts';
import { ProblemRepository } from '../repository/problem.repository.ts';

export const CompetitionService = {
    async createCompetition(data: {
        title?: string;
        startTime: string;
        endTime: string;
        fullScreenMandatory?: boolean;
        keyboardShortcutsBlocked?: boolean;
        problemIds?: string[];
    }) {
        const { title, startTime, endTime, fullScreenMandatory, keyboardShortcutsBlocked, problemIds } = data;

        if (!title || !startTime || !endTime) {
            throw new Error('title, startTime and endTime are required');
        }

        const parsedStart = new Date(startTime);
        const parsedEnd = new Date(endTime);

        if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
            throw new Error('Invalid startTime or endTime');
        }

        const problemIdList = Array.isArray(problemIds) ? problemIds : [];
        const existingProblemIds = await ProblemRepository.findProblemIdsByIds(problemIdList);

        if (existingProblemIds.length !== problemIdList.length) {
            throw new Error('One or more problemIds are invalid');
        }

        const competition = await CompetitionRepository.createCompetition({
            title,
            startTime: parsedStart,
            endTime: parsedEnd,
            fullScreenMandatory: !!fullScreenMandatory,
            keyboardShortcutsBlocked: !!keyboardShortcutsBlocked,
        });

        await CompetitionRepository.linkProblemsToCompetition(competition.id, problemIdList);

        return competition;
    },

    async registerParticipant(competitionId: string, userId: string) {
        if (!competitionId) {
            throw new Error('competitionId is required');
        }

        if (!userId) {
            throw new Error('Unauthorized');
        }

        const competition = await CompetitionRepository.findCompetitionById(competitionId);
        if (!competition) {
            throw new Error('Competition not found');
        }

        const existingParticipant = await CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId);
        if (existingParticipant) {
            return { participant: existingParticipant, alreadyRegistered: true };
        }

        const participant = await CompetitionRepository.createParticipant(competitionId, userId);
        return { participant, alreadyRegistered: false };
    }
};
