import assert from 'node:assert/strict';
import { quantityFromWholePieces } from '../unitHelper.js';

for (const [pieces, piecesPerUnit] of [[1, 3], [2, 6], [5, 12], [1, 72], [144, 72], [0, 12], ['5', '12']]) {
  const sellingUnits = quantityFromWholePieces(pieces, piecesPerUnit);
  assert.ok(Math.abs(sellingUnits * piecesPerUnit - pieces) < 1e-9);
  assert.ok(Math.abs(sellingUnits * piecesPerUnit - Math.round(sellingUnits * piecesPerUnit)) <= 0.000001,
    'Converted quantities must pass the existing allocation whole-piece guard');
}

for (const pieces of [1.5, -1, NaN, Infinity, 'invalid', null, '', true, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => quantityFromWholePieces(pieces, 3), /whole operational pieces/);
}
for (const piecesPerUnit of [0, -1, 1.5, NaN, Infinity, 'invalid', null, '', true, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => quantityFromWholePieces(1, piecesPerUnit), /whole operational pieces/);
}
console.log('PASS: whole-piece allocation preserves exact quantities for fractional selling units.');
