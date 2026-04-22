import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { WorkerService } from '../services/worker.service.ts';
import { WrapperService } from '../services/wrapper.service.ts';
import { DockerService } from '../services/docker.service.ts';
import { GradingService } from '../services/grading.service.ts';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
console.log(`[WORKER] Connecting to Redis at ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'}`);

const worker = new Worker('CodeSubmissions', async (job: Job) => {
    const { submissionId, isPublicRun } = job.data;
    
    try {
        
        console.log(`[WORKER] Job ${job.id} received for submission ${submissionId}`);
        // 1. FETCH (testCases comes directly from the problem's JSONB column)
        const { submission, config } = await WorkerService.getJobDetails(submissionId);
        const testCases = isPublicRun ? submission.problem.publicTestCases : submission.problem.privateTestCases;
        console.log(`[WORKER] Loaded submission ${submissionId}: language=${submission.language}, testCases=${Array.isArray(testCases) ? testCases.length : 0}`);

        await WorkerService.updateStatus(submissionId, "Running");
        console.log(`[WORKER] Submission ${submissionId} status updated to Running`);

        const safeTestCases = Array.isArray(testCases) ? testCases : [];
        console.log(`[WORKER] Processing submission ${submissionId} with ${safeTestCases.length} test cases`);
        console.log(`[WORKER] Test cases data:`, JSON.stringify(safeTestCases, null, 2));
        // console.log(`[WORKER] Full code: ${submission.code}`);
        const allDetails: any[] = [];
        let passedCount = 0;
        let firstFailureStatus: string | null = null;

        // 2. EXECUTE EACH TEST CASE IN ISOLATION
        for (let i = 0; i < safeTestCases.length; i++) {
            const testCaseNumber = i + 1;
            const currentCase = safeTestCases[i];

            const fullCodeToRun = WrapperService.wrapCode(
                submission.language,
                submission.code,
                config.driverCode,
                currentCase
            );

            console.log('[WORKER} full code to run : ', fullCodeToRun);

            try {
                const { stdout } = await DockerService.executeContainer(
                    `${submissionId}-tc-${testCaseNumber}`,
                    submission.language,
                    fullCodeToRun,
                    config.memoryLimit,
                    config.timeLimit
                );

                const outputPreview = (stdout || '').slice(0, 200).replace(/\s+/g, ' ').trim();
                console.log(`[WORKER] Test case ${testCaseNumber} executed for submission ${submissionId}, stdout preview: "${outputPreview}"`);

                const caseResult = GradingService.evaluateSingleCase(
                    stdout,
                    currentCase,
                    testCaseNumber,
                    true
                );

                if (caseResult.detail) {
                    allDetails.push(caseResult.detail);
                }

                if (caseResult.passed) {
                    passedCount += 1;
                    continue;
                }

                firstFailureStatus = caseResult.status;
                console.log(`[WORKER] Test case ${testCaseNumber} failed for submission ${submissionId}: ${caseResult.status}`);

                if (!isPublicRun) {
                    break;
                }

            } catch (error: any) {
                const mappedStatus = GradingService.mapSystemError(error?.message || '');
                const caseStatus = `${mappedStatus} on Test Case ${testCaseNumber}`;

                if (!firstFailureStatus) {
                    firstFailureStatus = caseStatus;
                }

                allDetails.push({
                    testCase: testCaseNumber,
                    testCaseData: currentCase,
                    input: currentCase?.input,
                    output: '',
                    expectedOutput: String(currentCase?.expectedOutput ?? '').trim(),
                    passed: false,
                    error: mappedStatus
                });

                console.error(`[WORKER] Test case ${testCaseNumber} crashed for submission ${submissionId}:`, error?.message || error);

                if (!isPublicRun) {
                    break;
                }
            }
        }

        const finalStatus = firstFailureStatus || 'Accepted';
        console.log(`[WORKER] Verdict for submission ${submissionId}: ${finalStatus}`);

        // 3. SAVE
        await WorkerService.updateStatus(submissionId, finalStatus, {
            testCasesPassed: passedCount,
            totalTestCases: safeTestCases.length,
            errorMessage: allDetails.length > 0 ? JSON.stringify(allDetails) : null
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