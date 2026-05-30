import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// 1. Connect to the exact same Redis instance as the Worker
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null
});

// 2. Initialize the Producer Queue
export const submissionQueue = new Queue('CodeSubmissions', {
    connection: redisConnection
});

export const QueueService = {
    /**
     * Pushes a new submission ID into the Redis queue for the Worker to process.
     */
    async enqueueSubmission(submissionId: string, isPublicRun: boolean = false, selectedTestCases: any[] = []) {
        // The first argument is the job name, the second is the payload
        await submissionQueue.add('CodeSubmissions', { submissionId, isPublicRun, selectedTestCases });
        console.log(`📥 [PRODUCER] Submission ${submissionId} added to Redis queue.`);
    }
};