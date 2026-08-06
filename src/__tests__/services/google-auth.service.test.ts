import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockPrismaUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};
jest.unstable_mockModule('../../lib/prisma.ts', () => ({
    prisma: { user: mockPrismaUser },
}));

const mockJwtUtil = {
    generateToken: jest.fn(),
};
jest.unstable_mockModule('../../utils/jwt.utils.ts', () => ({
    JwtUtil: mockJwtUtil,
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
let GoogleAuthService: any;

beforeAll(async () => {
    const mod = await import('../../services/google-auth.service.ts');
    GoogleAuthService = mod.GoogleAuthService;
});

beforeEach(() => jest.clearAllMocks());

// ===========================================================================
// TESTS
// ===========================================================================

describe('GoogleAuthService', () => {
    const googleProfile = {
        id: 'google-123',
        email: 'carol@gmail.com',
        name: 'Carol',
        picture: 'https://photo.url',
    };

    // -----------------------------------------------------------------------
    // findOrCreateUser
    // -----------------------------------------------------------------------
    describe('findOrCreateUser', () => {
        it('should create a new user when none exists', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null);
            const newUser = { id: 'u-10', email: googleProfile.email, googleId: googleProfile.id };
            mockPrismaUser.create.mockResolvedValue(newUser);

            const result = await GoogleAuthService.findOrCreateUser(googleProfile, 'org-1');

            expect(mockPrismaUser.create).toHaveBeenCalledTimes(1);
            expect(result).toEqual(newUser);
        });

        it('should link Google ID to existing user that has no googleId', async () => {
            const existingUser = { id: 'u-11', email: googleProfile.email, googleId: null, organizationId: null };
            mockPrismaUser.findUnique.mockResolvedValue(existingUser);
            const updatedUser = { ...existingUser, googleId: googleProfile.id, organizationId: 'org-1' };
            mockPrismaUser.update.mockResolvedValue(updatedUser);

            const result = await GoogleAuthService.findOrCreateUser(googleProfile, 'org-1');

            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'u-11' },
                data: { googleId: googleProfile.id, organizationId: 'org-1' },
            });
            expect(result).toEqual(updatedUser);
        });

        it('should update organizationId if user has googleId but no org', async () => {
            const existingUser = { id: 'u-12', email: googleProfile.email, googleId: 'google-123', organizationId: null };
            mockPrismaUser.findUnique.mockResolvedValue(existingUser);
            const updatedUser = { ...existingUser, organizationId: 'org-2' };
            mockPrismaUser.update.mockResolvedValue(updatedUser);

            const result = await GoogleAuthService.findOrCreateUser(googleProfile, 'org-2');

            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'u-12' },
                data: { organizationId: 'org-2' },
            });
            expect(result).toEqual(updatedUser);
        });

        it('should return existing user as-is when fully linked', async () => {
            const existingUser = { id: 'u-13', googleId: 'google-123', organizationId: 'org-1' };
            mockPrismaUser.findUnique.mockResolvedValue(existingUser);

            const result = await GoogleAuthService.findOrCreateUser(googleProfile);

            expect(mockPrismaUser.create).not.toHaveBeenCalled();
            expect(mockPrismaUser.update).not.toHaveBeenCalled();
            expect(result).toEqual(existingUser);
        });
    });

    // -----------------------------------------------------------------------
    // generateTokens
    // -----------------------------------------------------------------------
    describe('generateTokens', () => {
        it('should generate access and refresh tokens and save refresh token', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({
                id: 'u-10', organizationId: 'org-1', role: 'USER',
            });
            mockJwtUtil.generateToken
                .mockReturnValueOnce('google-at')
                .mockReturnValueOnce('google-rt');
            mockPrismaUser.update.mockResolvedValue({});

            const result = await GoogleAuthService.generateTokens('u-10');

            expect(result).toEqual({ accessToken: 'google-at', refreshToken: 'google-rt' });
            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'u-10' },
                data: { refreshToken: 'google-rt' },
            });
        });
    });

    // -----------------------------------------------------------------------
    // getUserByGoogleId
    // -----------------------------------------------------------------------
    describe('getUserByGoogleId', () => {
        it('should return the user matching the given googleId', async () => {
            const user = { id: 'u-14', googleId: 'g-999' };
            mockPrismaUser.findUnique.mockResolvedValue(user);

            const result = await GoogleAuthService.getUserByGoogleId('g-999');
            expect(result).toEqual(user);
            expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-999' } });
        });

        it('should return null when no user has that googleId', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null);

            const result = await GoogleAuthService.getUserByGoogleId('nonexistent');
            expect(result).toBeNull();
        });
    });
});
