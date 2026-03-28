import express from 'express';
import { JwtUtil } from '../utils/jwt.utils.ts';
import { AuthService } from '../services/auth.services.ts';

type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    let accessToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.slice(7).trim();
    }

    if (!accessToken && (req.cookies as any)?.accessToken) {
        accessToken = (req.cookies as any).accessToken;
    }

    if (accessToken) {
        try {
            const decoded: any = JwtUtil.verifyToken(accessToken);
            if (decoded?.userId) {
                (req as any).user = { id: decoded.userId };
                return next();
            }
        } catch (_error: any) {
            // Access token invalid/expired, continue with refresh fallback.
        }
    }

    const refreshToken = (req.cookies as any)?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        const refreshed = await AuthService.refreshSession(refreshToken);

        res.cookie('accessToken', refreshed.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshed.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        (req as any).user = { id: refreshed.userId };
        return next();
    } catch (error: any) {
        console.error("Auth Refresh Error:", error.message);
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
}
