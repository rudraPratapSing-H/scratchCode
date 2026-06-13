import express from 'express';
import { prisma } from '../lib/prisma.ts'; 
import { QueueService } from '../services/queue.service.ts';
 
type Request = express.Request;
type Response = express.Response;

export const SubmissionController = {
    async submitCode(req: Request, res: Response) {
        try {
            const { problemId, language, code, competitionId } = req.body;
            
            // We assume you have a requireAuth middleware that attaches the user ID to the request!
            // If you are testing without auth right now, you can hardcode a user ID.
            const userId = (req as any).user?.id;

            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized (submission-controller)" });
            }

            const problem = await prisma.problem.findUnique({
                where: { id: problemId },
                select: { id: true }
            });

            if (!problem) {
                return res.status(404).json({ success: false, message: 'Problem not found.' });
            }

            // 1. Save the initial request to PostgreSQL with a "Pending" status
            const newSubmission = await prisma.submission.create({
                data: {
                    userId,
                    problemId,
                    language,
                    code,
                    competitionId: competitionId || null,
                    status: "Pending" 
                }
            });

            // 2. Delegate to the Queue Service to offload the heavy lifting to Redis
            await QueueService.enqueueSubmission(newSubmission.id);

            // 3. Instantly free up the Express thread and reply to the frontend
            res.status(201).json({
                success: true,
                message: "Code submitted successfully! Execution in progress.",
                submissionId: newSubmission.id,
                status: "Pending"
            });

        } catch (error: any) {
            if (error?.code === 'P2003') {
                return res.status(400).json({ success: false, message: 'Invalid problemId. The selected problem does not exist.' });
            }
            console.error("Submission Error:", error);
            res.status(500).json({ success: false, message: "Internal server error." });
        }
    },

    async runPublicCode(req: Request, res: Response) {
        try {
            const { problemId, language, code, selectedTestCases } = req.body;
            const userId = (req as any).user?.id;

            if (!userId) {
                console.warn("Unauthorized attempt to run public code");
                return res.status(401).json({ success: false, message: "Unauthorized(submission controller for public test)" });
            }

            const problem = await prisma.problem.findUnique({
                where: { id: problemId },
                select: { id: true }
            });

            if (!problem) {
                return res.status(404).json({ success: false, message: 'Problem not found.' });
            }

            const newSubmission = await prisma.submission.create({
                data: {
                    userId,
                    problemId,
                    language,
                    code,
                    status: "Pending"
                }
            });

            await QueueService.enqueueSubmission(
                newSubmission.id,
                true,
                Array.isArray(selectedTestCases) ? selectedTestCases : []
            );

            return res.status(201).json({
                success: true,
                message: "Code submitted successfully! Public test execution in progress.",
                submissionId: newSubmission.id,
                status: "Pending"
            });

        } catch (error: any) {
            if (error?.code === 'P2003') {
                return res.status(400).json({ success: false, message: 'Invalid problemId. The selected problem does not exist.' });
            }
            console.error("Public Run Error:", error);
            return res.status(500).json({ success: false, message: "Internal server error." });
        }
    },

    async getStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // We use `select` to ONLY pull the status field, making this query lightning fast
            const submission = await prisma.submission.findUnique({
                where: { id },
                select: {
                    status: true,
                    errorMessage: true,
                    testCasesPassed: true,
                    totalTestCases: true
                }
            });

            if (!submission) {
                return res.status(404).json({ success: false, message: "Submission not found" });
            }

            let details: any = null;
            if (submission.errorMessage) {
                try {
                    details = JSON.parse(submission.errorMessage);
                } catch {
                    details = submission.errorMessage;
                }
            }

            return res.status(200).json({
                success: true,
                status: submission.status,
                testCasesPassed: submission.testCasesPassed,
                totalTestCases: submission.totalTestCases,
                details
            });

        } catch (error: any) {
            console.error("Status Fetch Error:", error);
            return res.status(500).json({ success: false, message: "Internal server error." });
        }
    },

    async getLatestSubmissionByUser(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const problemId = String(req.query.problemId || '').trim();
            const language = String(req.query.language || '').trim();

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            if (!problemId || !language) {
                return res.status(400).json({
                    success: false,
                    message: 'problemId and language are required.'
                });
            }

            const latestSubmission = await prisma.submission.findFirst({
                where: {
                    userId,
                    problemId,
                    language
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    code: true,
                    status: true,
                    createdAt: true,
                    problemId: true,
                    language: true
                }
            });

            return res.status(200).json({
                success: true,
                data: latestSubmission
            });
        } catch (error: any) {
            console.error('Latest Submission Fetch Error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }
};