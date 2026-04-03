import express from 'express';
import { AuthController } from '../controllers/auth.controller.ts';
import { requireAuth } from '../middlewares/requireAuth.ts';

const router = express.Router();
export const authRoutes = () => {
    router.post('/register', AuthController.register);
    router.post('/verify-email', AuthController.verifyEmail);
    router.post('/login', AuthController.login);
    router.post('/logout', AuthController.logout);
    
    // Auto-login (Session Validation endpoint)
    router.get('/me', requireAuth, AuthController.me);

    return router;
}