import { normalizeQuantity } from './unitHelper.js';

const numeric = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== ''
  ? Number(value) : NaN;
const id = value => Number.isSafeInteger(numeric(value)) && numeric(value) > 0;
const closedStatuses = new Set(['CLOSED', 'COMPLETED', 'RETURN_VERIFIED', 'RECONCILED']);

// Use the complete expected-return response, never declared or guessed counts.
export function prepareOwnerReturn(driver, expected) {
  const driverId = numeric(driver.driver_id ?? driver.employee_id);
  const sessionId = numeric(expected?.session?.id);
  if (expected?.success === false || !id(driverId) || !id(sessionId) ||
      numeric(expected?.driver?.id) !== driverId ||
      (driver.session_id != null && numeric(driver.session_id) !== sessionId)) {
    throw new Error(expected?.message || 'Unable to verify the driver and working session. Refresh the list.');
  }
  if (closedStatuses.has(String(expected.session.status).toUpperCase())) return null;
  if (!Array.isArray(expected.products) || !expected.products.length) throw new Error('No expected return products are available.');
  const seen = new Set();
  const items = expected.products.map(product => {
    const productId = numeric(product.product_id);
    if (!id(productId) || seen.has(productId)) throw new Error('Invalid or duplicate expected return product. Refresh the list.');
    seen.add(productId);
    const unit = product.operational_unit;
    const quantity = numeric(product.expected_return);
    const piecesPerUnit = numeric(product.pieces_per_unit);
    if (typeof unit !== 'string' || !unit.trim() || typeof product.is_piece_based !== 'boolean' ||
        (product.unit != null && product.unit !== unit) || !Number.isFinite(quantity) || quantity < 0 ||
        (product.is_piece_based && (unit !== 'Piece' || !Number.isSafeInteger(quantity) || !id(piecesPerUnit)))) {
      throw new Error('Expected return quantity or units are unavailable. Refresh the list.');
    }
    return {
      product_id: productId, product_name: product.product_name, category_name: product.category_name,
      expected_quantity: quantity, unit, is_piece_based: product.is_piece_based,
      pieces_per_unit: piecesPerUnit,
      allow_trays: product.is_piece_based && product.selling_unit?.toLowerCase() === 'tray'
    };
  });
  return { ...driver, driver_id: driverId, session_id: sessionId, verification_key: `${driverId}:${sessionId}`, items };
}

export function buildOwnerReturnPayload(record, counts = {}, units = {}, shortageReason = '') {
  if (!id(record?.driver_id) || !id(record?.session_id) || !Array.isArray(record.items) || !record.items.length) {
    throw new Error('A complete expected return and working session are required.');
  }
  const seen = new Set();
  let hasShortage = false;
  const items = record.items.map(product => {
    const pid = numeric(product.product_id);
    if (!id(pid) || seen.has(pid)) throw new Error('Invalid or duplicate expected return product.');
    seen.add(pid);
    const quantity = numeric(counts[pid]);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`Enter a valid physical quantity for ${product.product_name || `product #${pid}`} (enter 0 if none returned).`);
    }
    const unit = units[pid] ?? product.unit;
    if (unit !== product.unit && !(product.allow_trays && unit === 'Tray')) throw new Error('Incorrect physical return unit.');
    const physical = product.is_piece_based && unit === 'Tray' ? quantity * product.pieces_per_unit : quantity;
    if (product.is_piece_based && (!Number.isSafeInteger(Math.round(physical)) || Math.abs(physical - Math.round(physical)) > 0.000001)) {
      throw new Error('Physical returns must correspond to whole pieces.');
    }
    const operational = product.is_piece_based ? Math.round(physical) : normalizeQuantity(physical);
    if (!Number.isFinite(operational)) throw new Error('Physical return quantity is outside the supported numeric range.');
    if (operational < product.expected_quantity) hasShortage = true;
    return { product_id: pid, actual_quantity: quantity, unit };
  });
  if ([...Object.keys(counts), ...Object.keys(units)].some(key => !seen.has(numeric(key)))) {
    throw new Error('Unknown return product. Refresh the list.');
  }
  const reason = shortageReason.trim();
  if (hasShortage && !reason) throw new Error('Enter a shortage reason when physical quantities are below expected.');
  return {
    acceptance_mode: 'manual', driver_id: numeric(record.driver_id), employee_id: numeric(record.driver_id),
    session_id: numeric(record.session_id), shortage_reason: reason, items
  };
}
