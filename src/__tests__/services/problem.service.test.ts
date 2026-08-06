import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockProblemRepo = {
    createProblemWithLanguages: jest.fn(),
    findProblemById: jest.fn(),
    findProblemByTitleExact: jest.fn(),
    findProblemsByTitleFuzzy: jest.fn(),
};
jest.unstable_mockModule('../../repository/problem.repository.ts', () => ({
    ProblemRepository: mockProblemRepo,
}));

const mockPrismaProblem = {
    findMany: jest.fn(),
};
jest.unstable_mockModule('../../lib/prisma.ts', () => ({
    prisma: { problem: mockPrismaProblem },
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let createNewProblem: any;
let getProblemById: any;
let searchProblemsByTitle: any;
let getAllProblems: any;

beforeAll(async () => {
    const mod = await import('../../services/problem.service.ts');
    createNewProblem = mod.createNewProblem;
    getProblemById = mod.getProblemById;
    searchProblemsByTitle = mod.searchProblemsByTitle;
    getAllProblems = mod.getAllProblems;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('ProblemService', () => {
    // -----------------------------------------------------------------------
    // createNewProblem
    // -----------------------------------------------------------------------
    describe('createNewProblem', () => {
        it('should create a problem with a slugified ID', async () => {
            const input = {
                title: 'Two Sum',
                description: 'Find two numbers...',
                languageConfigs: [{ language: 'javascript' }],
            };
            const created = { id: 'two-sum', ...input };
            mockProblemRepo.createProblemWithLanguages.mockResolvedValue(created);

            const result = await createNewProblem(input);

            expect(mockProblemRepo.createProblemWithLanguages).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'two-sum' }),
                input.languageConfigs,
            );
            expect(result).toEqual(created);
        });

        it('should throw when title is missing', async () => {
            await expect(createNewProblem({ description: 'desc', languageConfigs: [{}] }))
                .rejects.toThrow('Title and description are required.');
        });

        it('should throw when description is missing', async () => {
            await expect(createNewProblem({ title: 'T', languageConfigs: [{}] }))
                .rejects.toThrow('Title and description are required.');
        });

        it('should throw when languageConfigs is empty', async () => {
            await expect(createNewProblem({ title: 'T', description: 'D', languageConfigs: [] }))
                .rejects.toThrow('A problem must have at least one language configuration.');
        });

        it('should throw when languageConfigs is missing', async () => {
            await expect(createNewProblem({ title: 'T', description: 'D' }))
                .rejects.toThrow('A problem must have at least one language configuration.');
        });
    });

    // -----------------------------------------------------------------------
    // getProblemById
    // -----------------------------------------------------------------------
    describe('getProblemById', () => {
        it('should return the problem when found', async () => {
            const problem = { id: 'two-sum', title: 'Two Sum' };
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await getProblemById('two-sum');
            expect(result).toEqual(problem);
        });

        it('should throw when problem is not found', async () => {
            mockProblemRepo.findProblemById.mockResolvedValue(null);

            await expect(getProblemById('nonexistent')).rejects.toThrow('Problem not found.');
        });

        it('should throw when problemId is empty', async () => {
            await expect(getProblemById('')).rejects.toThrow('Problem ID is required.');
        });
    });

    // -----------------------------------------------------------------------
    // searchProblemsByTitle
    // -----------------------------------------------------------------------
    describe('searchProblemsByTitle', () => {
        it('should return exact match when found', async () => {
            const exactResult = { id: 'two-sum', title: 'two sum', difficulty: 'Easy', similarityScore: 1 };
            mockProblemRepo.findProblemByTitleExact.mockResolvedValue(exactResult);

            const result = await searchProblemsByTitle('Two Sum');

            expect(result.matchType).toBe('exact');
            expect(result.results).toEqual([exactResult]);
        });

        it('should fall back to fuzzy search when no exact match', async () => {
            mockProblemRepo.findProblemByTitleExact.mockResolvedValue(null);
            const fuzzyResults = [
                { id: 'two-sum', title: 'Two Sum', difficulty: 'Easy', similarityScore: 0.8 },
                { id: 'three-sum', title: 'Three Sum', difficulty: 'Medium', similarityScore: 0.5 },
            ];
            mockProblemRepo.findProblemsByTitleFuzzy.mockResolvedValue(fuzzyResults);

            const result = await searchProblemsByTitle('Two');

            expect(result.matchType).toBe('fuzzy');
            expect(result.results).toHaveLength(2);
        });

        it('should filter fuzzy results below the threshold', async () => {
            mockProblemRepo.findProblemByTitleExact.mockResolvedValue(null);
            // Return one above threshold and one below
            const fuzzyResults = [
                { id: 'a', title: 'A', difficulty: 'Easy', similarityScore: 0.5 },
                { id: 'b', title: 'B', difficulty: 'Easy', similarityScore: 0.2 },
            ];
            mockProblemRepo.findProblemsByTitleFuzzy.mockResolvedValue(fuzzyResults);

            const result = await searchProblemsByTitle('Something');

            // 0.2 is below 0.35 threshold so should be filtered out
            expect(result.results).toHaveLength(1);
            expect(result.results[0].id).toBe('a');
        });

        it('should throw when query is empty', async () => {
            await expect(searchProblemsByTitle('')).rejects.toThrow('Search query is required.');
        });
    });

    // -----------------------------------------------------------------------
    // getAllProblems
    // -----------------------------------------------------------------------
    describe('getAllProblems', () => {
        it('should return all problems', async () => {
            const problems = [{ id: 'p1' }, { id: 'p2' }];
            mockPrismaProblem.findMany.mockResolvedValue(problems);

            const result = await getAllProblems();
            expect(result).toEqual(problems);
        });

        it('should throw when no problems exist', async () => {
            mockPrismaProblem.findMany.mockResolvedValue([]);

            await expect(getAllProblems()).rejects.toThrow('No problems found in the database.');
        });
    });
});
