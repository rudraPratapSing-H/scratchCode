import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { AuthService } from '../../services/auth.services.ts';

// ---------------------------------------------------------------------------
// Mock every external dependency that AuthService touches
// ---------------------------------------------------------------------------

// 1. Prisma
const mockPrismaUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};
jest.unstable_mockModule('../../lib/prisma.ts', () => ({
    prisma: { user: mockPrismaUser },
}));

// 2. HashUtil
const mockHashUtil = {
    hashPassword: jest.fn(),
    compare: jest.fn(),
};
jest.unstable_mockModule('../../utils/hash.util.ts', () => ({
    HashUtil: mockHashUtil,
}));

// 3. JwtUtil
const mockJwtUtil = {
    generateToken: jest.fn(),
    verifyToken: jest.fn(),
};
jest.unstable_mockModule('../../utils/jwt.utils.ts', () => ({
    JwtUtil: mockJwtUtil,
}));

// 4. Redis
const mockRedisClient = {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    connect: jest.fn(),
};
jest.unstable_mockModule('../../config/redis.ts', () => ({
    redisClient: mockRedisClient,
}));

// 5. EmailUtil
const mockEmailUtil = {
    generateOTP: jest.fn(),
    sendOTPEmail: jest.fn(),
};
jest.unstable_mockModule('../../utils/email.util.ts', () => ({
    EmailUtil: mockEmailUtil,
}));

// ---------------------------------------------------------------------------
// Dynamic import so mocks are in place before the module loads
// ---------------------------------------------------------------------------
let AuthServiceMod: typeof AuthService;

beforeAll(async () => {
    const mod = await import('../../services/auth.services.ts');
    AuthServiceMod = mod.AuthService;
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('AuthService', () => {
    // -----------------------------------------------------------------------
    // registerUser
    // -----------------------------------------------------------------------
    describe('registerUser', () => {
        const registrationData = {
            email: 'alice@example.com',
            username: 'alice',
            password: 'secureP@ss1',
            organizationId: 'org-1',
            role: 'USER',
        };

        it('should register a new user and return tokens', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null); // no existing user
            mockHashUtil.hashPassword.mockResolvedValue({ hash: 'hashed-pw', salt: 'salt-1' });

            const createdUser = {
                id: 'u-1', email: registrationData.email, username: 'alice',
                organizationId: 'org-1', role: 'USER',
            };
            mockPrismaUser.create.mockResolvedValue(createdUser);
            mockJwtUtil.generateToken
                .mockReturnValueOnce('access-token-123')
                .mockReturnValueOnce('refresh-token-456');
            mockPrismaUser.update.mockResolvedValue({ ...createdUser, refreshToken: 'refresh-token-456' });

            const result = await AuthServiceMod.registerUser(registrationData);

            expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({ where: { email: registrationData.email } });
            expect(mockHashUtil.hashPassword).toHaveBeenCalledWith(registrationData.password);
            expect(mockPrismaUser.create).toHaveBeenCalledTimes(1);
            expect(mockJwtUtil.generateToken).toHaveBeenCalledTimes(2);
            expect(result.accessToken).toBe('access-token-123');
            expect(result.refreshToken).toBe('refresh-token-456');
            expect(result.user).toEqual(createdUser);
        });

        it('should throw if the email is already taken', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({ id: 'existing-user' });

            await expect(AuthServiceMod.registerUser(registrationData))
                .rejects.toThrow('Email already taken.');
        });
    });

    // -----------------------------------------------------------------------
    // loginUser
    // -----------------------------------------------------------------------
    describe('loginUser', () => {
        it('should return tokens on valid credentials', async () => {
            const storedUser = {
                id: 'u-2', email: 'bob@test.com', password: 'hashed',
                organizationId: 'org-1', role: 'USER',
            };
            mockPrismaUser.findUnique.mockResolvedValue(storedUser);
            mockHashUtil.compare.mockResolvedValue(true);
            mockJwtUtil.generateToken
                .mockReturnValueOnce('at')
                .mockReturnValueOnce('rt');
            mockPrismaUser.update.mockResolvedValue({ ...storedUser, refreshToken: 'rt' });

            const result = await AuthServiceMod.loginUser('bob@test.com', 'password');

            expect(result.accessToken).toBe('at');
            expect(result.refreshToken).toBe('rt');
        });

        it('should throw on non-existent email', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null);

            await expect(AuthServiceMod.loginUser('no@one.com', 'pw'))
                .rejects.toThrow('Invalid credentials.');
        });

        it('should throw on wrong password', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({ id: 'u-3', password: 'hashed' });
            mockHashUtil.compare.mockResolvedValue(false);

            await expect(AuthServiceMod.loginUser('bob@test.com', 'wrong'))
                .rejects.toThrow('Invalid credentials.');
        });
    });

    // -----------------------------------------------------------------------
    // getUserById
    // -----------------------------------------------------------------------
    describe('getUserById', () => {
        it('should return the user from prisma', async () => {
            const user = { id: 'u-4', email: 'x@y.com' };
            mockPrismaUser.findUnique.mockResolvedValue(user);

            const result = await AuthServiceMod.getUserById('u-4');
            expect(result).toEqual(user);
            expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({ where: { id: 'u-4' } });
        });
    });

    // -----------------------------------------------------------------------
    // refreshSession
    // -----------------------------------------------------------------------
    describe('refreshSession', () => {
        it('should return cached tokens during the grace period', async () => {
            mockRedisClient.get.mockResolvedValue('new-refresh-token');
            mockJwtUtil.verifyToken.mockReturnValue({ userId: 'u-5', organizationId: 'org-1', role: 'USER' });
            mockJwtUtil.generateToken.mockReturnValue('new-access-token');

            const result = await AuthServiceMod.refreshSession('old-refresh-token', true);

            expect(result.refreshToken).toBe('new-refresh-token');
            expect(result.accessToken).toBe('new-access-token');
            // Should NOT have touched the database
            expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
        });

        it('should rotate tokens on standard flow with shouldRotate=true', async () => {
            mockRedisClient.get.mockResolvedValue(null); // no grace period
            mockJwtUtil.verifyToken.mockReturnValue({ userId: 'u-5' });
            mockPrismaUser.findUnique.mockResolvedValue({
                id: 'u-5', refreshToken: 'old-rt', organizationId: 'org-1', role: 'USER',
            });
            mockJwtUtil.generateToken
                .mockReturnValueOnce('new-at')
                .mockReturnValueOnce('new-rt');
            mockPrismaUser.update.mockResolvedValue({});
            mockRedisClient.setEx.mockResolvedValue('OK');

            const result = await AuthServiceMod.refreshSession('old-rt', true);

            expect(result.accessToken).toBe('new-at');
            expect(result.refreshToken).toBe('new-rt');
            expect(mockRedisClient.setEx).toHaveBeenCalledWith('grace:old-rt', 30, 'new-rt');
        });

        it('should NOT rotate refresh token when shouldRotate=false', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            mockJwtUtil.verifyToken.mockReturnValue({ userId: 'u-5' });
            mockPrismaUser.findUnique.mockResolvedValue({
                id: 'u-5', refreshToken: 'same-rt', organizationId: 'org-1', role: 'USER',
            });
            mockJwtUtil.generateToken.mockReturnValueOnce('new-at');

            const result = await AuthServiceMod.refreshSession('same-rt', false);

            expect(result.refreshToken).toBe('same-rt');
            expect(mockRedisClient.setEx).not.toHaveBeenCalled();
        });

        it('should throw on token mismatch (replay attack)', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            mockJwtUtil.verifyToken.mockReturnValue({ userId: 'u-5' });
            mockPrismaUser.findUnique.mockResolvedValue({
                id: 'u-5', refreshToken: 'different-token',
            });

            await expect(AuthServiceMod.refreshSession('stale-rt', false))
                .rejects.toThrow('Refresh token mismatch');
        });

        it('should throw on invalid (unverifiable) refresh token', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            mockJwtUtil.verifyToken.mockReturnValue(null);

            await expect(AuthServiceMod.refreshSession('garbage', true))
                .rejects.toThrow('Invalid refresh token.');
        });
    });
});
