import { getOperationalUnit } from './unitHelper.js';

// Match the server's configured base/selling unit and direct-counter price rules.
export function getStoreDirectPricing(product) {
  const opUnit = getOperationalUnit(product);
  const unitType = opUnit.isPieceBased
    ? product.base_unit || 'Piece'
    : product.selling_unit || product.base_unit || opUnit.operationalUnit;
  const isBase = unitType.toLowerCase() === String(product.base_unit || 'piece').toLowerCase();
  const direct = Number(product.direct_sale_rate || 0);
  const rate = Number(isBase ? (direct > 0 ? direct : product.piece_selling_price || 0) : product.unit_selling_price || 0);
  const pluralUnit = unitType === 'Box' ? 'Boxes' : unitType.endsWith('s') ? unitType : unitType + 's';
  return {opUnit,unitType,displayUnit:unitType,pluralUnit,rate};
}
