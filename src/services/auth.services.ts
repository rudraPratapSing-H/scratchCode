import { prisma } from '../lib/prisma.ts';
import { HashUtil } from '../utils/hash.util.ts';
import { JwtUtil } from '../utils/jwt.utils.ts';
// Assume you have these utilities configured:
import { redisClient } from '../config/redis.ts'; 
import { EmailUtil } from '../utils/email.util.ts';


export const AuthService = {
    // ------------------------------------------------------------------------
    // 1. THE WAITING ROOM (Registration)
    // ------------------------------------------------------------------------
    async registerUser(data: any) {
        const { email, username, password } = data;

        // 1. Check if the user already exists in Postgres
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });
        if (existingUser) throw new Error("Email or username already taken.");

        // 2. Hash the password
        const { hash, salt } = await HashUtil.hashPassword(password);

        // 3. Generate OTP & Create the Pending Package
        const otp = EmailUtil.generateOTP();
        const pendingUser = { email, username, hash, salt, otp };

        // 4. Save to Redis with a 10-minute TTL (600 seconds)
        await redisClient.setEx(`pending:${email}`, 600, JSON.stringify(pendingUser));

        // 5. Fire off the email (don't await it so we respond instantly)
        EmailUtil.sendOTPEmail(email, otp).catch(err => console.error("Email failed:", err));

        // We return a message, NOT a user object.
        return { message: "Please check your email for the verification code." };
    },

    // ------------------------------------------------------------------------
    // 2. THE VIP PASS (Verification)
    // ------------------------------------------------------------------------
    async resendOTP(email: string) {
        // 1. Check if user is still pending
        const pendingDataStr = await redisClient.get(`pending:${email}`);
        if (!pendingDataStr) throw new Error("Registration session expired or does not exist. Please register again.");
        
        const pendingData = JSON.parse(pendingDataStr);
        
        // 2. Generate a fresh OTP
        const newOtp = EmailUtil.generateOTP();
        
        // 3. Update the tracking object
        pendingData.otp = newOtp;
        
        // 4. Overwrite Redis (renew the TTL to 10 minutes)
        await redisClient.setEx(`pending:${email}`, 600, JSON.stringify(pendingData));
        
        // 5. Fire off the email seamlessly
        EmailUtil.sendOTPEmail(email, newOtp).catch(err => console.error("Email failed on resend:", err));

        return { message: "A new OTP has been sent to your email." };
    },

    async verifyEmail(email: string, otpAttempt: string) {
        // 1. Check the Redis Waiting Room
        const pendingDataStr = await redisClient.get(`pending:${email}`);
        if (!pendingDataStr) throw new Error("OTP expired or invalid. Please register again.");

        const pendingData = JSON.parse(pendingDataStr);

        // 2. Verify OTP
        if (pendingData.otp !== otpAttempt) throw new Error("Incorrect OTP.");

        // 3. The Final Commit: Insert into Postgres
        const user = await prisma.user.create({
            data: { 
                email: pendingData.email, 
                username: pendingData.username, 
                password: pendingData.hash, 
                salt: pendingData.salt 
            }
        });

        // 4. Generate tokens and update the user in Postgres.
        const accessToken = JwtUtil.generateToken({ userId: user.id }, '15m');
        const refreshToken = JwtUtil.generateToken({ userId: user.id, generatedAt: Date.now() }, '7d');

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        // 5. Clean up Redis
        await redisClient.del(`pending:${email}`);

        return { user, accessToken, refreshToken };
    },

    // ------------------------------------------------------------------------
    // 3. STANDARD METHODS
    // ------------------------------------------------------------------------
    async getUserById(userId: string) {
        return await prisma.user.findUnique({
            where: { id: userId }
        });
    },

    async loginUser(email: string, passwordAttempt: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new Error("Invalid credentials.");

        const isValid = await HashUtil.compare(passwordAttempt, user.password);
        if (!isValid) throw new Error("Invalid credentials.");

        const accessToken = JwtUtil.generateToken({ userId: user.id }, '15m');
        const refreshToken = JwtUtil.generateToken({ userId: user.id, generatedAt: Date.now() }, '7d');

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        return { user, accessToken, refreshToken };
    },

    // ------------------------------------------------------------------------
    // 4. IDEMPOTENT REFRESH (The Grace Period)
    // ------------------------------------------------------------------------
    async refreshSession(oldRefreshToken: string, shouldRotate: boolean) {
        // --- THE REACT STRICT MODE FIX ---
        // 1. Check if this token was JUST rotated in the last 30 seconds
        const gracePeriodToken = await redisClient.get(`grace:${oldRefreshToken}`);
        
        if (gracePeriodToken) {
            // It's a double-render! Give them a fresh access token, but return the 
            // exact same refresh token we generated 10 milliseconds ago.
            const decoded: any = JwtUtil.verifyToken(gracePeriodToken);
            const newAccessToken = JwtUtil.generateToken({ userId: decoded.userId }, '15m');
            return { accessToken: newAccessToken, refreshToken: gracePeriodToken };
        }

        // --- STANDARD FLOW ---
        // 2. Verify the old token
        const decoded: any = JwtUtil.verifyToken(oldRefreshToken);
        const userId = decoded?.userId;
        if (!userId) throw new Error("Invalid refresh token.");

        // 3. Validate against the database
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.refreshToken !== oldRefreshToken) {
            // RED ALERT: Token reuse detected outside of grace period.
            // You could optionally nullify the DB token here to lock the account.
            throw new Error("Refresh token mismatch or unauthorized replay.");
        }

        // 4. Generate the new tokens
        const newAccessToken = JwtUtil.generateToken({ userId: user.id }, '15m');
        let newRefreshToken = oldRefreshToken;

        if (shouldRotate) {
            newRefreshToken = JwtUtil.generateToken({ userId: user.id, generatedAt: Date.now() }, '7d');

            // 5. Update Postgres
            await prisma.user.update({
                where: { id: user.id },
                data: { refreshToken: newRefreshToken }
            });

            // 6. CREATE THE GRACE PERIOD
            // Save the old token to Redis for 30 seconds, pointing to the new one.
            await redisClient.setEx(`grace:${oldRefreshToken}`, 30, newRefreshToken);
        }

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }
};