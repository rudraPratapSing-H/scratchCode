import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrismaProblem = {
    findMany: jest.fn(),
};
jest.unstable_mockModule('../../lib/prisma.ts', () => ({
    prisma: { problem: mockPrismaProblem },
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let fetchProblemTitles: any;

beforeAll(async () => {
    const mod = await import('../../services/fetchProblemTitles.services.ts');
    fetchProblemTitles = mod.fetchProblemTitles;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('fetchProblemTitles', () => {
    it('should return mapped id, title, and difficulty', async () => {
        const dbRows = [
            { id: 'p1', title: 'Two Sum', difficulty: 'Easy' },
            { id: 'p2', title: 'Three Sum', difficulty: 'Medium' },
        ];
        mockPrismaProblem.findMany.mockResolvedValue(dbRows);

        const result = await fetchProblemTitles();

        expect(result).toEqual([
            { id: 'p1', title: 'Two Sum', difficulty: 'Easy' },
            { id: 'p2', title: 'Three Sum', difficulty: 'Medium' },
        ]);
        expect(mockPrismaProblem.findMany).toHaveBeenCalledWith({
            select: { id: true, title: true, difficulty: true },
        });
    });

    it('should return empty array when no problems exist', async () => {
        mockPrismaProblem.findMany.mockResolvedValue([]);

        const result = await fetchProblemTitles();
        expect(result).toEqual([]);
    });
});
