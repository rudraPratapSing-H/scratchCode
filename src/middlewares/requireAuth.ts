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

    if (accessToken) {
        try {
                const decoded: any = JwtUtil.verifyToken(accessToken);
                if (decoded?.userId) {
                    (req as any).user = { id: decoded.userId, organizationId: decoded.organizationId ?? null, role: decoded.role ?? null };
                    return next();
                }
        } catch (_error: any) {
            // Access token invalid/expired, continue with refresh fallback.
        }
    }

    const refreshToken = (req.cookies as any)?.refreshToken;
    console.log("refreshToken from cookie:", refreshToken);
    if (!refreshToken) {
        return res.status(401).json({ success: false, message: "Unauthorized No refresh token!!!" });
    }

    try {
        const decodedRefresh: any = JwtUtil.verifyToken(refreshToken);
        const refreshUserId = decodedRefresh?.userId;
        if (!refreshUserId) {
            return res.status(401).json({ success: false, message: "Unauthorized invalid refresh payload" });
        }

        const generatedAt = decodedRefresh?.generatedAt || 0;
        const now = Date.now();
        // pseudo-idempotency: skip rotation if token was created less than 15 seconds ago
        const shouldRotate = (now - generatedAt) > 15000;

        const refreshed = await AuthService.refreshSession(refreshToken, shouldRotate);

        res.cookie('refreshToken', refreshed.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Expose the newly refreshed access token to the frontend via a custom header
        res.setHeader('x-new-access-token', refreshed.accessToken);
        // Ensure CORS exposes the custom header so the frontend can read it!
        res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token');

        (req as any).user = { id: refreshUserId, organizationId: decodedRefresh.organizationId ?? null, role: decodedRefresh.role ?? null };
        return next();
    } catch (error: any) {
        console.error("Auth Refresh Error:", error.message);
        
        return res.status(401).json({ success: false, message: "Unauthorized, i am the culprit" });
    }
}
