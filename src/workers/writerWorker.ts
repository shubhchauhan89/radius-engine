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
          headline: z.string().max(100).optional().default("").describe("A compelling, keyword-rich H2 headline strictly tailored to the client's specific industry and target audience as defined in the Client Brain Context."),
          subheadline: z.string().max(200).optional().default("").describe("An engaging subheadline that builds authority tailored to the specific industry. No generic filler."),
          body: z.string().max(800).optional().default("").describe("2-3 short, highly readable sentences integrating the LSI keywords naturally. Tailored to the client's industry. NO run-on sentences."),
          ctaText: z.string().max(60).optional().default("").describe("Action-oriented call-to-action text suitable for the industry (e.g., 'Request Quote', 'Book Now')"),
          paragraphs: z.array(z.string().max(400)).max(5).optional().default([]).describe("An array of highly readable paragraphs integrating the LSI keywords. Max 3 sentences per paragraph. Max 5 paragraphs total."),
          items: z.array(z.object({
            title: z.string().max(100).optional().default("").describe("A short, specific title for the service, problem, or FAQ item"),
            description: z.string().max(400).optional().default("").describe("2-3 short, highly readable sentences integrating the LSI keywords naturally. Tailored to the industry context. NO run-on sentences.")
          })).max(6).optional().default([])
        });

        try {
          const { object: parsedJson } = await generateObject({
            model: google('gemini-3.1-flash-lite-preview'),
            schema: ComponentSchema,
            // @ts-ignore - explicitly requested by user, bypass TS definition mismatch
            maxTokens: 4000,
            temperature: 0.3,
            system: `You are an elite, chameleon-like copywriter. Before writing a single word, analyze the 'Client Brain Context'. Instantly adopt the precise tone, vocabulary, and formatting standards of that specific industry. If the context is B2B manufacturing, be highly technical, authoritative, and corporate. If the context is B2C local services, be approachable, empathetic, and consumer-focused.
Do not use generic marketing filler. Avoid phrases like 'elevate your brand', 'unlock your potential', or 'paradigm shift' regardless of the industry.
Write in short, punchy, highly readable sentences. ABSOLUTE MAXIMUM of 3 sentences per paragraph. Do NOT write run-on sentences.
You MUST seamlessly integrate every provided LSI keyword in the text. Distribute them naturally. Do not stuff them all into one sentence.
Do NOT stuff the city or neighborhood name into every sentence. Use it naturally a maximum of 1 or 2 times per component.
Base your facts strictly on the Client Brain Context.

Brevity Rule: NEVER generate more than 3 to 5 items for any list, service array, or FAQ section. Prioritize quality over quantity. Do not repeat yourself.

Provide engaging copy tailored to the requested component type.
When generating content for the faq component, provide detailed questions and answers. When generating the services component, provide items. When generating the seoArticle component, write highly readable paragraphs (max 3 sentences each) rich in LSI keywords.
For the seoArticle component, you must prove local authority without overstuffing. Using your internal knowledge of the requested city, seamlessly weave in 1 or 2 hyper-local geographic entities. Mention specific major highways, local business parks, or prominent commercial landmarks relevant to the city. Do not use generic phrases like "in the downtown area." Use exact local names.

If the provided 'SEO Keywords' request a specific sub-niche, geography, or service that is NOT explicitly mentioned in the 'Client Brain Context', DO NOT PANIC and DO NOT hallucinate fake credentials. You must bridge the gap smoothly. 
Example Framework: 'While our core expertise is rooted in [Core Client Context], our foundational infrastructure and methods are perfectly equipped to handle [Requested SEO Keyword].'

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
