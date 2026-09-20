import { query } from '../db_pg.js';

async function setupVillages() {
  console.log('--- Setting up Villages Schema in PostgreSQL ---');
  
  await query(`
    CREATE TABLE IF NOT EXISTS villages (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_village_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT uq_village_code UNIQUE (company_id, code)
    );
  `);
  console.log('✅ villages table created / verified');

  await query(`
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS village_id INTEGER REFERENCES villages(id) ON DELETE SET NULL;
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8,2) DEFAULT 0.00;
  `);
  console.log('✅ village_id and distance_km added to shops');

  // No dummy villages seeded - villages must start empty
  console.log('✅ Schema ready - 0 default villages');
  process.exit(0);
}

setupVillages().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
