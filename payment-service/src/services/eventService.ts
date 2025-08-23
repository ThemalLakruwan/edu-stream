// payment-service/src/services/eventService.ts
import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://:password@redis:6379'; // sane default for Docker dev

export const redisClient = createClient({
  url,
  socket: {
    reconnectStrategy: (retries) => {
      // exponential backoff up to ~10s
      const delay = Math.min(retries * 200, 10_000);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

let connected = false;

export const ensureRedis = async () => {
  if (!connected) {
    await redisClient.connect();
    connected = true;
  }
};

export const publishEvent = async (event: string, data: any): Promise<void> => {
  try {
    await ensureRedis();
    await redisClient.publish('events', JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Event publish error:', error);
  }
};
