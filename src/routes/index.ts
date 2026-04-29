import express from 'express';

import { SubmissionController } from '../controllers/submission.controller.ts';
import { addProblem, getProblem, searchProblems } from '../controllers/problem.controller.ts';
import { AuthController } from '../controllers/auth.controller.ts';
import { requireAuth } from '../middlewares/requireAuth.ts';
import { searchProblems_andIds } from '../controllers/fetchProblemTtiles.controller.ts';

const router = express.Router();

export const setupRoutes = () => {
    router.get('/problems/titles', searchProblems_andIds);
    router.post('/execute', requireAuth, SubmissionController.submitCode);
    router.post('/execute-public', requireAuth, SubmissionController.runPublicCode);
    router.get('/submissions/latest', requireAuth, SubmissionController.getLatestSubmissionByUser);
    router.post('/addProblem', addProblem);
    router.get('/problems/search', searchProblems);
    router.get('/problems/:problemId', getProblem);
    router.post('/register', AuthController.register);
    router.get('/status/:id', SubmissionController.getStatus);
    return router;
};
