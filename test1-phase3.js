import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from './src/lib/prisma.ts'; // Make sure this path points to your Prisma client!

// 1. Connect to the same Redis container
const connection = new IORedis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null
});

console.log("👷 Dummy Worker is awake and listening to the Redis Queue...");

// 2. Create the Consumer (Worker)
const worker = new Worker('CodeSubmissions', async (job) => {
    console.log(`\n📦 BOOM! Grabbed Job ID: ${job.id} from Redis!`);
    
    const { submissionId } = job.data;
    console.log(`🔍 Fetching submission ${submissionId} from PostgreSQL...`);

    // 3. Fetch the full relational data we need to run the code
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
            problem: {
                include: {
                    languageConfigs: true // Bring in the boilerplates and time limits!
                }
            }
        }
    });

    if (!submission) {
        throw new Error("❌ Submission not found in database!");
    }

    // 4. Extract the exact config for the language the user submitted
    const config = submission.problem.languageConfigs.find(
        (c) => c.language === submission.language
    );

    console.log("✅ Data retrieved successfully!");
    console.log("--------------------------------------------------");
    console.log(`Problem: ${submission.problem.title}`);
    console.log(`Language: ${submission.language}`);
    console.log(`Time Limit Applied: ${config?.timeLimitMs}ms`);
    console.log(`Code to execute:\n${submission.code}`);
    console.log("--------------------------------------------------");
    
    console.log("🚀 (Simulated) Firing up Docker container...");
    
    // Simulate it taking 2 seconds to run the code
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Update the database with the result
    await prisma.submission.update({
        where: { id: submissionId },
        data: { 
            status: "Accepted", 
            executionTimeMs: 42,
            memoryUsedKb: 1024
        }
    });

    console.log("🏁 Job finished! Database updated to 'Accepted'.\n");

}, { connection });

worker.on('failed', (job, err) => {
    console.log(`❌ Job ${job?.id} failed with error: ${err.message}`);
});