import { prisma } from '../lib/prisma.ts';
import { HashUtil } from '../utils/hash.util.ts';
import { JwtUtil } from '../utils/jwt.utils.ts';

export const AuthService = {
    async registerUser(data: any) {
        const { email, username, password } = data;

        // 1. Business Logic
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });
        if (existingUser) throw new Error("Email or username already taken.");

        // 2. Delegate the math to the Helper!
        const { hash, salt } = await HashUtil.hashPassword(password);

        // 3. Save to Database
        return await prisma.user.create({
            data: { email, username, password: hash, salt }
        });
    },

    async loginUser(email: string, passwordAttempt: string) {
        // 1. Find User
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new Error("Invalid credentials.");

        // 2. Delegate the comparison to the Helper!
        const isValid = await HashUtil.compare(passwordAttempt, user.password);
        if (!isValid) throw new Error("Invalid credentials.");

        // 3. Delegate token generation to the Helper!
        const accessToken = JwtUtil.generateToken({ userId: user.id }, '15m');
        const refreshToken = JwtUtil.generateToken({ userId: user.id }, '7d');

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        return { user, accessToken, refreshToken };
    },

    async refreshSession(refreshToken: string) {
        const decoded: any = JwtUtil.verifyToken(refreshToken);
        const userId = decoded?.userId;
        if (!userId) throw new Error("Invalid refresh token.");

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshToken) throw new Error("Invalid refresh token.");

        // Safety check: incoming refresh token must match DB value.
        if (user.refreshToken !== refreshToken) {
            throw new Error("Refresh token mismatch.");
        }

        const newAccessToken = JwtUtil.generateToken({ userId: user.id }, '15m');
        const newRefreshToken = JwtUtil.generateToken({ userId: user.id }, '7d');

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken }
        });

        return { userId: user.id, accessToken: newAccessToken, refreshToken: newRefreshToken };
    }
};