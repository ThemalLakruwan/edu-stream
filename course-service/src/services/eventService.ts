import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) return redisClient;

  const url = process.env.REDIS_URL || 'redis://redis:6379'; // sane in-docker default
  redisClient = createClient({ url });

  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

export const publishEvent = async (event: string, data: any): Promise<void> => {
  try {
    const client = await getRedisClient();
    await client.publish('events', JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Event publish error:', error);
  }
};
