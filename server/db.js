import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('cbdev-server: DATABASE_URL is required');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('cbdev-server: unexpected DB pool error', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}
