// Shop and driver delivery use the same catalogue pricing policy.
// Only Tray-category stock is counted as pieces; other categories sell whole units.
export function getCatalogueSalePricing(product) {
  const category = String(product.category_name || product.category || '').trim().toLowerCase();
  const isTray = category ? category === 'tray' : ['tray','piece'].includes(String(product.selling_unit || '').toLowerCase());
  const unitType = isTray ? product.base_unit || 'Piece' : product.selling_unit || product.base_unit || 'Case';
  return {unitType,isTray,rate:Number((isTray ? product.piece_selling_price : product.unit_selling_price) || 0)};
}
