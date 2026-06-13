import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { Job } from 'bullmq';
import { WorkerService } from './src/services/worker.service.ts';
import { WrapperService } from './src/services/wrapper.service.ts';
import { DockerService } from './src/services/docker.service.ts';
import { GradingService } from './src/services/grading.service.ts';

const execAsync = promisify(exec);
const queueName = 'code-submissions';

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m'
};

const logInfo = (message: string) => {
    console.log(`${colors.cyan}${colors.bold}[WORKER]${colors.reset} ${message}`);
};

const logSuccess = (message: string) => {
    console.log(`${colors.green}${colors.bold}[WORKER]${colors.reset} ${message}`);
};

const logWarning = (message: string) => {
    console.log(`${colors.yellow}${colors.bold}[WORKER]${colors.reset} ${message}`);
};

const logError = (message: string) => {
    console.error(`${colors.red}${colors.bold}[WORKER]${colors.reset} ${message}`);
};

const normalizeTestCase = (testCase: any) => ({
    ...testCase,
    expectedOutput: testCase?.expectedOutput ?? testCase?.expected ?? '',
    input: testCase?.input ?? testCase?.testCaseData?.input ?? testCase?.testCaseData ?? ''
});

const failFast = (message: string): never => {
    logError(message);
    process.exit(1);
};

async function preFlightCheck() {
    logInfo('Checking local environment before connecting to Redis...');

    try {
        await execAsync('docker --version');
        logSuccess('Docker CLI detected.');
    } catch (error: any) {
        logError('Docker does not appear to be installed or available on PATH.');
        logWarning('Install Docker Desktop, then restart this worker.');
        if (error?.stderr) {
            console.error(error.stderr);
        }
        process.exit(1);
    }

    try {
        await execAsync('docker info');
        logSuccess('Docker daemon is running.');
    } catch (error: any) {
        logError('Docker is installed, but the daemon is not running.');
        logWarning('Open Docker Desktop and wait for it to finish starting, then restart this worker.');
        if (error?.stderr) {
            console.error(error.stderr);
        }
        process.exit(1);
    }
}

async function startWorker() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    await preFlightCheck();

    logInfo(`Connecting to Redis at ${redisUrl}...`);

    const redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null
    });

    logInfo(`Connecting BullMQ worker to queue "${queueName}"...`);
    
    // Initialize the Warm Container Pools
    const { ContainerPoolService } = await import('./src/services/container-pool.service.ts');
    await ContainerPoolService.initializePools();

    const worker = new Worker(queueName, async (job: Job) => {
        const { submissionId, isPublicRun, selectedTestCases } = job.data;

        try {
            logInfo(`Job ${job.id} received for submission ${submissionId}`);

            const { submission, config } = await WorkerService.getJobDetails(submissionId);
            const baseTestCases = isPublicRun ? submission.problem.publicTestCases : submission.problem.privateTestCases;
            const rerunTestCases = Array.isArray(selectedTestCases) ? selectedTestCases.map(normalizeTestCase) : [];
            const testCases = isPublicRun && rerunTestCases.length > 0
                ? [...(Array.isArray(baseTestCases) ? baseTestCases : []), ...rerunTestCases]
                : baseTestCases;

            logInfo(`Loaded submission ${submissionId}: language=${submission.language}, testCases=${Array.isArray(testCases) ? testCases.length : 0}`);
            const paramaterType = submission.problem.parameterTypes;
            const parameterNames = submission.problem.parameterNames;
            logInfo(`Parameter types for submission ${submissionId}: ${JSON.stringify(paramaterType)}`);

            await WorkerService.updateStatus(submissionId, 'Running');
            logInfo(`Submission ${submissionId} status updated to Running`);

            const safeTestCases = Array.isArray(testCases) ? testCases.map(normalizeTestCase) : [];
            logInfo(`Processing submission ${submissionId} with ${safeTestCases.length} test cases`);
            logInfo(`Test cases data: ${JSON.stringify(safeTestCases, null, 2)}`);

            const fullCodeToRun = WrapperService.wrapCode(
                submission.language,
                submission.code,
                config.driverCode,
                safeTestCases,
                paramaterType,
                parameterNames
            );

            logInfo(`Generated execution payload for submission ${submissionId}`);

            const { stdout } = await DockerService.executeContainer(
                `${submissionId}-submission`,
                submission.language,
                fullCodeToRun,
                config.memoryLimit,
                config.timeLimit
            );

            const outputPreview = (stdout || '').slice(0, 200).replace(/\s+/g, ' ').trim();
            logInfo(`Submission ${submissionId} executed, stdout preview: "${outputPreview}"`);

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
            logInfo(`Verdict for submission ${submissionId}: ${finalStatus}`);

            await WorkerService.updateStatus(submissionId, finalStatus, {
                testCasesPassed: passedCount,
                totalTestCases: safeTestCases.length,
                errorMessage: shouldPersistDetails && allDetails.length > 0 ? JSON.stringify(allDetails) : null
            });

            logSuccess(`Submission ${submissionId} status saved as ${finalStatus}`);
        } catch (error: any) {
            logError(`Processing failed for submission ${submissionId}: ${error?.message || error}`);
            const finalStatus = GradingService.mapSystemError(error.message);
            await WorkerService.updateStatus(submissionId, finalStatus);
            logWarning(`Submission ${submissionId} status updated to ${finalStatus}`);
        }
    }, {
        connection: redisConnection,
        concurrency: 5
    });

    worker.on('ready', () => {
        logSuccess(`Connected to queue "${queueName}" and waiting for jobs`);
    });

    worker.on('completed', (job) => {
        logSuccess(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
        logError(`Job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });

    worker.on('error', (error) => {
        logError(`Worker error: ${error.message}`);
    });
}

startWorker().catch((error) => {
    logError(`Worker failed to start: ${error?.message || error}`);
    process.exit(1);
});