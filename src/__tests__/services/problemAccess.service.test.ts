import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockUserRepo = {
    findUserById: jest.fn(),
};
jest.unstable_mockModule('../../repository/users.repository.ts', () => ({
    UserRepository: mockUserRepo,
}));

const mockProblemRepo = {
    findProblemById: jest.fn(),
};
jest.unstable_mockModule('../../repository/problem.repository.ts', () => ({
    ProblemRepository: mockProblemRepo,
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let ProblemAccessService: any;

beforeAll(async () => {
    const mod = await import('../../services/problemAccess.service.ts');
    ProblemAccessService = mod.ProblemAccessService;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// Helpers
// ===========================================================================
const adminUser = { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' };
const regularUser = { id: 'user-1', role: 'USER', organizationId: 'org-1' };
const adminNoOrg = { id: 'admin-2', role: 'ADMIN', organizationId: null };
const problem = { id: 'p-1', organizationId: 'org-1' };
const otherOrgProblem = { id: 'p-2', organizationId: 'org-other' };

// ===========================================================================
// TESTS
// ===========================================================================

describe('ProblemAccessService', () => {
    // -----------------------------------------------------------------------
    // CREATE action
    // -----------------------------------------------------------------------
    describe('create action', () => {
        it('should allow admin to create problems for their organization', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'create', undefined, 'org-1'
            );
            expect(result).toEqual({ allowed: true });
        });

        it('should deny non-admin users from creating problems', async () => {
            mockUserRepo.findUserById.mockResolvedValue(regularUser);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'user-1', 'create', undefined, 'org-1'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should deny admin without organization', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminNoOrg);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-2', 'create', undefined, 'org-1'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should deny admin creating for a different organization', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'create', undefined, 'org-other'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should deny when organizationId is not provided for create', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'create', undefined, null
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // READ action
    // -----------------------------------------------------------------------
    describe('read action', () => {
        it('should allow regular USER to read any problem', async () => {
            mockUserRepo.findUserById.mockResolvedValue(regularUser);
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'user-1', 'read', 'p-1'
            );
            expect(result).toEqual({ allowed: true });
        });

        it('should allow admin to read own org problem', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'read', 'p-1'
            );
            expect(result).toEqual({ allowed: true });
        });

        it('should deny admin reading problems from another org', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);
            mockProblemRepo.findProblemById.mockResolvedValue(otherOrgProblem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'read', 'p-2'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should return 404 when user not found', async () => {
            mockUserRepo.findUserById.mockResolvedValue(null);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'ghost', 'read', 'p-1'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(404);
        });

        it('should return 404 when problem not found', async () => {
            mockUserRepo.findUserById.mockResolvedValue(regularUser);
            mockProblemRepo.findProblemById.mockResolvedValue(null);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'user-1', 'read', 'nonexistent'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(404);
        });

        it('should return 400 when problemId is missing for read', async () => {
            mockUserRepo.findUserById.mockResolvedValue(regularUser);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'user-1', 'read'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // UPDATE / DELETE actions
    // -----------------------------------------------------------------------
    describe('update/delete actions', () => {
        it('should allow admin to update their own org problem', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'update', 'p-1'
            );
            expect(result).toEqual({ allowed: true });
        });

        it('should deny non-admin from updating', async () => {
            mockUserRepo.findUserById.mockResolvedValue(regularUser);
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'user-1', 'update', 'p-1'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should deny admin modifying problems from another org', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminUser);
            mockProblemRepo.findProblemById.mockResolvedValue(otherOrgProblem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-1', 'delete', 'p-2'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });

        it('should deny admin without organization from modifying', async () => {
            mockUserRepo.findUserById.mockResolvedValue(adminNoOrg);
            mockProblemRepo.findProblemById.mockResolvedValue(problem);

            const result = await ProblemAccessService.canUserPerformProblemAction(
                'admin-2', 'update', 'p-1'
            );
            expect(result.allowed).toBe(false);
            expect(result.statusCode).toBe(403);
        });
    });
});
