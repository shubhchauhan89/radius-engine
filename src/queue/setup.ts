import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// 1. Get the raw URL string from your Render Environment Variable (or fallback to local)
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// 2. Initialize connection: Pass URL as the FIRST argument, options as the SECOND
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  // Upstash uses rediss:// (TLS). This ensures Node accepts the secure certificate.
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

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