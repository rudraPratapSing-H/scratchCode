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

// Initialize the Warm Container Pools asynchronously
import('../services/container-pool.service.ts')
    .then(({ ContainerPoolService }) => ContainerPoolService.initializePools())
    .catch(err => console.error('[WORKER] Failed to init pools:', err));

import { getSystemCapacity } from '../utils/system.ts';
const { optimalConcurrency, cpuCores, totalMemoryMB, maxContainersByRam } = getSystemCapacity();
console.log(`[WORKER] System Info: Cores=${cpuCores}, RAM=${totalMemoryMB.toFixed(0)}MB, Max by RAM=${maxContainersByRam}`);
console.log(`[WORKER] Starting with dynamic concurrency: ${optimalConcurrency}`);

import { processSubmissionJob } from './processor.ts';

const worker = new Worker('CodeSubmissions', processSubmissionJob, { connection: redisConnection, concurrency: optimalConcurrency });

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