import { prisma } from '../lib/prisma.ts';

export const WorkerService = {
    async getJobDetails(submissionId: string) {
        // 1. Fetch everything in one go using Prisma's `include`
        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: {
                problem: {
                    include: { languageConfigs: true }
                }
            }
        });

        if (!submission) throw new Error("Submission not found.");

        // 2. Find the specific language config (memory limits, time limits, starter/driver code)
        const langConfig = submission.problem.languageConfigs.find(
            (c: any) => String(c.language).toLowerCase() === String(submission.language).toLowerCase()
        );

        if (!langConfig) throw new Error(`Language configuration missing for ${submission.language}.`);

        // Support canonical Prisma fields with backward-compatible fallbacks.
        const memoryLimit = Number(langConfig.memoryLimitMb ?? langConfig.memoryLimit);
        const timeLimit = Number(langConfig.timeLimitMs ?? langConfig.timeLimit);

        if (!Number.isFinite(memoryLimit) || memoryLimit <= 0) {
            throw new Error(`Invalid memory limit for ${submission.language}.`);
        }

        if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
            throw new Error(`Invalid time limit for ${submission.language}.`);
        }

        return {
            submission,
            config: {
                ...langConfig,
                memoryLimit,
                timeLimit
            }
        };
    },

    async updateStatus(submissionId: string, status: string, details?: any) {
        return await prisma.submission.update({
            where: { id: submissionId },
            data: { status, ...details }
        });
    }
};