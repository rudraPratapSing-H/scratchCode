import express from 'express';
import { AuthController } from '../controllers/auth.controller.ts';
import { requireAuth } from '../middlewares/requireAuth.ts';
import { GoogleAuthController } from '../controllers/google-auth.controller.ts';
const router = express.Router();
export const authRoutes = () => {
    router.post('/register', AuthController.register);
    // router.post('/verify-email', AuthController.verifyEmail);
    // router.post('/resend-otp', AuthController.resendOtp);
    router.post('/login', AuthController.login);
    router.post('/logout', AuthController.logout);
    // router.get('/grouped', requireAuth, AuthController.getProblemsGroupedByQuestionType);
    // Auto-login (Session Validation endpoint)
    router.get('/me', requireAuth, AuthController.me);
    // Google OAuth routes
    router.get('/google', GoogleAuthController.initiateGoogleAuth);
    router.get('/google/callback', GoogleAuthController.googleCallback);
    router.post('/google/callback-json', GoogleAuthController.googleCallbackJson);

    return router;
}