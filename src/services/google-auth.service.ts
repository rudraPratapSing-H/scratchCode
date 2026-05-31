import { prisma } from '../lib/prisma.ts';
import { JwtUtil } from '../utils/jwt.utils.ts';

export const GoogleAuthService = {
    /**
     * Find or create user from Google profile
     */
    async findOrCreateUser(googleProfile: {
        id: string;
        email: string;
        name: string;
        picture?: string;
    }, organizationId?: string | null) {
        let user = await prisma.user.findUnique({
            where: { email: googleProfile.email }
        });

        if (!user) {
            // Create new user from Google profile
            user = await prisma.user.create({
                data: {
                    email: googleProfile.email,
                    username: googleProfile.name || googleProfile.email.split('@')[0],
                    googleId: googleProfile.id,
                    password: '', // Empty for Google users
                    salt: '',
                    organizationId: organizationId ?? null,
                    role: 'USER'
                }
            });
        } else if (!user.googleId) {
            // Link existing user to Google account
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: googleProfile.id,
                    organizationId: user.organizationId ?? organizationId ?? null
                }
            });
        } else if (!user.organizationId && organizationId) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { organizationId }
            });
        }

        return user;
    },

    /**
     * Generate tokens for Google authenticated user
     */
    async generateTokens(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const organizationId = user?.organizationId ?? null;
        const role = user?.role ?? null;

        const accessToken = JwtUtil.generateToken({ userId, organizationId, role }, '15m');
        const refreshToken = JwtUtil.generateToken(
            { userId, organizationId, role, generatedAt: Date.now() },
            '7d'
        );

        // Save refresh token to database
        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken }
        });

        return { accessToken, refreshToken };
    },

    /**
     * Get user by Google ID
     */
    async getUserByGoogleId(googleId: string) {
        return await prisma.user.findUnique({
            where: { googleId }
        });
    }
};