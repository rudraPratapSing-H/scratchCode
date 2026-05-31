import express from 'express';
import { GoogleAuthService } from '../services/google-auth.service.ts';
import axios from 'axios';

type Request = express.Request;
type Response = express.Response;

export const GoogleAuthController = {
    getOrganizationIdFromState(state: unknown) {
        if (typeof state !== 'string' || !state.trim()) return null;

        try {
            const parsed = JSON.parse(state) as { organizationId?: string | null };
            return typeof parsed.organizationId === 'string' && parsed.organizationId.trim()
                ? parsed.organizationId
                : null;
        } catch {
            return null;
        }
    },

    /**
     * Initiate Google OAuth flow
     * Redirects to Google login
     */
    async initiateGoogleAuth(req: Request, res: Response) {
        const organizationId = typeof req.query.organizationId === 'string' && req.query.organizationId.trim()
            ? req.query.organizationId.trim()
            : null;

        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            redirect_uri: process.env.GOOGLE_CALLBACK_URL || '',
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'consent',
            state: JSON.stringify({ organizationId })
        }).toString()}`;

        res.redirect(googleAuthUrl);
    },

    /**
     * Google OAuth callback handler
     * Exchanges authorization code for tokens and creates/updates user
     */
    async googleCallback(req: Request, res: Response) {
        try {
            const { code, state } = req.query;

            if (!code) {
                res.status(400).json({
                    success: false,
                    message: 'Authorization code not provided'
                });
                return;
            }

            // Exchange authorization code for access token
            const tokenResponse = await axios.post(
                'https://oauth2.googleapis.com/token',
                {
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    code: code as string,
                    grant_type: 'authorization_code',
                    redirect_uri: process.env.GOOGLE_CALLBACK_URL
                }
            );

            const { access_token } = tokenResponse.data;

            // Fetch user profile from Google
            const userInfoResponse = await axios.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                {
                    headers: { Authorization: `Bearer ${access_token}` }
                }
            );

            const googleProfile = {
                id: userInfoResponse.data.id,
                email: userInfoResponse.data.email,
                name: userInfoResponse.data.name,
                picture: userInfoResponse.data.picture
            };

            const organizationId = GoogleAuthController.getOrganizationIdFromState(state);

            // Find or create user
            const user = await GoogleAuthService.findOrCreateUser(googleProfile, organizationId);

            // Generate our app tokens
            const { accessToken, refreshToken } = await GoogleAuthService.generateTokens(
                user.id
            );

            // Set refresh token cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Redirect to frontend with tokens
            // Adjust the redirect URL to your frontend
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(
                `${frontendUrl}/auth-success?accessToken=${accessToken}&userId=${user.id}&username=${user.username}`
            );
        } catch (error: any) {
            console.error('Google OAuth callback error:', error.message);
            res.status(400).json({
                success: false,
                message: error.message || 'Google authentication failed'
            });
        }
    },

    /**
     * Alternative endpoint that returns JSON instead of redirecting
     * Useful for mobile/SPA implementations
     */
    async googleCallbackJson(req: Request, res: Response) {
        try {
            const { code, state } = req.body;

            if (!code) {
                res.status(400).json({
                    success: false,
                    message: 'Authorization code not provided'
                });
                return;
            }

            // Exchange authorization code for access token
            const tokenResponse = await axios.post(
                'https://oauth2.googleapis.com/token',
                {
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    code: code as string,
                    grant_type: 'authorization_code',
                    redirect_uri: process.env.GOOGLE_CALLBACK_URL
                }
            );

            const { access_token } = tokenResponse.data;

            // Fetch user profile from Google
            const userInfoResponse = await axios.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                {
                    headers: { Authorization: `Bearer ${access_token}` }
                }
            );

            const googleProfile = {
                id: userInfoResponse.data.id,
                email: userInfoResponse.data.email,
                name: userInfoResponse.data.name,
                picture: userInfoResponse.data.picture
            };

            const organizationId = GoogleAuthController.getOrganizationIdFromState(state);

            // Find or create user
            const user = await GoogleAuthService.findOrCreateUser(googleProfile, organizationId);

            // Generate our app tokens
            const { accessToken, refreshToken } = await GoogleAuthService.generateTokens(
                user.id
            );

            // Set refresh token cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.status(200).json({
                success: true,
                message: 'Google authentication successful',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                accessToken
            });
        } catch (error: any) {
            console.error('Google OAuth callback error:', error.message);
            res.status(400).json({
                success: false,
                message: error.message || 'Google authentication failed'
            });
        }
    }
};