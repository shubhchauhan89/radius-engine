import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export let connection: Redis;

if (process.env.REDIS_URL) {
  // 1. Force Node to manually break apart the Upstash string
  const parsedUrl = new URL(process.env.REDIS_URL);

  // 2. Feed the exact pieces to ioredis so it doesn't get confused
  connection = new Redis({
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port),
    username: parsedUrl.username || 'default',
    password: parsedUrl.password,
    tls: { rejectUnauthorized: false }, // Required for Upstash
    maxRetriesPerRequest: null,         // Required for BullMQ
  });
} else {
  // Local fallback
  connection = new Redis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null,
  });
}

connection.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

connection.on('ready', () => {
  console.log('[Redis] Connected successfully to Upstash for BullMQ');
});

// Export BullMQ Queues
export const scrapeQueue = new Queue('scrapeQueue', { connection });
export const strategyQueue = new Queue('strategyQueue', { connection });
export const outlineQueue = new Queue('outlineQueue', { connection });
export const writerQueue = new Queue('writerQueue', { connection });
export const auditorQueue = new Queue('auditorQueue', { connection });