import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// Initialize Redis connection
// maxRetriesPerRequest: null is required for BullMQ to work correctly with ioredis
const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export const connection = new Redis(redisOptions);

connection.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err);
});

connection.on('ready', () => {
  console.log('[Redis] Connected successfully for BullMQ');
});

// Export BullMQ Queues
export const scrapeQueue = new Queue('scrapeQueue', { connection });
export const strategyQueue = new Queue('strategyQueue', { connection });
export const outlineQueue = new Queue('outlineQueue', { connection });
export const writerQueue = new Queue('writerQueue', { connection });
export const auditorQueue = new Queue('auditorQueue', { connection });
