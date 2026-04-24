import { Worker, Job } from 'bullmq';
import { connection, writerQueue } from '../queue/setup.js';
import { generateText } from 'ai';
import { parseAIJson } from '../lib/jsonUtils.js';
import { google } from '../agents/geminiClient.js';
import { OutlineSchema } from '../agents/schemas.js';

interface OutlineJobData {
  clientId: string;
  cityId: string;
  keyword: string;
  strategy: {
    targetIntent: string;
    lsiKeywords: string[];
    pageAngle: string;
  };
}

export const outlineWorker = new Worker(
  'outlineQueue',
  async (job: Job<OutlineJobData>) => {
    const { clientId, cityId, keyword, strategy } = job.data;

    console.log(`[OutlineWorker] Processing job ${job.id} - Keyword: "${keyword}"`);

    try {
      console.log(`[OutlineWorker] Selecting structural archetype for keyword: "${keyword}"...`);

      const archetypes = [
        ['hero', 'problem', 'services', 'seoArticle', 'faq', 'cta'], // Archetype A
        ['hero', 'services', 'seoArticle', 'problem', 'faq', 'cta'], // Archetype B
        ['hero', 'seoArticle', 'services', 'faq', 'problem', 'cta'], // Archetype C
      ];

      // Randomly select an archetype
      const selectedArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];

      console.log(`[OutlineWorker] Selected Archetype: ${selectedArchetype.join(' -> ')}`);

      const nextJobData = {
        clientId,
        cityId,
        keyword,
        strategy,
        outline: selectedArchetype, // Now an array of component strings
      };

      console.log(`[OutlineWorker] Handoff -> Adding job to writerQueue for keyword: "${keyword}"...`);
      await writerQueue.add('generateDraft', nextJobData);

      console.log(`[OutlineWorker] Job ${job.id} completed successfully.`);
      return selectedArchetype;
    } catch (error) {
      console.error(`[OutlineWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

outlineWorker.on('completed', (job) => {
  console.log(`[OutlineWorker] Job ${job.id} has completed!`);
});

outlineWorker.on('failed', (job, err) => {
  console.error(`[OutlineWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
