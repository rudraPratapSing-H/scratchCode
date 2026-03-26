import express from 'express';

import { handleSubmission } from '../controllers/mainWorker.ts';
import { addProblem } from '../controllers/problem.controller.ts';
import { AuthController } from '../controllers/auth.controller.ts';
const router = express.Router();

export const setupRoutes = () => {
    router.post('/execute', handleSubmission);
    router.post('/addProblem', addProblem);
    router.post('/register', AuthController.register);

    return router;
};
