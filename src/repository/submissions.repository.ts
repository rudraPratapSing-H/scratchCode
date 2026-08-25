import { prisma } from '../lib/prisma.ts';

type SubmissionRetrivalObject = {
    id: string;
    problemId: string;
    userId: string;
    status: string;
    language: string;
    code: string;
    errorMessage: string | null;
    executionTimeMs: number | null;
    memoruUsedKb: number | null;
    testCasesPassed: number | null;
    totalTestCases: number | null;
    createdAt: Date;
};

export const SubmissionsRepository = {
    // prisma query to get the latest submission for a given problem and user and language, ordered by createdAt descending  
    async getLatestSubmission(problemId: string, userId: string, language: string): Promise<SubmissionRetrivalObject | null> {
        return await prisma.submission.findFirst({
            where: {
                problemId,
                userId,
                language
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        // return submission as SubmissionRetrivalObject | null;
    },

    // prisma query to retrive unique accepted problems for a user for all languages and all difficulty levels
    // async getUniqueAcceptedProblemsForUser(userId: string): Promise<string[]> {
    //     const groups = await prisma.submission.groupBy({
    //         by: ['problemId'],
    //         where: { userId, status: 'Accepted' }
    //     });
    //     return groups.map(g => g.problemId);
    // },

    async getUniqueAcceptedProblemsForUser(userId: string): Promise<string[]> {
        const submissions = await prisma.submission.findMany({
            where: { userId, status: 'Accepted' },
            select: { problemId: true }
        });
        return Array.from(new Set(submissions.map(s => s.problemId)));
    },

    async getUniqueProblemsForUser(userId: string): Promise<string[]> {
        const submissions = await prisma.submission.findMany({
            where: {
                userId,
            },
            select: { problemId: true }
        });
        return Array.from(new Set(submissions.map(s => s.problemId)));
    },

    // prisma query to retrive an array of all submissions objexts (SubmissionRetrivalObject) for a given problem and user, ordered by createdAt descending
    async getAllSubmissions(problemId: string, userId: string, language: string): Promise<SubmissionRetrivalObject[]> {
        const submissions = await prisma.submission.findMany({
            where: {
                problemId,
                userId,
                language
            },
            orderBy: {
                createdAt: 'desc'
            }

        });
        return submissions as SubmissionRetrivalObject[];
    },

    // prisma query to fetch all the submissions for a given user, ordered by createdAt descending
    async getAllSubmissionsForUser(userId: string): Promise<SubmissionRetrivalObject[]> {
        const submissions = await prisma.submission.findMany({
            where: {
                userId
            },
            orderBy: {
                createdAt: 'desc'
            }

        });
        return submissions as SubmissionRetrivalObject[];
    },

    // prisma query to fetch unique problems for a particular user 
    async getUniqueEasyProblemsForUser(userId: string, difficulty: "EASY" | "MEDIUM" | "HARD"): Promise<string[]> {
        const submissions = await prisma.submission.findMany({
            where: {
                userId,
                status: 'Accepted',
                problem: { difficulty }
            },
            select: { problemId: true }
        });
        return Array.from(new Set(submissions.map(s => s.problemId)));
    },

    // prisma query to fetch all accepted proplems for a particular user
    async getAllAcceptedProblemsForUser(userId: string): Promise<string[]> {
        const submissions = await prisma.submission.findMany({
            where: {
                userId,
                status: 'Accepted'
            },
            select: {
                problemId: true
            }
        });

        return submissions.map(submission => submission.problemId);
    }

}
