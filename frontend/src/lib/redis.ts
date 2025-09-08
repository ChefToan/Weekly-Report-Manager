import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  try {
    // Support both REDIS_URL and individual config variables
    const redisUrl = process.env.REDIS_URL;
    
    if (!redis) {
      if (redisUrl) {
        // Use Redis URL format: redis://localhost:6379/0
        redis = new Redis(redisUrl, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
      } else {
        // Use individual environment variables
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379');
        const password = process.env.REDIS_PASSWORD;
        const db = parseInt(process.env.REDIS_DB || '0');

        redis = new Redis({
          host,
          port,
          password,
          db,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
      }

      // Handle connection events
      redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

      redis.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        // Don't reset to null here - let it retry
      });

      redis.on('close', () => {
        console.log('Redis connection closed');
        redis = null;
      });
    }

    return redis;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    return null;
  }
}

