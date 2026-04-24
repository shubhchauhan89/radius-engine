import 'dotenv/config';
import express, { Request, Response } from 'express';
import { strategyQueue } from './queue/setup.js';
import { prisma } from './lib/prisma.js';
import { generateFullPageHtml, PageData } from './lib/layoutBuilder.js';

// Import all BullMQ workers to initialize them
import './workers/ingestionWorker.js';
import './workers/strategyWorker.js';
import './workers/outlineWorker.js';
import './workers/writerWorker.js';
import './workers/auditorWorker.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface GenerateClusterRequest {
  clientId: string;
  cityIds: string[];
  keywords: string[];
}

app.post('/api/generate-cluster', async (req: Request, res: Response): Promise<void> => {
  const { clientId, cityIds, keywords } = req.body as GenerateClusterRequest;

  if (!clientId || !Array.isArray(cityIds) || !Array.isArray(keywords)) {
    res.status(400).json({ error: 'Invalid payload. Ensure clientId is a string and cityIds/keywords are arrays.' });
    return;
  }

  let jobsQueued = 0;

  try {
    // Iterate through cityIds and keywords combinations
    for (const cityId of cityIds) {
      for (const keyword of keywords) {
        // Add job to strategyQueue
        await strategyQueue.add('generate', { clientId, cityId, keyword });
        jobsQueued++;
      }
    }

    res.status(202).json({
      message: `Successfully queued ${jobsQueued} strategy generation jobs.`,
      jobsQueued,
    });
  } catch (error) {
    console.error('[Server] Error adding jobs to strategyQueue:', error);
    res.status(500).json({ error: 'Failed to queue cluster generation jobs.' });
  }
});

// ---------------------------------------------------------------------------
// Hub Endpoint — delivers the auto-updating Location Hub directory
// ---------------------------------------------------------------------------
app.get('/v1/hub', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header.' });
      return;
    }

    const apiKey = authHeader.split(' ')[1];
    const client = await prisma.client.findFirst({
      where: { apiKey }
    });

    if (!client) {
      res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
      return;
    }

    const pages = await prisma.generatedPage.findMany({
      where: {
        clientId: client.id,
        status: 'PUBLISHED',
      },
      select: {
        slug: true,
        title: true,
      },
    });

    const linkHtml = pages.map(p => 
      `<a href="/locations/${p.slug}" class="block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
         <h3 class="text-xl font-bold text-gray-900 mb-2">${p.title}</h3>
         <p class="text-sm font-medium" style="color: ${client.primaryColor}">View Service Area &rarr;</p>
       </a>`
    ).join('');

    const hubHtml = `
      <section class="py-16 sm:py-24 my-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center" data-aos="fade-up">
          <h1 class="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">Our Service Areas</h1>
          <p class="text-xl text-gray-500 mb-16 max-w-2xl mx-auto">Explore our specialized services across multiple locations. We are proud to serve these communities with top-tier solutions.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            ${linkHtml || '<p class="text-gray-500 text-center col-span-full">No published locations found.</p>'}
          </div>
        </div>
      </section>
    `;

    const pageData: PageData = {
      keyword: 'Our Service Areas',
      city: 'All Locations',
      metaDescription: 'Browse our complete directory of service areas and locations.',
      slug: ''
    };

    const finalHtml = generateFullPageHtml(client, hubHtml, pageData);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(finalHtml);
  } catch (error) {
    console.error('[Server] Error generating Hub page:', error);
    res.status(500).json({ error: 'Internal server error while generating Hub page.' });
  }
});

// ---------------------------------------------------------------------------
// Serving Endpoint — delivers published pages to client edge proxies
// ---------------------------------------------------------------------------
app.get('/v1/serve', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header.' });
      return;
    }

    const apiKey = authHeader.split(' ')[1];

    const client = await prisma.client.findFirst({
      where: { apiKey }
    });

    if (!client) {
      res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
      return;
    }

    // 2. Extract the requested path & derive the slug
    const requestedPath = req.query.path as string | undefined;

    if (!requestedPath) {
      res.status(400).json({ error: 'Missing required query parameter: path' });
      return;
    }

    // Slug is the last segment of the path, e.g. /locations/noida-crm → noida-crm
    const segments = requestedPath.replace(/^\/+|\/+$/g, '').split('/');
    const slug = segments[segments.length - 1];

    if (!slug) {
      res.status(400).json({ error: 'Could not extract slug from path.' });
      return;
    }

    // 3. Query for a published page matching this slug
    const page = await prisma.generatedPage.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        clientId: client.id,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found.' });
      return;
    }

    // 4. Return the content as HTML
    // contentJson stores the rendered HTML string (or an object with an html key)
    const html = typeof page.contentJson === 'string'
      ? page.contentJson
      : (page.contentJson as Record<string, unknown>).html ?? JSON.stringify(page.contentJson);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('[Server] Error serving page:', error);
    res.status(500).json({ error: 'Internal server error while serving page.' });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] API running on port ${PORT}`);
  console.log(`[Server] All BullMQ workers are initialized and listening.`);
});
