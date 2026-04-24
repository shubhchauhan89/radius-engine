import { Worker, Job } from 'bullmq';
import { connection, outlineQueue } from '../queue/setup.js';
import { generateText } from 'ai';
import { parseAIJson } from '../lib/jsonUtils.js';
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
      console.log(`[StrategyWorker] Requesting strategy from Gemma 3 27B for keyword: "${keyword}"...`);

      const { text } = await generateText({
        model: google('gemma-3-27b-it'),
        system: `You are an Elite Local SEO Strategist. Analyze the given keyword and return a strict JSON object with targetIntent, lsiKeywords, and pageAngle.
The targetIntent MUST be strictly lowercase: informational, transactional, or local.
You must return ONLY raw, valid JSON. Do not wrap it in markdown blockquotes. The JSON must match this exact structure: { "targetIntent": "string", "lsiKeywords": ["string"], "pageAngle": "string" }`,
        prompt: `Analyze this keyword for local SEO: "${keyword}". Create a strategy that dominates the local search results.`,
      });

      const parsedObject = parseAIJson(text);
      if (parsedObject.targetIntent) { parsedObject.targetIntent = parsedObject.targetIntent.toLowerCase().trim(); }
      const strategy = StrategySchema.parse(parsedObject);

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
  { connection, concurrency: 1 }
);

strategyWorker.on('completed', (job) => {
  console.log(`[StrategyWorker] Job ${job.id} has completed!`);
});

strategyWorker.on('failed', (job, err) => {
  console.error(`[StrategyWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
