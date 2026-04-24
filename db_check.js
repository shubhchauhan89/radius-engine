import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Client';
  `);
  console.log('Columns in Client table:');
  console.log(res.rows);
}

run().catch(console.error).finally(() => pool.end());
