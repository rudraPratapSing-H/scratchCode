import express from 'express';
import { createNewProblem, getProblemById, searchProblemsByTitle } from '../services/problem.service.ts';

type Request = express.Request;
type Response = express.Response;

export const addProblem = async (req: Request, res: Response) => {
    try {
        // In a true production app, you would use Zod or Joi here to validate 
        // that req.body matches your exact expected JSON structure.
        const newProblem = await createNewProblem(req.body);
        
        res.status(201).json({
            success: true,
            message: "Problem created successfully",
            data: newProblem
        });
    } catch (error: any) {
        // If it's a Prisma unique constraint error (e.g., ID already exists)
        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: "A problem with this title already exists." });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getProblem = async (req: Request, res: Response) => {
    try {
        const rawProblemId = req.params.problemId;
        const problemId = Array.isArray(rawProblemId) ? rawProblemId[0] : rawProblemId;

        if (!problemId) {
            return res.status(400).json({ success: false, message: 'Problem ID is required.' });
        }

        const problem = await getProblemById(problemId);
        res.status(200).json({ success: true, data: problem });
    } catch (error: any) {
        if (error.message === 'Problem not found.') {
            return res.status(404).json({ success: false, message: error.message });
        }

        res.status(400).json({ success: false, message: error.message || 'Failed to fetch problem.' });
    }
};

export const searchProblems = async (req: Request, res: Response) => {
    try {
        const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
        const query = rawQuery.trim();

        if (!query) {
            return res.status(400).json({ success: false, message: 'Query parameter q is required.' });
        }

        const result = await searchProblemsByTitle(query);
        return res.status(200).json({
            success: true,
            query,
            matchType: result.matchType,
            data: result.results
        });
    } catch (error: any) {
        return res.status(400).json({ success: false, message: error.message || 'Failed to search problems.' });
    }
};