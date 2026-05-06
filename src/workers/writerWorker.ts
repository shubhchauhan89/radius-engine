import { Worker, Job } from 'bullmq';
import { connection, auditorQueue } from '../queue/setup.js';
import { prisma } from '../lib/prisma.js';
import { generateObject } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from '../agents/geminiClient.js';
import { z } from 'zod';
import { generateFullPageHtml } from '../lib/layoutBuilder.js';
import { renderComponent } from '../templates/components.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY as string);

interface WriterJobData {
  clientId: string;
  cityId: string;
  keyword: string;
  strategy: {
    targetIntent: string;
    lsiKeywords: string[];
    pageAngle: string;
  };
  outline: string[];
}

export const writerWorker = new Worker(
  'writerQueue',
  async (job: Job<WriterJobData>) => {
    const { clientId, cityId, keyword, strategy, outline } = job.data;
    console.log(`[WriterWorker] Processing job ${job.id} - Keyword: "${keyword}" for Client: ${clientId}`);

    try {
      // 1. Data Hydration
      console.log(`[WriterWorker] Hydrating client data...`);
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      // 2. Initialization
      const finalContentBlocks: string[] = [];

      // 3. Vector Retrieval (RAG) - Once for the page keyword
      console.log(`[WriterWorker] Generating embedding for search query...`);
      const searchQuery = `${keyword} in ${cityId}`;
      const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const embedResult = await embedModel.embedContent({
        content: { role: 'user', parts: [{ text: searchQuery }] },
        outputDimensionality: 768
      } as any);
      const embedding = embedResult.embedding.values;
      const vectorString = `[${embedding.join(',')}]`;

      console.log(`[WriterWorker] Querying vector database for semantic matches...`);
      const relevantKnowledge = await prisma.$queryRaw<{ contentChunk: string }[]>`
        SELECT "contentChunk" 
        FROM "ClientKnowledge" 
        WHERE "clientId" = ${clientId} 
        ORDER BY embedding <-> ${vectorString}::vector 
        LIMIT 3;
      `;
      let clientBrain = '';
      if (relevantKnowledge && relevantKnowledge.length > 0) {
        clientBrain = relevantKnowledge.map((k) => k.contentChunk).join('\n\n');
      }
      console.log(`[WriterWorker] Retrieved Client Brain Context:\n${clientBrain}\n`);

      // 4. Assembly Loop
      console.log(`[WriterWorker] Starting assembly loop for ${outline.length} components...`);

      for (const [index, sectionType] of outline.entries()) {
        console.log(`[WriterWorker] Processing component ${index + 1}/${outline.length}: ${sectionType}`);

        // 5. Generation
        console.log(`[WriterWorker] Generating structured object with gemini-3.1-flash-lite-preview...`);

        const ComponentSchema = z.object({
          headline: z.string().optional().describe("A compelling, natural-sounding H2 headline related to the client's industry. No keyword stuffing."),
          subheadline: z.string().optional().describe("An engaging subheadline that builds local authority without corporate jargon."),
          body: z.string().optional().describe("1 to 2 short, highly readable sentences. No run-ons. No keyword stuffing. No B2B jargon."),
          ctaText: z.string().optional().describe("Action-oriented call-to-action text (e.g., 'Book a Tutor', 'Get a Quote')"),
          items: z.array(z.object({
            title: z.string().describe("A short, specific title for the service, problem, or FAQ item"),
            description: z.string().describe("1 to 2 short, highly readable sentences. No run-ons. No keyword stuffing.")
          })).optional().default([])
        });

        try {
          const { object: parsedJson } = await generateObject({
            model: google('gemini-3.1-flash-lite-preview'),
            schema: ComponentSchema,
            // @ts-ignore - explicitly requested by user, bypass TS definition mismatch
            maxTokens: 4000,
            system: `You are an elite, human-sounding local B2C service copywriter. You are writing for local parents and students, NOT corporate executives. NEVER use B2B jargon like 'B2B solutions', 'business demands', 'synergy', or 'elevating your brand'.
Write in short, punchy, highly readable sentences. ABSOLUTE MAXIMUM of 3 sentences per paragraph. Do NOT write run-on sentences.
Integrate the primary keyword and LSI keywords NATURALLY. Do NOT force them where they don't belong.
Do NOT stuff the city or neighborhood name into every sentence. Use it naturally a maximum of 1 or 2 times per component.
Base your facts strictly on the Client Brain Context. If the context is about tutoring, do not write about manufacturing.

Provide engaging copy tailored to the requested component type.
When generating content for the faq component, you MUST provide at least 6 detailed questions and answers. When generating the services component, provide exactly 6 items. When generating the seoArticle component, write at least 4 highly readable paragraphs (max 3 sentences each) rich in LSI keywords.
For the seoArticle component, you must prove local authority without overstuffing. Using your internal knowledge of the requested city, seamlessly weave in 1 or 2 hyper-local geographic entities. Mention specific major highways, local business parks, or prominent commercial landmarks relevant to the city. Do not use generic phrases like "in the downtown area." Use exact local names.

If the Client Knowledge Base does not contain specific information about the requested keyword (e.g., the keyword asks for English, but the knowledge base only lists Math), generalize the answer safely using the client's established tone and location without inventing false syllabus data.

If the schema requires multiple items (e.g., 3 services) but the Client Brain Context only provides 1 or 2, duplicate the tone and extrapolate highly relevant, localized services based strictly on the industry. Do not return empty arrays if the schema forbids it.

You MUST strictly adhere to the facts provided in the Client Knowledge Base below. Do not invent services, fake credentials, or hallucinate physical addresses.
--- CLIENT KNOWLEDGE BASE ---
${clientBrain}
--- END KNOWLEDGE BASE ---`,
            prompt: `
Client Context:
Name: ${client.name}
Niche: ${client.niche}

SEO Strategy Context:
Target Intent: ${strategy.targetIntent}
LSI Keywords: ${strategy.lsiKeywords.join(', ')}
Page Angle: ${strategy.pageAngle}
City: ${cityId}

Component to Write:
Type: ${sectionType}

Write the content data for this component.`
          });

          // 6. Stitching
          const componentHtml = renderComponent(sectionType, parsedJson, client);
          finalContentBlocks.push(componentHtml);
          console.log(`[WriterWorker] Component ${index + 1} written and stitched successfully.`);

        } catch (error: any) {
          console.error(`[WriterWorker] Component ${sectionType} failed drastically:`, error);
          // Graceful fallback: Push placeholder and continue
          finalContentBlocks.push(`<!-- Fallback placeholder for failed component: ${sectionType} -->`);
          continue;
        }

        // Rate Limiting Delay
        await new Promise(resolve => setTimeout(resolve, 2100));
      }

      // 7. Database Commit
      console.log(`[WriterWorker] Assembly loop complete. Committing to database...`);
      const stitchedHtml = finalContentBlocks.join('\n');
      const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const metaDescription = `Looking for ${keyword} in ${cityId}? ${client.name} provides expert ${client.niche} solutions. ${strategy.pageAngle}`;

      const finalPageHtml = generateFullPageHtml(client, stitchedHtml, {
        keyword,
        city: cityId,
        metaDescription,
        slug
      });

      const generatedPage = await prisma.generatedPage.create({
        data: {
          clientId,
          slug,
          title: keyword,
          contentJson: finalPageHtml,
          status: 'DRAFT',
        },
      });

      console.log(`[WriterWorker] Job ${job.id} completed successfully. Saved GeneratedPage ID: ${generatedPage.id}`);

      console.log(`[WriterWorker] Handoff -> Adding job to auditorQueue for Quality Control...`);
      await auditorQueue.add('auditPage', {
        pageId: generatedPage.id,
        clientId,
        strategy,
      });

      return { success: true, pageId: generatedPage.id };
    } catch (error) {
      console.error(`[WriterWorker] Error processing job ${job.id}:`, error);
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

writerWorker.on('completed', (job) => {
  console.log(`[WriterWorker] Job ${job.id} has completed successfully!`);
});

writerWorker.on('failed', (job, err) => {
  console.error(`[WriterWorker] Job ${job?.id} has failed with error: ${err.message}`);
});
