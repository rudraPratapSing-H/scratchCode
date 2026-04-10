import express from 'express';

import { SubmissionController } from '../controllers/submission.controller.ts';
import { addProblem, getProblem } from '../controllers/problem.controller.ts';
import { AuthController } from '../controllers/auth.controller.ts';
import { requireAuth } from '../middlewares/requireAuth.ts';
const router = express.Router();

export const setupRoutes = () => {
    router.post('/execute', requireAuth, SubmissionController.submitCode);
    router.post('/execute-public', requireAuth, SubmissionController.runPublicCode);
    router.post('/addProblem', addProblem);
    router.get('/problems/:problemId', getProblem);
    router.post('/register', AuthController.register);
    router.get('/status/:id', SubmissionController.getStatus);
    return router;
};
