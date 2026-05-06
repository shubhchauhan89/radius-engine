import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("No API key found. Please set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function main() {
  try {
    console.log("Fetching knowledge chunks where embedding is NULL...");
    const chunks: any[] = await prisma.$queryRaw`SELECT id, "contentChunk" FROM "ClientKnowledge" WHERE embedding IS NULL;`;

    if (chunks.length === 0) {
      console.log("Success: No rows found without embeddings. Exiting.");
      return;
    }

    console.log(`Found ${chunks.length} chunks to process.`);

    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    let count = 0;
    for (const chunk of chunks) {
      count++;
      console.log(`[${count}/${chunks.length}] Generating embedding for chunk ID: ${chunk.id}`);
      
      const result = await embedModel.embedContent({
        content: { role: 'user', parts: [{ text: chunk.contentChunk }] },
        outputDimensionality: 768
      } as any);
      const embeddingValues = result.embedding.values;

      // Format as Postgres vector string: "[0.1, 0.2, ...]"
      const vectorString = `[${embeddingValues.join(',')}]`;

      console.log(`Saving embedding back to database for chunk ID: ${chunk.id}`);
      await prisma.$executeRaw`UPDATE "ClientKnowledge" SET embedding = ${vectorString}::vector WHERE id = ${chunk.id};`;
    }

    console.log("All chunks processed successfully.");

  } catch (error) {
    console.error("An error occurred during embedding generation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
