import { query } from '../db_pg.js';

async function applyStockUomFix() {
  console.log('Altering employee_stock, inventory_movements, products, damages columns to NUMERIC(12,4)...');
  await query(`
    ALTER TABLE employee_stock ALTER COLUMN qty_units TYPE NUMERIC(12,4);
    ALTER TABLE inventory_movements ALTER COLUMN qty_units TYPE NUMERIC(12,4);
    ALTER TABLE products ALTER COLUMN warehouse_stock_units TYPE NUMERIC(12,4);
    ALTER TABLE damages ALTER COLUMN qty_units TYPE NUMERIC(12,4);
  `);
  console.log('Successfully altered columns to NUMERIC(12,4).');
  process.exit(0);
}

applyStockUomFix().catch(err => {
  console.error('Error applying migration:', err);
  process.exit(1);
});
