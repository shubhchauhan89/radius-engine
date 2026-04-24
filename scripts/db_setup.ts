import { Client } from 'pg';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: directUrl });
  
  try {
    await client.connect();

    console.log('1. Checking and enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Extension pgvector is active.');

    console.log('\n2. Synchronizing schema via Prisma db push...');
    // Setting environment variables for the child process so Prisma uses DIRECT_URL
    const env = { ...process.env, DATABASE_URL: directUrl };
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env });
    console.log('Schema successfully synchronized.');

    console.log('\n3. Verifying ClientKnowledge table schema...');
    const result = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'ClientKnowledge' AND column_name = 'embedding';
    `);
    console.log('Embedding Column Info:', result.rows);

    console.log('\n4. Inserting Dummy Client...');
    const insertResult = await client.query(`
      INSERT INTO "Client" (id, name, domain, niche, target_cities, "isActive")
      VALUES (gen_random_uuid(), 'S2 Logic Dummy Client', 's2logic.com', 'B2B Web Development', '{"Noida"}', true)
      RETURNING id;
    `);
    
    console.log('Dummy Client inserted successfully! UUID:', insertResult.rows[0]?.id);

  } catch (error) {
    console.error('Error during setup:', error);
  } finally {
    await client.end();
  }
}

main();
