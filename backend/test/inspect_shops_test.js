import { query } from '../db_pg.js';

async function inspectRoutesAndShops() {
  console.log('--- 1. ROUTES COLUMNS ---');
  const routeCols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'routes'
    ORDER BY ordinal_position;
  `);
  console.log(routeCols.rows);

  console.log('\n--- 2. ALL ROUTES ---');
  const routes = await query(`SELECT * FROM routes ORDER BY id;`);
  console.log(routes.rows);

  console.log('\n--- 3. ALL COMPANIES ---');
  const companies = await query(`SELECT * FROM companies ORDER BY id;`);
  console.log(companies.rows);

  process.exit(0);
}

inspectRoutesAndShops().catch(err => {
  console.error(err);
  process.exit(1);
});
