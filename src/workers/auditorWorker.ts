import { Worker, Job } from 'bullmq';
import { connection } from '../queue/setup.js';
import { prisma } from '../lib/prisma.js';
import { generateObject } from 'ai';
import { google } from '../agents/geminiClient.js';
import { AuditorSchema } from '../agents/schemas.js';

interface AuditorJobData {
  pageId: string;
  clientId: string;
  strategy: {
    targetIntent: string;
    lsiKeywords: string[];
    pageAngle: string;
  };
}

export const auditorWorker = new Worker(
  'auditorQueue',
  async (job: Job<AuditorJobData>) => {
    const { pageId, clientId, strategy } = job.data;
    console.log(`[AuditorWorker] Processing job ${job.id} for Page ID: ${pageId}`);

    try {
      // 1. Fetch the GeneratedPage draft
      console.log(`[AuditorWorker] Fetching drafted page...`);
      const page = await prisma.generatedPage.findUnique({
        where: { id: pageId },
      });

      if (!page) {
        throw new Error(`GeneratedPage not found: ${pageId}`);
      }

      if (page.status !== 'DRAFT') {
        console.warn(`[AuditorWorker] Page ${pageId} is not in DRAFT status. Current status: ${page.status}. Proceeding anyway.`);
      }

      // 2. Audit with Gemini
      console.log(`[AuditorWorker] Requesting audit from gemini-3.1-flash-lite-preview...`);

      const { object: auditResult } = await generateObject({
        model: google('gemini-3.1-flash-lite-preview'),
        schema: AuditorSchema,
        system: `You are a Strict SEO Editor and Quality Control Specialist.
Your task is to audit drafted HTML content for SEO optimization, natural keyword integration, and semantic HTML validity.
Check if the requested LSI keywords are naturally integrated into the content.
If the content is poorly written, lacks the keywords, or contains broken/invalid HTML, reject it.`,
        prompt: `
Audit the following drafted page content.

LSI Keywords Required:
${strategy.lsiKeywords.join(', ')}

Drafted HTML Content:
${page.contentJson}

Evaluate the content. Is it approved? Provide feedback.`
      });

      console.log(`[AuditorWorker] Audit complete. Approved: ${auditResult.isApproved}`);

      if (auditResult.isApproved) {
        console.log(`[AuditorWorker] Page approved! Updating status to PUBLISHED.`);
        await prisma.generatedPage.update({
          where: { id: pageId },
          data: { status: 'PUBLISHED' },
        });
      } else {
        console.log(`[AuditorWorker] Page rejected. Updating status to REJECTED.`);
        await prisma.generatedPage.update({
          where: { id: pageId },
          data: { status: 'REJECTED' },
        });

        // Log the feedback as requested
        console.log(`\n[AuditorWorker] --- AUDIT FEEDBACK FOR ${pageId} ---`);
        console.log(auditResult.feedback);
        console.log(`----------------------------------------------------\n`);
      }

      console.log(`[AuditorWorker] Job ${job.id} processed successfully.`);
      return auditResult;
    } catch (error) {
      console.error(`[AuditorWorker] Error processing job ${job.id}:`, error);
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

auditorWorker.on('completed', (job) => {
  console.log(`[AuditorWorker] Job ${job.id} has completed successfully!`);
});

auditorWorker.on('failed', (job, err) => {
  console.error(`[AuditorWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
