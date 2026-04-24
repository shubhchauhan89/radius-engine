import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const query = `
    INSERT INTO "Client" (
      "id",
      "name",
      "domain",
      "niche",
      "target_cities",
      "apiKey",
      "logoUrl",
      "primaryColor",
      "mainWebsiteUrl",
      "contactPhone",
      "subscriptionStatus",
      "generationLimit",
      "pagesGeneratedThisMonth"
    ) VALUES (
      gen_random_uuid(),
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING "id";
  `;
  
  // Adding defaults for domain, niche, and target_cities as they are NOT NULL in schema
  const values = [
    'S2 Logic',
    's2logicsystem.com',
    'Software',
    [],
    'sk_live_test_123',
    'https://placehold.co/200x50/0f172a/white?text=S2+Logic',
    '#2563EB',
    'https://s2logicsystem.com',
    '+91-9876543210',
    'ACTIVE',
    100,
    0
  ];
  
  try {
    const res = await pool.query(query, values);
    console.log('Successfully inserted client with ID:', res.rows[0].id);
  } catch (err) {
    console.error('Error inserting client:', err);
  }
}

run().catch(console.error).finally(() => pool.end());
