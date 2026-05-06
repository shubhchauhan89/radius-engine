import { Worker, Job } from 'bullmq';
import { connection, outlineQueue } from '../queue/setup.js';
import { generateObject } from 'ai';
import { google } from '../agents/geminiClient.js';
import { StrategySchema } from '../agents/schemas.js';

interface StrategyJobData {
  clientId: string;
  cityId: string;
  keyword: string;
}

export const strategyWorker = new Worker(
  'strategyQueue',
  async (job: Job<StrategyJobData>) => {
    const { clientId, cityId, keyword } = job.data;

    console.log(`[StrategyWorker] Processing job ${job.id} - Keyword: "${keyword}", City: ${cityId}, Client: ${clientId}`);

    try {
      console.log(`[StrategyWorker] Requesting strategy from gemini-3.1-flash-lite for keyword: "${keyword}"...`);

      const { object: strategy } = await generateObject({
        model: google('gemini-3.1-flash-lite'),
        schema: StrategySchema,
        system: `You are an Elite Local SEO Strategist. Analyze the given keyword and create a strategy that dominates the local search results.`,
        prompt: `Analyze this keyword for local SEO: "${keyword}".`,
      });

      console.log(`[StrategyWorker] Strategy generated for job ${job.id}. Intent: ${strategy.targetIntent}, Angle: ${strategy.pageAngle}`);

      const nextJobData = {
        clientId,
        cityId,
        keyword,
        strategy,
      };

      console.log(`[StrategyWorker] Handoff -> Adding job to outlineQueue for keyword: "${keyword}"...`);
      await outlineQueue.add('generateOutline', nextJobData);

      console.log(`[StrategyWorker] Job ${job.id} completed successfully.`);
      return strategy;
    } catch (error) {
      console.error(`[StrategyWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 14,
      duration: 60000,
    }
  }
);

strategyWorker.on('completed', (job) => {
  console.log(`[StrategyWorker] Job ${job.id} has completed!`);
});

strategyWorker.on('failed', (job, err) => {
  console.error(`[StrategyWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
