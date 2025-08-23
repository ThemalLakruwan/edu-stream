import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect();

export const publishEvent = async (event: string, data: any): Promise<void> => {
  try {
    await redisClient.publish('events', JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Event publish error:', error);
  }
};