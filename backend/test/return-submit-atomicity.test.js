import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getOperationalUnit, normalizeQuantity } from '../unitHelper.js';

// Execute the production return function with a transactional fake, never a DB.
// No application imports, dotenv, packages or network connections are used.
const source = await readFile(new URL('../db_pg.js', import.meta.url), 'utf8');
const start = source.indexOf('async function verifyAndAcceptDriverReturnAttempt(');
const end = source.indexOf('\nexport async function getDriverReturnHistory', start);
assert.ok(start >= 0 && end > start);
const helpers = source.slice(source.indexOf('export async function query('), source.indexOf('// ====== AUTH ======'))
  .replaceAll('export async function ', 'async function ');

function fixture({ auditFailure = false, status = 'OPEN', pieceBased = false, sessionEmployee = 7, sessionCompany = 1, actorRole = 'STORE_KEEPER', actorCompany = 1, actorActive = true, secondProduct = false } = {}) {
  const calls = [];
  let pending = [], committed = [], releases = 0, inTransaction = false;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === 'BEGIN') { pending = []; inTransaction = true; return { rows: [] }; }
      if (sql === 'COMMIT') { committed.push(...pending); pending = []; inTransaction = false; return { rows: [] }; }
      if (sql === 'ROLLBACK') { pending = []; inTransaction = false; return { rows: [] }; }
      if (sql.startsWith('INSERT INTO audit_logs') && auditFailure) throw new Error('Synthetic audit failure');
      if (/^\s*(UPDATE|INSERT)/.test(sql)) {
        (inTransaction ? pending : committed).push({ sql, params });
        return { rows: sql.includes('INSERT INTO driver_returns') ? [{ id: 55 }] : [] };
      }
      if (sql.includes('FROM user_accounts')) return { rows: actorRole === 'OWNER' && actorCompany === params[1] && actorActive ? [{ id: 1 }] : [] };
      if (sql.includes('FROM employees')) return { rows: [{ id: 7, full_name: 'Synthetic driver' }] };
      if (sql.includes('FROM driver_sessions')) {
        if (sql.includes('WHERE id = $1') && (sessionCompany !== params[1] || (sql.includes('employee_id = $3') && sessionEmployee !== params[2]))) return { rows: [] };
        return { rows: [{ id: 9, employee_id: sessionEmployee, company_id: sessionCompany, session_date: '2026-10-20', status }] };
      }
      if (sql.includes('FROM employee_stock')) return { rows: [{ product_id: 3, qty_units: 2 }] };
      if (sql.includes('FROM sale_items')) return { rows: [{ product_id: 3, sold_units: 7, sold_pieces: 70 }] };
      if (sql.includes('FROM damages')) return { rows: [{ product_id: 3, damaged_qty: 1, damaged_pieces: 10 }] };
      if (sql.includes('FROM stock_transactions')) return { rows: [{ product_id: 3, allocated_qty: 10 }, ...(secondProduct ? [{ product_id: 4, allocated_qty: 1 }] : [])] };
      if (sql.includes('FROM products p')) return { rows: [{ id: params[0], display_name: 'Synthetic product', category_name: pieceBased ? 'Tray' : 'Case', selling_unit: pieceBased ? 'Tray' : 'Case', pieces_per_unit: 10, purchase_price: 50 }] };
      if (sql.includes('FROM sales')) return { rows: [{ total_sales: 700, credit_sales: 0 }] };
      if (sql.includes('FROM expenses')) return { rows: [{ total_expenses: 20 }] };
      throw new Error('Unhandled fake query: ' + sql);
    },
    release() { releases++; }
  };
  const context = vm.createContext({
    pool: { connect: async () => client },
    transactionContext: new AsyncLocalStorage(),
    getOperationalUnit, normalizeQuantity,
    businessDate: () => '2026-10-20',
    cashFlow: async () => ({ cash: 700, gpay: 0 }),
    console: { error() {} }
  });
  const submit = vm.runInContext(helpers + source.slice(start, end) + '\nverifyAndAcceptDriverReturnAttempt', context);
  return {
    calls, submit: data => submit(1, 7, { session_id: 9, items: [{ product_id: 3, unit: pieceBased ? 'Piece' : 'Case', actual_quantity: pieceBased ? 20 : 2 }], ...data }, 1),
    committed: () => committed, releases: () => releases
  };
}

test('audit failure rolls back return stock and session closure', async () => {
  const f = fixture({ auditFailure: true });
  await assert.rejects(f.submit(), /Synthetic audit failure/);
  assert.equal(f.committed().length, 0, 'A failed submission must not leave durable stock/session changes');
  assert.equal(f.releases(), 1);
});

test('balanced return commits stock, ledger, session and audit together', async () => {
  const f = fixture();
  const result = await f.submit();
  assert.equal(result.success, true);
  assert.equal(result.summary.total_returned_units, 2);
  assert.equal(result.summary.total_sales, 700);
  assert.equal(result.summary.net_amount, 680);
  assert.ok(f.committed().some(c => c.sql.startsWith('INSERT INTO audit_logs')));
  assert.equal(f.calls.filter(c => c.sql === 'COMMIT').length, 1);
  assert.equal(f.releases(), 1);
});

test('piece return credits only the converted unsold quantity', async () => {
  const f = fixture({ pieceBased: true });
  const result = await f.submit();
  assert.equal(result.summary.total_returned_units, 2);
  const stock = f.committed().find(c => c.sql.includes('UPDATE products SET warehouse_stock_units'));
  assert.equal(stock.params[0], 2);
  assert.equal(result.summary.items[0].sold_quantity, 70);
  assert.equal(result.summary.items[0].damaged_quantity, 10);
});

test('shortage requires a reason and rejected submissions commit nothing', async () => {
  const f = fixture();
  await assert.rejects(f.submit({ items: [{ product_id: 3, actual_quantity: 1 }] }), /Shortage reason is required/);
  assert.equal(f.committed().length, 0);
});

test('explained shortage preserves existing shortage accounting', async () => {
  const f = fixture();
  const result = await f.submit({ items: [{ product_id: 3, actual_quantity: 1 }], shortage_reason: 'Synthetic missing unit' });
  assert.equal(result.summary.total_returned_units, 1);
  assert.equal(result.summary.total_shortage_units, 1);
  assert.equal(result.summary.total_shortage_cost, 50);
});

test('finalized sessions reject duplicate return submission', async () => {
  const f = fixture({ status: 'CLOSED' });
  await assert.rejects(f.submit(), /already been submitted and finalized/);
  assert.equal(f.committed().length, 0);
});

for (const [name, options] of [
  ['another employee', { sessionEmployee: 8 }],
  ['another company', { sessionCompany: 2 }]
]) {
  test(`return rejects a session belonging to ${name} before stock changes`, async () => {
    const f = fixture(options);
    await assert.rejects(f.submit(), /Active working session not found/);
    assert.equal(f.committed().length, 0);
    assert.ok(!f.calls.some(c => /^\s*(UPDATE|INSERT)/.test(c.sql)));
    assert.equal(f.releases(), 1);
  });
}

test('duplicate product IDs, including numeric strings, cannot credit stock twice', async () => {
  const f = fixture();
  await assert.rejects(f.submit({ items: [
    { product_id: 3, actual_quantity: 2 },
    { product_id: '3', actual_quantity: 2 }
  ] }), /Duplicate return product/);
  assert.equal(f.committed().length, 0);
  assert.ok(!f.calls.some(c => /^\s*(UPDATE|INSERT)/.test(c.sql)));
});

for (const actual_quantity of [-0.00001, 'invalid', NaN, Infinity, '', true]) {
  test(`invalid return quantity ${String(actual_quantity)} is rejected without stock credits`, async () => {
    const f = fixture();
    await assert.rejects(f.submit({ items: [{ product_id: 3, actual_quantity }] }), /Return quantity must be a finite nonnegative number/);
    assert.equal(f.committed().length, 0);
  });
}

test('legitimate excess returns retain the existing warehouse-credit behavior', async () => {
  const f = fixture();
  const result = await f.submit({ items: [{ product_id: 3, actual_quantity: 3 }] });
  assert.equal(result.summary.total_returned_units, 3);
  assert.equal(result.summary.items[0].excess_quantity, 1);
});

test('tray quantities convert into whole physical pieces before crediting stock', async () => {
  const f = fixture({ pieceBased: true });
  const result = await f.submit({ items: [{ product_id: 3, unit: 'Tray', actual_quantity: 2 }] });
  assert.equal(result.summary.total_returned_units, 2);
  assert.equal(result.summary.items[0].physical_return_quantity, 20);
});

async function rejectsWithoutMutations(f, data, message) {
  await assert.rejects(f.submit(data), message);
  assert.equal(f.committed().length, 0);
  assert.ok(!f.calls.some(c => /^\s*(UPDATE|INSERT)/.test(c.sql)));
}

for (const [name, items] of [['omitted', undefined], ['empty', []], ['null', null], ['object', {}], ['string', 'invalid']]) {
  test(`manual mode rejects ${name} items even with legacy products/verified_by`, async () => {
    await rejectsWithoutMutations(fixture(), { items, products: [{ product_id: 3, good_pieces: 20 }], verified_by: 'OWNER' }, /nonempty items array/);
  });
}

test('manual mode requires allocated products even when no held-stock row exists', async () => {
  await rejectsWithoutMutations(fixture({ secondProduct: true }), {}, /Missing return product #4/);
});

test('manual mode rejects products outside the authoritative expected set', async () => {
  await rejectsWithoutMutations(fixture(), { items: [{ product_id: 3, actual_quantity: 2 }, { product_id: 99, actual_quantity: 1 }] }, /Unknown return product #99/);
});

for (const item of [null, [], {}, { product_id: true, actual_quantity: 2 }, { product_id: 0, actual_quantity: 2 }]) {
  test(`manual mode rejects malformed product ${JSON.stringify(item)}`, async () => {
    await rejectsWithoutMutations(fixture(), { items: [item] }, /Valid return product/);
  });
}

for (const actual_quantity of [undefined, null, false, [], {}]) {
  test(`manual mode rejects missing or invalid physical quantity ${JSON.stringify(actual_quantity)}`, async () => {
    await rejectsWithoutMutations(fixture(), { items: [{ product_id: 3, actual_quantity }] }, /Return quantity must be a finite nonnegative number/);
  });
}

test('a later invalid product quantity causes no earlier stock mutations', async () => {
  await rejectsWithoutMutations(fixture({ secondProduct: true }), { items: [{ product_id: 3, actual_quantity: 2 }, { product_id: 4, actual_quantity: -1 }] }, /finite nonnegative number/);
});

test('a later unexplained shortage causes no earlier stock mutations', async () => {
  await rejectsWithoutMutations(fixture({ secondProduct: true }), { items: [{ product_id: 3, actual_quantity: 2 }, { product_id: 4, actual_quantity: 0 }] }, /Shortage reason/);
});

test('manual physical quantities in pieces must represent whole pieces', async () => {
  await rejectsWithoutMutations(fixture({ pieceBased: true }), { items: [{ product_id: 3, unit: 'Piece', actual_quantity: 20.5 }] }, /whole physical pieces/);
});

test('OWNER manual acceptance uses the supplied count and shortage reason', async () => {
  const f = fixture({ actorRole: 'OWNER' });
  const result = await f.submit({ acceptance_mode: 'manual', items: [{ product_id: 3, actual_quantity: 1 }], shortage_reason: 'Physical count short' });
  assert.equal(result.summary.total_returned_units, 1);
  assert.equal(result.summary.total_shortage_units, 1);
});

test('complete manual list accepts explicit zero counts with a shortage reason', async () => {
  const f = fixture({ secondProduct: true });
  const result = await f.submit({ items: [{ product_id: 3, actual_quantity: 2 }, { product_id: 4, actual_quantity: 0 }], shortage_reason: 'None physically received for second product' });
  assert.equal(result.summary.items.length, 2);
  assert.equal(result.summary.total_returned_units, 2);
  assert.equal(result.summary.total_shortage_units, 1);
});

for (const options of [{ actorRole: 'STORE_KEEPER' }, { actorRole: 'DRIVER' }, { actorRole: 'OWNER', actorCompany: 2 }, { actorRole: 'OWNER', actorActive: false }]) {
  test(`automatic mode rejects unauthorized actor ${JSON.stringify(options)}`, async () => {
    await rejectsWithoutMutations(fixture(options), { acceptance_mode: 'accept_expected', confirm_accept_expected: true, items: undefined, role: 'OWNER', verified_by: 'OWNER' }, /active OWNER/);
  });
}

for (const confirm_accept_expected of [undefined, false, 'true', 1]) {
  test(`automatic mode requires explicit boolean confirmation ${String(confirm_accept_expected)}`, async () => {
    await rejectsWithoutMutations(fixture({ actorRole: 'OWNER' }), { acceptance_mode: 'accept_expected', confirm_accept_expected, items: undefined }, /Explicit confirmation/);
  });
}

test('explicit authorized automatic mode accepts expected pieces and all products', async () => {
  const f = fixture({ actorRole: 'OWNER', pieceBased: true, secondProduct: true });
  const result = await f.submit({ acceptance_mode: 'accept_expected', confirm_accept_expected: true, items: undefined });
  assert.equal(result.summary.total_returned_units, 3);
  assert.equal(result.summary.items.length, 2);
  assert.equal(result.summary.items[0].physical_return_quantity, 20);
  assert.equal(result.summary.items[1].physical_return_quantity, 10);
  assert.ok(f.committed().some(c => c.sql.startsWith('INSERT INTO audit_logs')));
});

test('automatic mode rejects conflicting manual quantities', async () => {
  await rejectsWithoutMutations(fixture({ actorRole: 'OWNER' }), { acceptance_mode: 'accept_expected', confirm_accept_expected: true }, /must omit items/);
});

test('unknown acceptance modes cannot bypass manual validation', async () => {
  await rejectsWithoutMutations(fixture(), { acceptance_mode: 'automatic' }, /Invalid return acceptance mode/);
});

test('a later fractional piece count causes no earlier stock mutations', async () => {
  await rejectsWithoutMutations(fixture({ pieceBased: true, secondProduct: true }), { items: [{ product_id: 3, unit: 'Piece', actual_quantity: 20 }, { product_id: 4, unit: 'Piece', actual_quantity: 10.5 }] }, /whole physical pieces/);
});

test('manual case returns reject a misleading piece unit before writes', async () => {
  await rejectsWithoutMutations(fixture(), { items: [{ product_id: 3, unit: 'Piece', actual_quantity: 2 }] }, /operational unit/);
});

test('manual tray fractions representing whole pieces preserve shortage accounting', async () => {
  const f = fixture({ pieceBased: true });
  const result = await f.submit({ items: [{ product_id: 3, unit: 'Tray', actual_quantity: 1.9 }], shortage_reason: 'One physical piece missing' });
  assert.equal(result.summary.total_returned_units, 1.9);
  assert.equal(result.summary.total_shortage_units, 0.1);
  assert.equal(result.summary.total_shortage_cost, 5);
});

const routeSource = await readFile(new URL('../routes.js', import.meta.url), 'utf8');
const routeStart = routeSource.indexOf("router.post(['/sk/driver-returns/verify'");
const routeEnd = routeSource.indexOf("\nrouter.get(['/sk/driver-returns/history'", routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart);
const route = routeSource.slice(routeStart, routeEnd).trim();
const handlerSource = route.slice(route.indexOf('async (req, res) =>'), -2);

async function request(f, body) {
  const handler = vm.runInNewContext('(' + handlerSource + ')', {
    getCid: req => req.session.companyId,
    db: { verifyAndAcceptDriverReturn: (cid, employeeId, data, actorUserId) => {
      assert.equal(cid, 1);
      assert.equal(employeeId, 7);
      assert.equal(actorUserId, 1, 'Actor must come from the server session');
      return f.submit(data);
    } }
  });
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handler({ body: { driver_id: 7, ...body }, session: { companyId: 1, userId: 1 } }, response);
  return response;
}

test('Storekeeper manual API request succeeds with explicit physical items', async () => {
  const response = await request(fixture(), { items: [{ product_id: 3, unit: 'Case', actual_quantity: 2 }] });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.summary.total_returned_units, 2);
});

test('Owner manual API request preserves an explicit physical excess count', async () => {
  const response = await request(fixture({ actorRole: 'OWNER' }), { acceptance_mode: 'manual', items: [{ product_id: 3, actual_quantity: 3 }] });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.summary.total_returned_units, 3);
});

test('API reports forbidden automatic acceptance as HTTP 403 despite forged actor fields', async () => {
  const response = await request(fixture(), { acceptance_mode: 'accept_expected', confirm_accept_expected: true, items: undefined, actorUserId: 99, verified_by: 'OWNER' });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
});

test('API rejects legacy products-only submissions as HTTP 400', async () => {
  const response = await request(fixture({ actorRole: 'OWNER' }), { items: undefined, products: [{ product_id: 3, good_pieces: 20 }] });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test('explicit Owner automatic API request accepts only the server expected quantities', async () => {
  const response = await request(fixture({ actorRole: 'OWNER' }), { acceptance_mode: 'accept_expected', confirm_accept_expected: true, items: undefined });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.summary.total_returned_units, 2);
});
