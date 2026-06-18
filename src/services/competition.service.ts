import { CompetitionRepository } from '../repository/competition.repository.ts';
import { ProblemRepository } from '../repository/problem.repository.ts';

export const CompetitionService = {
    async getCompetitionProblemTitles(competitionId: string) {
        if (!competitionId) throw new Error('competitionId is required');
        const competition = await CompetitionRepository.getCompetitionWithProblems(competitionId);
        if (!competition) throw new Error('Competition not found');
        return {
            description: competition.description,
            startTime: competition.startTime,
            endTime: competition.endTime,
            fullScreenMandatory: competition.fullScreenMandatory,
            problems: competition.problems.map(cp => ({
                id: cp.problem.id,
                title: cp.problem.title,
                score: cp.score
            }))
        };
    },
    async getAllCompetitionTitlesAndIds(organizationId: string) {
        if (!organizationId) throw new Error('organizationId is required');
        return CompetitionRepository.getAllCompetitionTitlesAndIds(organizationId);
    },
    async createCompetition(data: {
        title?: string;
        description?: string;
        startTime: string;
        endTime: string;
        fullScreenMandatory?: boolean;
        keyboardShortcutsBlocked?: boolean;
        problems?: { problemId: string, score?: number }[];
        organizationId?: string;
    }) {
        const { title, description, startTime, endTime, fullScreenMandatory, keyboardShortcutsBlocked, problems, organizationId } = data;

        if (!title || !startTime || !endTime) {
            throw new Error('title, startTime and endTime are required');
        }

        const parsedStart = new Date(startTime);
        const parsedEnd = new Date(endTime);

        if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
            throw new Error('Invalid startTime or endTime');
        }

        const problemList = Array.isArray(problems) ? problems : [];
        const problemIds = problemList.map(p => p.problemId);
        const existingProblemIds = await ProblemRepository.findProblemIdsByIds(problemIds);

        if (existingProblemIds.length !== problemList.length) {
            throw new Error('One or more problemIds are invalid');
        }

        const competition = await CompetitionRepository.createCompetition({
            title,
            description,
            startTime: parsedStart,
            endTime: parsedEnd,
            fullScreenMandatory: !!fullScreenMandatory,
            keyboardShortcutsBlocked: !!keyboardShortcutsBlocked,
            organizationId: data.organizationId
        });

        const problemsToLink = problemList.map(p => ({
            problemId: p.problemId,
            score: p.score ?? 0
        }));

        await CompetitionRepository.linkProblemsToCompetition(competition.id, problemsToLink);

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
            return { 
                participant: existingParticipant, 
                alreadyRegistered: true, 
                fullScreenMandatory: competition.fullScreenMandatory,
                startTime: competition.startTime,
                endTime: competition.endTime
            };
        }

        const participant = await CompetitionRepository.createParticipant(competitionId, userId);
        return { 
            participant, 
            alreadyRegistered: false, 
            fullScreenMandatory: competition.fullScreenMandatory,
            startTime: competition.startTime,
            endTime: competition.endTime
        };
    },

    async logCheatingAttempt(competitionId: string, userId: string) {
        if (!competitionId) throw new Error('competitionId is required');
        if (!userId) throw new Error('Unauthorized');

        const participant = await CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        return CompetitionRepository.incrementCheatingAttempts(competitionId, userId);
    },

    async getLeaderboard(competitionId: string) {
        if (!competitionId) {
            throw new Error('competitionId is required');
        }

        const competition = await CompetitionRepository.findCompetitionById(competitionId);
        if (!competition) {
            throw new Error('Competition not found');
        }

        return CompetitionRepository.getCompetitionLeaderboard(competitionId);
    },

    async updateCompetitionLogForSubmission(competitionId: string, problemId: string, userId: string, submissionStatus: string, submissionId: string) {
        const [participant, compProblem] = await Promise.all([
            CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId),
            CompetitionRepository.findCompetitionProblem(competitionId, problemId)
        ]);

        if (!participant || !compProblem) return;

        const isAccepted = submissionStatus === 'Accepted';
        await CompetitionRepository.updateCompetitionLog(
            participant.id,
            compProblem.id,
            submissionStatus,
            isAccepted ? compProblem.score : 0,
            submissionId
        );

        // Recalculate and update the participant's total score
        await CompetitionRepository.updateParticipantTotalScore(participant.id);
    },

    async getParticipantLogs(competitionId: string, userId: string) {
        if (!competitionId) throw new Error('competitionId is required');
        if (!userId) throw new Error('Unauthorized');

        const participant = await CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId);
        if (!participant) throw new Error('Participant not found');

        const logs = await CompetitionRepository.getLogsForParticipant(participant.id);

        return logs.map(log => ({
            problemId: log.problem.problemId,
            title: log.problem.problem.title,
            status: log.status,
            score: log.score,
            maxScore: log.problem.score,
            timeTaken: log.timeTaken,
            lastStartedAt: log.lastStartedAt
        }));
    },

    async startProblemTimer(competitionId: string, problemId: string, userId: string) {
        if (!competitionId || !problemId) throw new Error('competitionId and problemId are required');
        if (!userId) throw new Error('Unauthorized');

        const [participant, compProblem] = await Promise.all([
            CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId),
            CompetitionRepository.findCompetitionProblem(competitionId, problemId)
        ]);

        if (!participant || !compProblem) throw new Error('Participant or CompetitionProblem not found');

        return CompetitionRepository.startProblemTimer(participant.id, compProblem.id);
    },

    async pauseProblemTimer(competitionId: string, problemId: string, userId: string) {
        if (!competitionId || !problemId) throw new Error('competitionId and problemId are required');
        if (!userId) throw new Error('Unauthorized');

        const [participant, compProblem] = await Promise.all([
            CompetitionRepository.findParticipantByCompetitionAndUser(competitionId, userId),
            CompetitionRepository.findCompetitionProblem(competitionId, problemId)
        ]);

        if (!participant || !compProblem) throw new Error('Participant or CompetitionProblem not found');

        return CompetitionRepository.pauseProblemTimer(participant.id, compProblem.id);
    }
};
