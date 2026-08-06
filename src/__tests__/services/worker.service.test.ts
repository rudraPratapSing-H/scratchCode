import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrismaSubmission = {
    findUnique: jest.fn(),
    update: jest.fn(),
};
jest.unstable_mockModule('../../lib/prisma.ts', () => ({
    prisma: { submission: mockPrismaSubmission },
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let WorkerService: any;

beforeAll(async () => {
    const mod = await import('../../services/worker.service.ts');
    WorkerService = mod.WorkerService;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('WorkerService', () => {
    // -----------------------------------------------------------------------
    // getJobDetails
    // -----------------------------------------------------------------------
    describe('getJobDetails', () => {
        it('should return submission and resolved config', async () => {
            const submission = {
                id: 'sub-1',
                language: 'javascript',
                problem: {
                    languageConfigs: [
                        { language: 'JavaScript', memoryLimitMb: 256, timeLimitMs: 5000 },
                        { language: 'Python', memoryLimitMb: 512, timeLimitMs: 10000 },
                    ],
                },
            };
            mockPrismaSubmission.findUnique.mockResolvedValue(submission);

            const result = await WorkerService.getJobDetails('sub-1');

            expect(result.submission).toEqual(submission);
            expect(result.config.memoryLimit).toBe(256);
            expect(result.config.timeLimit).toBe(5000);
        });

        it('should throw when submission is not found', async () => {
            mockPrismaSubmission.findUnique.mockResolvedValue(null);

            await expect(WorkerService.getJobDetails('nonexistent'))
                .rejects.toThrow('Submission not found.');
        });

        it('should throw when no language config matches the submission language', async () => {
            mockPrismaSubmission.findUnique.mockResolvedValue({
                id: 'sub-2',
                language: 'rust',
                problem: { languageConfigs: [{ language: 'JavaScript' }] },
            });

            await expect(WorkerService.getJobDetails('sub-2'))
                .rejects.toThrow('Language configuration missing for rust.');
        });

        it('should throw when memoryLimit is invalid (zero)', async () => {
            mockPrismaSubmission.findUnique.mockResolvedValue({
                id: 'sub-3',
                language: 'python',
                problem: {
                    languageConfigs: [{ language: 'python', memoryLimitMb: 0, timeLimitMs: 5000 }],
                },
            });

            await expect(WorkerService.getJobDetails('sub-3'))
                .rejects.toThrow('Invalid memory limit for python.');
        });

        it('should throw when timeLimit is invalid (NaN)', async () => {
            mockPrismaSubmission.findUnique.mockResolvedValue({
                id: 'sub-4',
                language: 'python',
                problem: {
                    languageConfigs: [{ language: 'python', memoryLimitMb: 256, timeLimitMs: null }],
                },
            });

            await expect(WorkerService.getJobDetails('sub-4'))
                .rejects.toThrow('Invalid time limit for python.');
        });
    });

    // -----------------------------------------------------------------------
    // updateStatus
    // -----------------------------------------------------------------------
    describe('updateStatus', () => {
        it('should update the submission status', async () => {
            mockPrismaSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'Accepted' });

            const result = await WorkerService.updateStatus('sub-1', 'Accepted');

            expect(mockPrismaSubmission.update).toHaveBeenCalledWith({
                where: { id: 'sub-1' },
                data: { status: 'Accepted' },
            });
            expect(result.status).toBe('Accepted');
        });

        it('should merge additional details into the update', async () => {
            const details = { output: 'hello', executionTime: 120 };
            mockPrismaSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'Accepted', ...details });

            await WorkerService.updateStatus('sub-1', 'Accepted', details);

            expect(mockPrismaSubmission.update).toHaveBeenCalledWith({
                where: { id: 'sub-1' },
                data: { status: 'Accepted', ...details },
            });
        });
    });
});
