import { query } from '../db_pg.js';

async function inspectCols() {
  const t = await query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('expenses', 'settlements', 'sales', 'employee_stock')
    ORDER BY table_name, ordinal_position;
  `);
  console.table(t.rows);
  process.exit(0);
}

inspectCols().catch(err => {
  console.error(err);
  process.exit(1);
});
