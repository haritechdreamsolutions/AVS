import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_g8sM9wfnCIKk@ep-silent-cloud-axul0kye.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('Connecting to Neon PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully to Neon DB!');

    const sqlPath = path.join(__dirname, '../setup_database_postgres.sql');
    console.log(`Reading SQL file from: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing database schema and seed data...');
    await client.query(sql);
    console.log('🎉 Neon Database initialized successfully with all tables, constraints, and seed data!');
  } catch (err) {
    console.error('❌ Error initializing Neon database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
