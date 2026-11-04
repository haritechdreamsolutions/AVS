// Stock receiving follows the configured purchase unit, independently of the
// product/category name. Only trays expose loose-piece entry.
export function purchaseUnit(product) {
  const unit = String(product?.selling_unit || 'Case').trim();
  return {unit, isPieceBased: unit.toLowerCase() === 'tray'};
}
