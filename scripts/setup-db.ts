import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });
  try {
    await client.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Successfully executed: CREATE EXTENSION IF NOT EXISTS vector;');
  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    await client.end();
  }
}

main();
