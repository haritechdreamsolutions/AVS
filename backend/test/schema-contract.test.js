import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Deliberately do not import pg_pool, dotenv or the application. No DB connections.
const migrationUrl = new URL('../database/migrate.js', import.meta.url);
const runner = await readFile(migrationUrl, 'utf8');
const names = [...runner.match(/const migrations = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const sqls = await Promise.all(names.map(name => readFile(new URL('../database/migrations/' + name, import.meta.url), 'utf8')));
const effective = sqls.join('\n');
const legacy = await Promise.all(['001_foundation.sql', '002_storekeeper.sql', '003_product_uoms.sql'].map(name => readFile(new URL('../database/migrations/' + name, import.meta.url), 'utf8')));

function columns(sql) {
  const tables = new Map();
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? (\w+)\s*\(([\s\S]*?)\n\s*\);/gi)) {
    tables.set(m[1], new Set([...m[2].matchAll(/^\s*(\w+)\s+(?:BIGSERIAL|SERIAL|INTEGER|BIGINT|VARCHAR|TEXT|NUMERIC|BOOLEAN|TIMESTAMPTZ|TIMESTAMP|DATE|JSONB?|INT)\b/gim)].map(c => c[1])));
  }
  for (const m of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN(?: IF NOT EXISTS)? (\w+)/gi)) {
    assert.ok(tables.has(m[1]), 'ALTER references existing table: ' + m[1]);
    tables.get(m[1]).add(m[2]);
  }
  return tables;
}

test('reviewed production order includes product deletion, excludes legacy replay', () => {
  assert.deepEqual(names, ['000_production_baseline.sql', '004_production_hardening.sql', '005_payment_reversals.sql', '006_schema_compatibility.sql', '007_operation_requests.sql', '008_foundation_integrity.sql', '009_product_deletion.sql', '010_protected_administrator.sql']);
});

test('effective chain covers every legacy table/column and backend literal INSERT column', async () => {
  const actual = columns(effective);
  // Combine legacy files before parsing their ALTER statements.
  for (const [table, fields] of columns(legacy.join('\n'))) {
    assert.ok(actual.has(table), table);
    for (const field of fields) assert.ok(actual.get(table).has(field), table + '.' + field);
  }
  for (const file of ['db_pg.js', 'payments.js', 'index.js', 'performance-reports.js']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    for (const m of source.matchAll(/INSERT INTO (\w+)\s*\(([\w,\s]+)\)/gi)) {
      assert.ok(actual.has(m[1]), file + ': ' + m[1]);
      for (const field of m[2].split(',').map(s => s.trim())) assert.ok(actual.get(m[1]).has(field), file + ': ' + m[1] + '.' + field);
    }
  }
});

test('legacy named constraints exist or have explicit hardening equivalents', () => {
  const equivalents = {
    uq_emp_code: 'production_employee_code', uq_ua_login: 'production_user_login',
    uq_es: 'production_employee_stock', uq_sale_bill: 'production_bill_number',
    uq_prod_uom: 'production_product_uom', fk_si_sale: 'production_sale_item_parent',
    fk_es_employee: 'production_stock_employee', fk_es_product: 'production_stock_product',
  };
  for (const m of legacy.join('\n').matchAll(/CONSTRAINT (\w+)/g)) {
    assert.match(effective, new RegExp('\\b' + (equivalents[m[1]] || m[1]) + '\\b'), m[1]);
  }
  for (const rule of ['foundation_account_status', 'foundation_assignment_status', 'foundation_product_prices', 'foundation_expense_amount', 'foundation_movement_type', 'foundation_uom_values', 'production_stock_nonnegative']) assert.ok(effective.includes(rule), rule);
  const integrity = sqls[names.indexOf('008_foundation_integrity.sql')];
  assert.match(integrity, /fk_uom_company/);
  assert.match(integrity, /fk_uom_product/);
  assert.doesNotMatch(integrity, /\b(?:DELETE FROM|UPDATE\s+\w+\s+SET|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sqls.at(-1), /^\s*(?:DELETE FROM|UPDATE\s+\w+\s+SET|DROP|TRUNCATE)\b/im);
  for (const m of legacy[0].matchAll(/CREATE INDEX IF NOT EXISTS (\w+)/g)) {
    if (m[1] === 'idx_sales_date') assert.match(effective, /production_sales_date ON sales\(company_id,sale_date,id\)/);
    else assert.match(effective, new RegExp('CREATE INDEX IF NOT EXISTS ' + m[1] + '\\b'));
  }
  assert.match(integrity, /effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  // New constraints must not replace runtime defaults, precision or invoice sequencing.
  assert.doesNotMatch(sqls.at(-1), /ALTER COLUMN|ALTER SEQUENCE|setval\(/i);
});

function fixture({ fail = false, review = false } = {}) {
  let committed = new Map(), pending;
  const executed = [], calls = [];
  let releases = 0;
  const client = { async query(sql, params) {
    calls.push(sql);
    if (sql === 'BEGIN') pending = new Map(committed);
    if (sql === 'COMMIT') committed = pending;
    if (sql === 'ROLLBACK') pending = undefined;
    if (sql.startsWith('SELECT checksum')) return { rows: pending.has(params[0]) ? [{ checksum: pending.get(params[0]) }] : [] };
    if (sql.startsWith('INSERT INTO schema_migrations')) pending.set(params[0], params[1]);
    if (sqls.includes(sql)) {
      if (fail && sql === sqls.at(-1)) throw new Error('Synthetic 008 failure');
      executed.push(names[sqls.indexOf(sql)]);
    }
    return { rows: [] };
  }, release() { releases++; } };
  const target = { connect: async () => client };
  const context = vm.createContext({ readFile, createHash, URL, pool: target,
    preflight: async () => review ? [{ status: 'REVIEW_REQUIRED', name: 'synthetic' }] : [],
    process: { env: {} } });
  const executable = runner.slice(0, runner.indexOf('\nif (process.argv[1]'))
    .replace(/^import .*;\r?\n/gm, '').replaceAll('export async function', 'async function')
    .replaceAll('import.meta.url', JSON.stringify(migrationUrl.href));
  vm.runInContext(executable + '\nglobalThis.run = migrate;', context);
  return { run: () => context.run(target), executed, calls, committed: () => committed, releases: () => releases };
}

test('runner applies ordered checksummed SQL once and skips it on rerun (fake DB)', async () => {
  const f = fixture();
  await f.run(); await f.run();
  assert.deepEqual(f.executed, names);
  assert.equal(f.committed().size, names.length);
  for (let i = 0; i < names.length; i++) assert.equal(f.committed().get(names[i]), createHash('sha256').update(sqls[i]).digest('hex'));
  assert.equal(f.releases(), 2);
  f.committed().set(names.at(-1), 'tampered');
  await assert.rejects(f.run(), /checksum mismatch/);
  assert.equal(f.calls.at(-1), 'ROLLBACK');
});

test('008 failure rolls back migration records; failed preflight never connects', async () => {
  const f = fixture({ fail: true });
  await assert.rejects(f.run(), /Synthetic 008 failure/);
  assert.equal(f.committed().size, 0);
  assert.equal(f.calls.at(-1), 'ROLLBACK');
  assert.equal(f.releases(), 1);
  const blocked = fixture({ review: true });
  await assert.rejects(blocked.run(), /requires reconciliation/);
  assert.equal(blocked.calls.length, 0);
});

test('optional permissions target the connected database and retain ledger restrictions', async () => {
  const grants = await readFile(new URL('../database/runtime-grants.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(grants, /avs_agencies_db|avs_staging|avs_production/);
  assert.match(grants, /format\('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database\(\)\)/);
  assert.match(grants, /GRANT UPDATE\(status\) ON sales/);
  assert.doesNotMatch(grants, /GRANT (?:ALL|DELETE|UPDATE) ON (?:sales|receipts|stock_transactions)/);
});
