import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockCompRepo = {
    getCompetitionWithProblems: jest.fn(),
    getAllCompetitionTitlesAndIds: jest.fn(),
    createCompetition: jest.fn(),
    linkProblemsToCompetition: jest.fn(),
    findCompetitionById: jest.fn(),
    findParticipantByCompetitionAndUser: jest.fn(),
    createParticipant: jest.fn(),
    incrementCheatingAttempts: jest.fn(),
    getCompetitionLeaderboard: jest.fn(),
    findCompetitionProblem: jest.fn(),
    updateCompetitionLog: jest.fn(),
    updateParticipantTotalScore: jest.fn(),
    getLogsForParticipant: jest.fn(),
    startProblemTimer: jest.fn(),
    pauseProblemTimer: jest.fn(),
    finishCompetitionParticipant: jest.fn(),
    getCompetitionParticipantsForAdmin: jest.fn(),
    getParticipantDetailForAdmin: jest.fn(),
};
jest.unstable_mockModule('../../repository/competition.repository.ts', () => ({
    CompetitionRepository: mockCompRepo,
}));

const mockProblemRepo = {
    findProblemIdsByIds: jest.fn(),
};
jest.unstable_mockModule('../../repository/problem.repository.ts', () => ({
    ProblemRepository: mockProblemRepo,
}));

const mockUserRepo = {
    findUserById: jest.fn(),
};
jest.unstable_mockModule('../../repository/users.repository.ts', () => ({
    UserRepository: mockUserRepo,
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let CompetitionService: any;

beforeAll(async () => {
    const mod = await import('../../services/competition.service.ts');
    CompetitionService = mod.CompetitionService;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('CompetitionService', () => {
    // -----------------------------------------------------------------------
    // getCompetitionProblemTitles
    // -----------------------------------------------------------------------
    describe('getCompetitionProblemTitles', () => {
        it('should return competition info with problem titles', async () => {
            mockCompRepo.getCompetitionWithProblems.mockResolvedValue({
                description: 'A contest',
                startTime: '2026-01-01',
                endTime: '2026-01-02',
                fullScreenMandatory: true,
                problems: [
                    { problem: { id: 'p1', title: 'Two Sum' }, score: 100 },
                ],
            });

            const result = await CompetitionService.getCompetitionProblemTitles('comp-1');

            expect(result.description).toBe('A contest');
            expect(result.problems).toEqual([{ id: 'p1', title: 'Two Sum', score: 100 }]);
        });

        it('should throw when competitionId is empty', async () => {
            await expect(CompetitionService.getCompetitionProblemTitles(''))
                .rejects.toThrow('competitionId is required');
        });

        it('should throw when competition is not found', async () => {
            mockCompRepo.getCompetitionWithProblems.mockResolvedValue(null);

            await expect(CompetitionService.getCompetitionProblemTitles('nonexistent'))
                .rejects.toThrow('Competition not found');
        });
    });

    // -----------------------------------------------------------------------
    // getAllCompetitionTitlesAndIds
    // -----------------------------------------------------------------------
    describe('getAllCompetitionTitlesAndIds', () => {
        it('should return titles and ids for the given org', async () => {
            const data = [{ id: 'c1', title: 'Contest A' }];
            mockCompRepo.getAllCompetitionTitlesAndIds.mockResolvedValue(data);

            const result = await CompetitionService.getAllCompetitionTitlesAndIds('org-1');
            expect(result).toEqual(data);
        });

        it('should throw when organizationId is empty', async () => {
            await expect(CompetitionService.getAllCompetitionTitlesAndIds(''))
                .rejects.toThrow('organizationId is required');
        });
    });

    // -----------------------------------------------------------------------
    // createCompetition
    // -----------------------------------------------------------------------
    describe('createCompetition', () => {
        const validData = {
            title: 'Spring Contest',
            startTime: '2026-06-01T00:00:00Z',
            endTime: '2026-06-02T00:00:00Z',
            problems: [{ problemId: 'p1', score: 100 }],
            organizationId: 'org-1',
        };

        it('should create a competition and link problems', async () => {
            mockProblemRepo.findProblemIdsByIds.mockResolvedValue(['p1']);
            mockCompRepo.createCompetition.mockResolvedValue({ id: 'comp-new', title: 'Spring Contest' });
            mockCompRepo.linkProblemsToCompetition.mockResolvedValue(undefined);

            const result = await CompetitionService.createCompetition(validData);

            expect(result.id).toBe('comp-new');
            expect(mockCompRepo.linkProblemsToCompetition).toHaveBeenCalledWith('comp-new', [
                { problemId: 'p1', score: 100 },
            ]);
        });

        it('should throw when title is missing', async () => {
            await expect(CompetitionService.createCompetition({ ...validData, title: '' }))
                .rejects.toThrow('title, startTime and endTime are required');
        });

        it('should throw on invalid date strings', async () => {
            await expect(CompetitionService.createCompetition({ ...validData, startTime: 'not-a-date' }))
                .rejects.toThrow('Invalid startTime or endTime');
        });

        it('should throw when a problemId does not exist', async () => {
            mockProblemRepo.findProblemIdsByIds.mockResolvedValue([]); // none found

            await expect(CompetitionService.createCompetition(validData))
                .rejects.toThrow('One or more problemIds are invalid');
        });
    });

    // -----------------------------------------------------------------------
    // registerParticipant
    // -----------------------------------------------------------------------
    describe('registerParticipant', () => {
        it('should register a new participant', async () => {
            mockCompRepo.findCompetitionById.mockResolvedValue({
                id: 'comp-1', fullScreenMandatory: true, startTime: 'st', endTime: 'et',
            });
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);
            mockCompRepo.createParticipant.mockResolvedValue({ id: 'part-1' });

            const result = await CompetitionService.registerParticipant('comp-1', 'u-1');

            expect(result.alreadyRegistered).toBe(false);
            expect(result.participant.id).toBe('part-1');
        });

        it('should return existing participant if already registered', async () => {
            mockCompRepo.findCompetitionById.mockResolvedValue({
                id: 'comp-1', fullScreenMandatory: false, startTime: 'st', endTime: 'et',
            });
            const existing = { id: 'part-1', finished: false };
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(existing);

            const result = await CompetitionService.registerParticipant('comp-1', 'u-1');

            expect(result.alreadyRegistered).toBe(true);
            expect(mockCompRepo.createParticipant).not.toHaveBeenCalled();
        });

        it('should throw when competition not found', async () => {
            mockCompRepo.findCompetitionById.mockResolvedValue(null);

            await expect(CompetitionService.registerParticipant('bad', 'u-1'))
                .rejects.toThrow('Competition not found');
        });

        it('should throw when userId is empty', async () => {
            await expect(CompetitionService.registerParticipant('comp-1', ''))
                .rejects.toThrow('Unauthorized');
        });
    });

    // -----------------------------------------------------------------------
    // logCheatingAttempt
    // -----------------------------------------------------------------------
    describe('logCheatingAttempt', () => {
        it('should increment cheating attempts for a participant', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.incrementCheatingAttempts.mockResolvedValue({ cheatingAttempts: 2 });

            const result = await CompetitionService.logCheatingAttempt('comp-1', 'u-1');
            expect(result.cheatingAttempts).toBe(2);
        });

        it('should throw when participant not found', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);

            await expect(CompetitionService.logCheatingAttempt('comp-1', 'u-1'))
                .rejects.toThrow('Participant not found');
        });
    });

    // -----------------------------------------------------------------------
    // getLeaderboard
    // -----------------------------------------------------------------------
    describe('getLeaderboard', () => {
        it('should return leaderboard data', async () => {
            mockCompRepo.findCompetitionById.mockResolvedValue({ id: 'comp-1' });
            const leaderboard = [{ userId: 'u-1', totalScore: 300 }];
            mockCompRepo.getCompetitionLeaderboard.mockResolvedValue(leaderboard);

            const result = await CompetitionService.getLeaderboard('comp-1');
            expect(result).toEqual(leaderboard);
        });

        it('should throw when competition not found', async () => {
            mockCompRepo.findCompetitionById.mockResolvedValue(null);

            await expect(CompetitionService.getLeaderboard('bad'))
                .rejects.toThrow('Competition not found');
        });
    });

    // -----------------------------------------------------------------------
    // updateCompetitionLogForSubmission
    // -----------------------------------------------------------------------
    describe('updateCompetitionLogForSubmission', () => {
        it('should update log with score on Accepted submission', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.findCompetitionProblem.mockResolvedValue({ id: 'cp-1', score: 100 });
            mockCompRepo.updateCompetitionLog.mockResolvedValue({});
            mockCompRepo.updateParticipantTotalScore.mockResolvedValue({});

            await CompetitionService.updateCompetitionLogForSubmission(
                'comp-1', 'p-1', 'u-1', 'Accepted', 'sub-1'
            );

            expect(mockCompRepo.updateCompetitionLog).toHaveBeenCalledWith(
                'part-1', 'cp-1', 'Accepted', 100, 'sub-1'
            );
            expect(mockCompRepo.updateParticipantTotalScore).toHaveBeenCalledWith('part-1');
        });

        it('should set score to 0 on non-Accepted submission', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.findCompetitionProblem.mockResolvedValue({ id: 'cp-1', score: 100 });
            mockCompRepo.updateCompetitionLog.mockResolvedValue({});
            mockCompRepo.updateParticipantTotalScore.mockResolvedValue({});

            await CompetitionService.updateCompetitionLogForSubmission(
                'comp-1', 'p-1', 'u-1', 'Wrong Answer', 'sub-2'
            );

            expect(mockCompRepo.updateCompetitionLog).toHaveBeenCalledWith(
                'part-1', 'cp-1', 'Wrong Answer', 0, 'sub-2'
            );
        });

        it('should silently return when participant or problem not found', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);
            mockCompRepo.findCompetitionProblem.mockResolvedValue(null);

            await CompetitionService.updateCompetitionLogForSubmission(
                'comp-1', 'p-1', 'u-1', 'Accepted', 'sub-1'
            );

            expect(mockCompRepo.updateCompetitionLog).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // getParticipantLogs
    // -----------------------------------------------------------------------
    describe('getParticipantLogs', () => {
        it('should return mapped logs', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.getLogsForParticipant.mockResolvedValue([
                {
                    status: 'Accepted', score: 100, timeTaken: 120, lastStartedAt: null,
                    problem: { problemId: 'p-1', score: 100, problem: { title: 'Two Sum' } },
                },
            ]);

            const result = await CompetitionService.getParticipantLogs('comp-1', 'u-1');

            expect(result).toEqual([{
                problemId: 'p-1', title: 'Two Sum', status: 'Accepted',
                score: 100, maxScore: 100, timeTaken: 120, lastStartedAt: null,
            }]);
        });

        it('should throw when participant not found', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);

            await expect(CompetitionService.getParticipantLogs('comp-1', 'u-1'))
                .rejects.toThrow('Participant not found');
        });
    });

    // -----------------------------------------------------------------------
    // startProblemTimer / pauseProblemTimer
    // -----------------------------------------------------------------------
    describe('startProblemTimer', () => {
        it('should call the repository startProblemTimer', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.findCompetitionProblem.mockResolvedValue({ id: 'cp-1' });
            mockCompRepo.startProblemTimer.mockResolvedValue({});

            await CompetitionService.startProblemTimer('comp-1', 'p-1', 'u-1');

            expect(mockCompRepo.startProblemTimer).toHaveBeenCalledWith('part-1', 'cp-1');
        });

        it('should throw when participant or problem not found', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);
            mockCompRepo.findCompetitionProblem.mockResolvedValue(null);

            await expect(CompetitionService.startProblemTimer('comp-1', 'p-1', 'u-1'))
                .rejects.toThrow('Participant or CompetitionProblem not found');
        });
    });

    describe('pauseProblemTimer', () => {
        it('should call the repository pauseProblemTimer', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.findCompetitionProblem.mockResolvedValue({ id: 'cp-1' });
            mockCompRepo.pauseProblemTimer.mockResolvedValue({});

            await CompetitionService.pauseProblemTimer('comp-1', 'p-1', 'u-1');

            expect(mockCompRepo.pauseProblemTimer).toHaveBeenCalledWith('part-1', 'cp-1');
        });
    });

    // -----------------------------------------------------------------------
    // finishCompetition
    // -----------------------------------------------------------------------
    describe('finishCompetition', () => {
        it('should finish competition for participant', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue({ id: 'part-1' });
            mockCompRepo.finishCompetitionParticipant.mockResolvedValue({ finished: true });

            const result = await CompetitionService.finishCompetition('comp-1', 'u-1');
            expect(result.finished).toBe(true);
        });

        it('should throw when participant not found', async () => {
            mockCompRepo.findParticipantByCompetitionAndUser.mockResolvedValue(null);

            await expect(CompetitionService.finishCompetition('comp-1', 'u-1'))
                .rejects.toThrow('Participant not found');
        });
    });

    // -----------------------------------------------------------------------
    // checkAdminAccess
    // -----------------------------------------------------------------------
    describe('checkAdminAccess', () => {
        it('should return isAdmin=true for admin users', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-1', role: 'ADMIN' });

            const result = await CompetitionService.checkAdminAccess('u-1');
            expect(result.isAdmin).toBe(true);
        });

        it('should return isAdmin=false for non-admin users', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-2', role: 'USER' });

            const result = await CompetitionService.checkAdminAccess('u-2');
            expect(result.isAdmin).toBe(false);
        });

        it('should throw when user not found', async () => {
            mockUserRepo.findUserById.mockResolvedValue(null);

            await expect(CompetitionService.checkAdminAccess('ghost'))
                .rejects.toThrow('User not found');
        });
    });

    // -----------------------------------------------------------------------
    // getAdminParticipants
    // -----------------------------------------------------------------------
    describe('getAdminParticipants', () => {
        it('should return participants for admin users', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-1', role: 'ADMIN' });
            mockCompRepo.findCompetitionById.mockResolvedValue({ id: 'comp-1' });
            const participants = [{ id: 'part-1' }];
            mockCompRepo.getCompetitionParticipantsForAdmin.mockResolvedValue(participants);

            const result = await CompetitionService.getAdminParticipants('comp-1', 'u-1');
            expect(result).toEqual(participants);
        });

        it('should throw for non-admin users', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-2', role: 'USER' });

            await expect(CompetitionService.getAdminParticipants('comp-1', 'u-2'))
                .rejects.toThrow('Forbidden');
        });
    });

    // -----------------------------------------------------------------------
    // getAdminParticipantDetail
    // -----------------------------------------------------------------------
    describe('getAdminParticipantDetail', () => {
        it('should return participant detail for admin', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-1', role: 'ADMIN' });
            const detail = { userId: 'u-5', username: 'test' };
            mockCompRepo.getParticipantDetailForAdmin.mockResolvedValue(detail);

            const result = await CompetitionService.getAdminParticipantDetail('comp-1', 'part-1', 'u-1');
            expect(result).toEqual(detail);
        });

        it('should throw when participant not found', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-1', role: 'ADMIN' });
            mockCompRepo.getParticipantDetailForAdmin.mockResolvedValue(null);

            await expect(CompetitionService.getAdminParticipantDetail('comp-1', 'part-bad', 'u-1'))
                .rejects.toThrow('Participant not found');
        });

        it('should throw for non-admin', async () => {
            mockUserRepo.findUserById.mockResolvedValue({ id: 'u-2', role: 'USER' });

            await expect(CompetitionService.getAdminParticipantDetail('comp-1', 'part-1', 'u-2'))
                .rejects.toThrow('Forbidden');
        });
    });
});
