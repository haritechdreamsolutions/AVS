import assert from 'node:assert/strict';
import { quantityFromWholePieces } from '../unitHelper.js';

for (const [pieces, piecesPerUnit] of [[1, 3], [2, 6], [5, 12]]) {
  const sellingUnits = quantityFromWholePieces(pieces, piecesPerUnit);
  assert.ok(Math.abs(sellingUnits * piecesPerUnit - pieces) < 1e-9);
}

assert.throws(() => quantityFromWholePieces(1.5, 3), /whole operational pieces/);
assert.throws(() => quantityFromWholePieces(1, 0), /whole operational pieces/);
console.log('PASS: whole-piece allocation preserves exact quantities for fractional selling units.');
