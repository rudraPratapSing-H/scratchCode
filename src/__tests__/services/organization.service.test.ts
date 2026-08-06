import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock the OrganizationRepository
// ---------------------------------------------------------------------------
const mockOrgRepo = {
    findOrganizationByName: jest.fn(),
    createOrganization: jest.fn(),
};
jest.unstable_mockModule('../../repository/organization.repository.ts', () => ({
    OrganizationRepository: mockOrgRepo,
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let OrganizationService: any;

beforeAll(async () => {
    const mod = await import('../../services/organization.service.ts');
    OrganizationService = mod.OrganizationService;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('OrganizationService', () => {
    describe('createOrganization', () => {
        it('should create an organization with a trimmed name', async () => {
            mockOrgRepo.findOrganizationByName.mockResolvedValue(null);
            const created = { id: 'org-1', name: 'Acme Corp' };
            mockOrgRepo.createOrganization.mockResolvedValue(created);

            const result = await OrganizationService.createOrganization('  Acme Corp  ');

            expect(mockOrgRepo.findOrganizationByName).toHaveBeenCalledWith('Acme Corp');
            expect(mockOrgRepo.createOrganization).toHaveBeenCalledWith('Acme Corp');
            expect(result).toEqual(created);
        });

        it('should throw when name is empty', async () => {
            await expect(OrganizationService.createOrganization(''))
                .rejects.toThrow('Organization name is required.');
        });

        it('should throw when name is only whitespace', async () => {
            await expect(OrganizationService.createOrganization('   '))
                .rejects.toThrow('Organization name is required.');
        });

        it('should throw when name is null/undefined', async () => {
            await expect(OrganizationService.createOrganization(null))
                .rejects.toThrow('Organization name is required.');
        });

        it('should throw when organization name already exists', async () => {
            mockOrgRepo.findOrganizationByName.mockResolvedValue({ id: 'org-existing', name: 'Duplicate' });

            await expect(OrganizationService.createOrganization('Duplicate'))
                .rejects.toThrow('An organization with this name already exists.');
        });
    });
});
