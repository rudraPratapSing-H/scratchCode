import express from 'express';
import { AuthController } from '../controllers/auth.controller.ts';

const router = express.Router();
export const authRoutes = () => {
    router.post('/register', AuthController.register);
    router.post('/login', AuthController.login);
    router.post('/logout', AuthController.logout);

    return router;
}