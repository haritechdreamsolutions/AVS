import { query } from '../db_pg.js';

async function resetShops() {
  console.log('=== 1. CHECKING ALL FOREIGN KEYS AND REFERENCES TO SHOPS ===');
  const allFks = await query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_name = 'shops';
  `);
  console.log('Foreign keys referencing shops:', allFks.rows);

  console.log('\n=== 2. CHECKING DEFAULT ROUTE FOR SHOPS ===');
  const routes = await query(`SELECT id, code, name FROM routes WHERE company_id = 1 ORDER BY id ASC LIMIT 5;`);
  console.log('Available routes:', routes.rows);
  const defaultRouteId = routes.rows.length > 0 ? routes.rows[0].id : null;

  console.log('\n=== 3. EXECUTING CLEANUP OF OLD SHOPS ===');
  // First update sales.shop_id to NULL where necessary so no FK constraint violation occurs
  await query(`UPDATE sales SET shop_id = NULL WHERE shop_id IS NOT NULL;`);
  
  // Delete all existing shop records
  const deleteRes = await query(`DELETE FROM shops WHERE company_id = 1 RETURNING id;`);
  console.log(`Deleted ${deleteRes.rows.length} existing shops.`);

  console.log('\n=== 4. INSERTING THE EXACT 3 SPECIFIED SHOPS: Hari, Mani, Tharun ===');
  const shopData = [
    { name: 'Hari', owner_name: 'Hari', code: 'SHP-001', phone: '9876543210', address: 'Main Bazaar, Puducherry' },
    { name: 'Mani', owner_name: 'Mani', code: 'SHP-002', phone: '9876543211', address: 'East Coast Road, Villupuram' },
    { name: 'Tharun', owner_name: 'Tharun', code: 'SHP-003', phone: '9876543212', address: 'Town Hall Road, Cuddalore' }
  ];

  const createdShops = [];
  for (const s of shopData) {
    const res = await query(`
      INSERT INTO shops (
        company_id, route_id, code, name, owner_name, phone, address, 
        is_active, current_due, credit_limit, opening_balance, has_freezer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 0.00, 5000.00, 0.00, FALSE)
      RETURNING *;
    `, [1, defaultRouteId, s.code, s.name, s.owner_name, s.phone, s.address]);
    createdShops.push(res.rows[0]);
  }

  console.log('\n=== 5. VERIFYING FINAL SHOPS TABLE ===');
  const finalShops = await query(`
    SELECT id, company_id, route_id, code, name, owner_name, phone, address, is_active, current_due, credit_limit
    FROM shops
    WHERE company_id = 1
    ORDER BY id ASC;
  `);
  console.log(`Total shops in DB: ${finalShops.rows.length}`);
  console.log(finalShops.rows);

  process.exit(0);
}

resetShops().catch(err => {
  console.error('Error resetting shops:', err);
  process.exit(1);
});
