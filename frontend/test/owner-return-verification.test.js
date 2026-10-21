import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { prepareOwnerReturn, buildOwnerReturnPayload } from '../src/utils/ownerReturnVerification.js';

const driver = { driver_id: 7, employee_id: 7, session_id: 9, driver_name: 'Test driver' };
const expected = {
  success: true, driver: { id: 7 }, session: { id: 9, status: 'OPEN' },
  products: [
    { product_id: 3, product_name: 'Milk', operational_unit: 'Piece', unit: 'Piece', is_piece_based: true, selling_unit: 'Tray', pieces_per_unit: 72, expected_return: 18 },
    { product_id: 4, product_name: 'Water', operational_unit: 'Case', unit: 'Case', is_piece_based: false, selling_unit: 'Case', pieces_per_unit: 12, expected_return: 2 }
  ]
};
const record = () => prepareOwnerReturn(driver, structuredClone(expected));
const counts = () => ({ 3: '18', 4: '2' });

test('complete manual return maps exact API field names and entered counts', () => {
  assert.deepEqual(buildOwnerReturnPayload(record(), counts()), {
    acceptance_mode: 'manual', driver_id: 7, employee_id: 7, session_id: 9, shortage_reason: '',
    items: [{ product_id: 3, actual_quantity: 18, unit: 'Piece' }, { product_id: 4, actual_quantity: 2, unit: 'Case' }]
  });
});

test('expected values never initialize physical quantities', () => {
  const r = record();
  assert.ok(r.items.every(item => !Object.hasOwn(item, 'actual_quantity')));
  assert.throws(() => buildOwnerReturnPayload(r), /Enter a valid physical quantity/);
});

for (const value of [undefined, null, '', ' ', '-1', 'NaN', 'Infinity', Infinity, NaN, 'invalid', true, [], {}]) {
  test(`invalid or unentered quantity ${String(value)} cannot submit`, () => {
    assert.throws(() => buildOwnerReturnPayload(record(), { ...counts(), 3: value }), /valid physical quantity/);
  });
}

test('explicit zero is preserved and requires an explanation for a shortage', () => {
  const values = { 3: '0', 4: '0' };
  assert.throws(() => buildOwnerReturnPayload(record(), values), /shortage reason/);
  assert.deepEqual(buildOwnerReturnPayload(record(), values, {}, 'Nothing received').items.map(item => item.actual_quantity), [0, 0]);
});

test('shortages use supplied physical counts and reason without backfilling', () => {
  const payload = buildOwnerReturnPayload(record(), { 3: '17', 4: '1.5' }, {}, 'One piece and half a case missing');
  assert.deepEqual(payload.items.map(item => item.actual_quantity), [17, 1.5]);
  assert.equal(payload.shortage_reason, 'One piece and half a case missing');
});

test('excess counts remain physical quantities and are not capped at expected', () => {
  const payload = buildOwnerReturnPayload(record(), { 3: '20', 4: '3' });
  assert.deepEqual(payload.items.map(item => item.actual_quantity), [20, 3]);
});

test('tray entry preserves quantities and uses pieces for shortage comparison', () => {
  const payload = buildOwnerReturnPayload(record(), { 3: '0.25', 4: '2' }, { 3: 'Tray' });
  assert.deepEqual(payload.items[0], { product_id: 3, actual_quantity: 0.25, unit: 'Tray' });
  assert.throws(() => buildOwnerReturnPayload(record(), { 3: '0.2', 4: '2' }, { 3: 'Tray' }), /whole pieces/);
  assert.throws(() => buildOwnerReturnPayload(record(), { 3: '18.5', 4: '2' }), /whole pieces/);
});

test('incorrect units and unknown products are rejected', () => {
  assert.throws(() => buildOwnerReturnPayload(record(), counts(), { 4: 'Piece' }), /Incorrect.*unit/);
  assert.throws(() => buildOwnerReturnPayload(record(), { ...counts(), 99: '1' }), /Unknown.*product/);
  assert.throws(() => buildOwnerReturnPayload(record(), counts(), { 99: 'Case' }), /Unknown.*product/);
});

test('missing products and duplicate expected product IDs are rejected', () => {
  assert.throws(() => buildOwnerReturnPayload(record(), { 3: '18' }), /valid physical quantity/);
  const r = record();
  r.items.push({ ...r.items[0] });
  assert.throws(() => buildOwnerReturnPayload(r, counts()), /duplicate/);
  const duplicate = structuredClone(expected);
  duplicate.products.push({ ...duplicate.products[0] });
  assert.throws(() => prepareOwnerReturn(driver, duplicate), /duplicate/);
});

test('failed, mismatched and unitless expected responses fail closed', () => {
  assert.throws(() => prepareOwnerReturn(driver, { success: false, message: 'Service unavailable' }), /Service unavailable/);
  assert.throws(() => prepareOwnerReturn({ ...driver, session_id: 10 }, expected), /working session/);
  assert.throws(() => prepareOwnerReturn({ ...driver, driver_id: 8 }, expected), /working session/);
  const invalid = structuredClone(expected);
  delete invalid.products[0].operational_unit;
  assert.throws(() => prepareOwnerReturn(driver, invalid), /units.*unavailable/);
  assert.equal(prepareOwnerReturn(driver, { ...expected, session: { id: 9, status: 'CLOSED' } }), null);
});

// Exercise the actual UI handler and draft updater without React, JSX execution,
// installed packages or a database. Browser rendering is a separate check.
const source = await readFile(new URL('../src/components/Owner/AdminInventoryView.jsx', import.meta.url), 'utf8');
const handlerStart = source.indexOf('  const handleVerifyReturn = async');
const handlerEnd = source.indexOf('  // Process Damage Submission', handlerStart);
const updaterStart = source.indexOf('  const updateReturnDraft =');
const updaterEnd = source.indexOf('  // Storekeeper Return Verification', updaterStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart && updaterStart >= 0 && updaterEnd > updaterStart);

function uiFixture({ response = { success: true }, draft = { counts: counts() }, api } = {}) {
  const r = record();
  const state = { calls: [], errors: [], successes: [], pending: [r], drafts: { [r.verification_key]: draft }, submitting: null, reloads: 0 };
  const lock = { current: false }, completed = { current: new Set() };
  const context = vm.createContext({
    buildOwnerReturnPayload, returnSubmission: lock, completedReturns: completed,
    returnDrafts: state.drafts, currentUser: { name: 'Test owner', role: 'OWNER' },
    setActionError: value => state.errors.push(value), setActionSuccess: value => state.successes.push(value),
    setSubmittingReturnKey: value => { state.submitting = value; },
    setPendingReturnsList: update => { state.pending = update(state.pending); },
    setReturnDrafts: update => { state.drafts = update(state.drafts); context.returnDrafts = state.drafts; },
    verifyDriverReturn: async (...args) => { state.calls.push(args); return api ? api(...args) : response; },
    loadPendingReturnsData: async () => { state.reloads++; }, fetchReconciliation: null,
    loadReconciliationData: async () => {}
  });
  const submit = vm.runInContext(source.slice(handlerStart, handlerEnd) + '\nhandleVerifyReturn', context);
  const update = vm.runInContext(source.slice(updaterStart, updaterEnd) + '\nupdateReturnDraft', context);
  return { r, state, lock, submit, update };
}

test('UI submission sends items instead of legacy products and clears a successful draft', async () => {
  const f = uiFixture();
  await f.submit(f.r);
  assert.deepEqual(f.state.calls[0][0], buildOwnerReturnPayload(f.r, counts()));
  assert.equal(f.state.pending.length, 0);
  assert.equal(Object.keys(f.state.drafts).length, 0);
  assert.ok(f.state.successes.some(message => message.includes('approved')));
  assert.equal(f.lock.current, false);
});

test('UI blocks a missing count before calling the API', async () => {
  const f = uiFixture({ draft: { counts: { 3: '' } } });
  await f.submit(f.r);
  assert.equal(f.state.calls.length, 0);
  assert.match(f.state.errors.at(-1), /valid physical quantity/);
});

test('backend validation errors remain visible and preserve the physical draft for correction', async () => {
  const f = uiFixture({ response: { success: false, message: 'Missing return product #5.' } });
  await f.submit(f.r);
  assert.equal(f.state.errors.at(-1), 'Missing return product #5.');
  assert.deepEqual(f.state.drafts[f.r.verification_key].counts, counts());
  assert.equal(f.state.pending.length, 1);
  assert.equal(f.state.reloads, 0);
  assert.equal(f.lock.current, false);
  assert.equal(f.state.submitting, null);
});

test('network errors release the submission lock without losing entered quantities', async () => {
  const f = uiFixture({ api: async () => { throw new Error('Network unavailable'); } });
  await f.submit(f.r);
  assert.equal(f.state.errors.at(-1), 'Network unavailable');
  assert.equal(f.lock.current, false);
  assert.deepEqual(f.state.drafts[f.r.verification_key].counts, counts());
});

test('duplicate clicks during submission and after success cannot send another request', async () => {
  let finish;
  const f = uiFixture({ api: () => new Promise(resolve => { finish = resolve; }) });
  const first = f.submit(f.r);
  assert.equal(f.lock.current, true);
  assert.equal(f.state.submitting, f.r.verification_key);
  await f.submit(f.r);
  assert.equal(f.state.calls.length, 1);
  finish({ success: true });
  await first;
  await f.submit(f.r);
  assert.equal(f.state.calls.length, 1);
});

test('changing entry units clears the physical count rather than reinterpreting it', () => {
  const f = uiFixture();
  f.update(f.r.verification_key, 'units', 'Tray', 3);
  assert.equal(f.state.drafts[f.r.verification_key].counts[3], '');
  assert.equal(f.state.drafts[f.r.verification_key].counts[4], '2');
  assert.throws(() => buildOwnerReturnPayload(f.r, f.state.drafts[f.r.verification_key].counts, { 3: 'Tray' }), /valid physical quantity/);
});

test('separate numeric return-ID invocation is preserved', async () => {
  const f = uiFixture();
  await f.submit(123);
  assert.equal(f.state.calls[0][0], 123);
  assert.equal(f.state.calls[0][1].verified_by, 'Test owner');
});
