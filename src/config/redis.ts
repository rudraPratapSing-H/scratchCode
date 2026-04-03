import { createClient } from 'redis';

// Configure the Redis client
export const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

// Auto-connect when the file is imported
(async () => {
    try {
        await redisClient.connect();
        console.log('✅ Connected to Redis successfully');
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
    }
})();
