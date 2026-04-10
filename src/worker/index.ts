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

        // 2. WRAP (Pass the JSONB test cases to be injected)
        const fullCodeToRun = WrapperService.wrapCode(
            submission.language,
            submission.code,
            config.driverCode,
            testCases 
        );
        
        console.log(`full code to run:- ${fullCodeToRun}`);
        console.log(`[WORKER] Wrapped code for submission ${submissionId} (chars=${fullCodeToRun.length})`);

        // 3. EXECUTE
        const { stdout } = await DockerService.executeContainer(
            submissionId, submission.language, fullCodeToRun, config.memoryLimit, config.timeLimit
        );
        const outputPreview = (stdout || '').slice(0, 200).replace(/\s+/g, ' ').trim();
        console.log(`[WORKER] Execution finished for submission ${submissionId}, stdout preview: "${outputPreview}"`);

        // 4. GRADE (Pass the output and the JSONB array to the grader)
        const gradingResult = GradingService.evaluateOutput(stdout, testCases as any[], Boolean(isPublicRun));
        console.log(`[WORKER] Verdict for submission ${submissionId}: ${gradingResult.status}`);
        
        // 5. SAVE
        await WorkerService.updateStatus(submissionId, gradingResult.status, {
            testCasesPassed: Array.isArray(gradingResult.details)
                ? gradingResult.details.filter((d) => d.passed).length
                : null,
            totalTestCases: Array.isArray(testCases) ? testCases.length : null,
            errorMessage: isPublicRun && gradingResult.details
                ? JSON.stringify(gradingResult.details)
                : null
        });
        console.log(`[WORKER] Submission ${submissionId} status saved as ${gradingResult.status}`);

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