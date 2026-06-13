import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { WorkerService } from '../services/worker.service.ts';
import { WrapperService } from '../services/wrapper.service.ts';
import { DockerService } from '../services/docker.service.ts';
import { GradingService } from '../services/grading.service.ts';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
console.log(`[WORKER] Connecting to Redis at ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'}`);

const normalizeTestCase = (testCase: any) => ({
    ...testCase,
    expectedOutput: testCase?.expectedOutput ?? testCase?.expected ?? '',
    input: testCase?.input ?? testCase?.testCaseData?.input ?? testCase?.testCaseData ?? ''
});

const worker = new Worker('CodeSubmissions', async (job: Job) => {
    const { submissionId, isPublicRun, selectedTestCases } = job.data;

    try {

        console.log(`[WORKER] Job ${job.id} received for submission ${submissionId}`);
        // 1. FETCH (testCases comes directly from the problem's JSONB column)
        const { submission, config } = await WorkerService.getJobDetails(submissionId);
        const baseTestCases = isPublicRun ? submission.problem.publicTestCases : submission.problem.privateTestCases;
        const rerunTestCases = Array.isArray(selectedTestCases) ? selectedTestCases.map(normalizeTestCase) : [];
        const testCases = isPublicRun && rerunTestCases.length > 0
            ? [...(Array.isArray(baseTestCases) ? baseTestCases : []), ...rerunTestCases]
            : baseTestCases;
        console.log(`[WORKER] Loaded submission ${submissionId}: language=${submission.language}, testCases=${Array.isArray(testCases) ? testCases.length : 0}`);
        const paramaterType = submission.problem.parameterTypes;
        const parameterNames = submission.problem.parameterNames;
        console.log(`[WORKER] Parameter types for submission ${submissionId}:`, paramaterType);
        await WorkerService.updateStatus(submissionId, "Running");
        console.log(`[WORKER] Submission ${submissionId} status updated to Running`);

        const safeTestCases = Array.isArray(testCases) ? testCases.map(normalizeTestCase) : [];
        console.log(`[WORKER] Processing submission ${submissionId} with ${safeTestCases.length} test cases`);
        console.log(`[WORKER] Test cases data:`, JSON.stringify(safeTestCases, null, 2));
        // console.log(`[WORKER] Full code: ${submission.code}`);
        const fullCodeToRun = WrapperService.wrapCode(
            submission.language,
            submission.code,
            config.driverCode,
            safeTestCases,
            paramaterType,
            parameterNames
        );

        console.log('[WORKER] Full code to run:', fullCodeToRun);

        const { stdout } = await DockerService.executeContainer(
            `${submissionId}-submission`,
            submission.language,
            fullCodeToRun,
            config.memoryLimit,
            config.timeLimit
        );

        const outputPreview = (stdout || '').slice(0, 200).replace(/\s+/g, ' ').trim();
        console.log(`[WORKER] Submission ${submissionId} executed, stdout preview: "${outputPreview}"`);

        const gradingResult = GradingService.evaluateOutput(stdout, safeTestCases, isPublicRun);
        const allDetails = gradingResult.details || [];

        let passedCount = 0;
        for (let i = 0; i < safeTestCases.length; i++) {
            const actualLine = String(stdout || '').trim().split(/\r?\n/)[i];
            if (actualLine === undefined) {
                break;
            }

            const caseResult = GradingService.evaluateSingleCase(actualLine, safeTestCases[i], i + 1, isPublicRun);
            if (!caseResult.passed) {
                break;
            }

            passedCount += 1;
        }

        const finalStatus = gradingResult.status || 'Accepted';
        const shouldPersistDetails = isPublicRun || finalStatus !== 'Accepted';
        console.log(`[WORKER] Verdict for submission ${submissionId}: ${finalStatus}`);

        // 3. SAVE
        await WorkerService.updateStatus(submissionId, finalStatus, {
            testCasesPassed: passedCount,
            totalTestCases: safeTestCases.length,
            errorMessage: shouldPersistDetails && allDetails.length > 0 ? JSON.stringify(allDetails) : null
        });
        console.log(`[WORKER] Submission ${submissionId} status saved as ${finalStatus}`);

    } catch (error: any) {
        console.error(`[WORKER] Processing failed for submission ${submissionId}:`, error?.message || error);
        const finalStatus = GradingService.mapSystemError(error.message);
        await WorkerService.updateStatus(submissionId, finalStatus);
        console.log(`[WORKER] Submission ${submissionId} status updated to ${finalStatus}`);
    }
}, { connection: redisConnection, concurrency: 5 });

worker.on('ready', () => {
    console.log('[WORKER] Worker is ready and waiting for jobs');
});

worker.on('completed', (job) => {
    console.log(`[WORKER] Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
    console.error(`[WORKER] Job ${job?.id ?? 'unknown'} failed:`, error.message);
});

worker.on('error', (error) => {
    console.error('[WORKER] Worker error:', error.message);
});