import { Worker, Job } from 'bullmq';
import { connection } from '../queue/setup.js';
import { CheerioCrawler } from 'crawlee';
import { prisma } from '../lib/prisma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from '../agents/geminiClient.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY as string);

interface IngestionJobData {
  clientId: string;
  targetUrl: string;
}

/**
 * Utility function to chunk the extracted text.
 * Splits text into segments of roughly maxChunkSize.
 */
function chunkText(text: string, maxChunkSize = 1000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  // Split the text safely without cutting in the middle of words
  const words = text.split(/\s+/);
  
  for (const word of words) {
    if ((currentChunk + word).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = word + ' ';
    } else {
      currentChunk += word + ' ';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export const ingestionWorker = new Worker(
  'scrapeQueue',
  async (job: Job<IngestionJobData>) => {
    const { clientId, targetUrl } = job.data;
    
    console.log(`[IngestionWorker] Started processing job ${job.id} for URL: ${targetUrl}`);

    try {
      // 1. Scraping Phase
      console.log(`[IngestionWorker] Initializing crawler for ${targetUrl}...`);
      let extractedText = '';
      
      const crawler = new CheerioCrawler({
        async requestHandler({ $, request, log }) {
          log.info(`[IngestionWorker] Scraping ${request.url}`);
          // Ignore scripts, navs, styles, footers, headers
          $('script, style, nav, footer, header, noscript, iframe').remove();
          // Extract main text content from body and clean up whitespace
          extractedText = $('body').text().replace(/\s+/g, ' ').trim();
        },
      });

      await crawler.run([targetUrl]);
      
      if (!extractedText) {
         console.warn(`[IngestionWorker] No text could be extracted from ${targetUrl}`);
         return;
      }
      console.log(`[IngestionWorker] Successfully extracted ${extractedText.length} characters of text.`);

      // 2. Chunking Phase
      console.log(`[IngestionWorker] Chunking extracted text into ~1000 character segments...`);
      const chunks = chunkText(extractedText, 1000);
      console.log(`[IngestionWorker] Created ${chunks.length} chunks.`);

      if (chunks.length === 0) {
        return;
      }

      // 3. Embedding Phase
      console.log(`[IngestionWorker] Generating vector embeddings using gemini-embedding-001 natively...`);
      const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const embeddings: number[][] = [];
      for (const chunk of chunks) {
        const embedResult = await embedModel.embedContent(chunk);
        embeddings.push(embedResult.embedding.values);
      }
      console.log(`[IngestionWorker] Successfully generated ${embeddings.length} embeddings.`);

      // 4. Saving Phase
      console.log(`[IngestionWorker] Saving chunks and embeddings to the database...`);
      let savedCount = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Convert embedding array to a string formatted as [val1, val2, ...] for pgvector compatibility
        const embedding = JSON.stringify(embeddings[i]);
        
        await prisma.$executeRaw`INSERT INTO "ClientKnowledge" (id, "clientId", "sourceUrl", "contentChunk", embedding) VALUES (gen_random_uuid(), ${clientId}, ${targetUrl}, ${chunk}, ${embedding}::vector)`;
        
        savedCount++;
      }
      
      console.log(`[IngestionWorker] Successfully saved ${savedCount} knowledge chunks to the database.`);
      console.log(`[IngestionWorker] Job ${job.id} completed successfully.`);
      
    } catch (error) {
      console.error(`[IngestionWorker] Error processing job ${job.id}:`, error);
      throw error; // Let BullMQ handle failure and retries
    }
  },
  { connection, concurrency: 1 }
);

ingestionWorker.on('completed', (job) => {
  console.log(`[IngestionWorker] Job ${job.id} has completed successfully!`);
});

ingestionWorker.on('failed', (job, err) => {
  console.error(`[IngestionWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
