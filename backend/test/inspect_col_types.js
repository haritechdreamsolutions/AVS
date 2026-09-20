import { query } from '../db_pg.js';

async function inspectColumns() {
  const res = await query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('sales', 'sale_items', 'inventory_movements', 'employee_stock', 'products')
    ORDER BY table_name, ordinal_position;
  `);
  console.log('Columns:');
  res.rows.forEach(r => {
    console.log(`${r.table_name}.${r.column_name}: ${r.data_type} (${r.udt_name})`);
  });
  process.exit(0);
}

inspectColumns().catch(err => {
  console.error(err);
  process.exit(1);
});
