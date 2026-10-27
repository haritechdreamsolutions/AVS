export const isWholePackageUnit = (unit) => ['box', 'case'].includes(String(unit || '').toLowerCase());

const withDerivedRate = (form) => ({
  ...form,
  piece_selling_price: Number((Number(form.unit_selling_price || 0) / Math.max(1, Number(form.pieces_per_unit || 1))).toFixed(2))
});

export function applyProductSellingUnit(form, unit) {
  if (isWholePackageUnit(unit)) {
    const bulkUnit = unit.toLowerCase() === 'box' ? 'Box' : 'Case';
    return withDerivedRate({ ...form, base_unit: bulkUnit, selling_unit: bulkUnit,
      buy_rate_uom: bulkUnit, selling_rate_uom: bulkUnit, pieces_per_unit: 1 });
  }
  const updated = { ...form, selling_unit: unit, buy_rate_uom: unit, selling_rate_uom: unit };
  if (unit === 'Tray' && isWholePackageUnit(form.base_unit)) {
    updated.base_unit = 'Piece';
    updated.pieces_per_unit = 72;
  }
  return withDerivedRate(updated);
}

export function applyProductCategory(form, category) {
  if (!category) return { ...form, category_id: '', category: '' };
  const updated = { ...form, category_id: category.id, category: category.name };
  const name = String(category.name || '').trim().toLowerCase();
  const unit = String(category.operational_unit || 'Piece').trim().toLowerCase();
  const isMilk = name.includes('milk'), isCurd = name.includes('curd');
  // Milk/curd and Tray retain their piece-based packaging. Box/Case take
  // precedence over the legacy default 'Piece' category setting.
  if (!isMilk && !isCurd && name !== 'tray') {
    if (name === 'box' || unit === 'box') return applyProductSellingUnit(updated, 'Box');
    if (name === 'case' || unit === 'case') return applyProductSellingUnit(updated, 'Case');
  }
  if (isMilk || isCurd || name === 'tray' || unit === 'piece') {
    return withDerivedRate({ ...updated, base_unit: 'Piece', selling_unit: 'Tray',
      buy_rate_uom: 'Tray', selling_rate_uom: 'Tray',
      pieces_per_unit: isCurd ? 30 : isMilk ? 72 : form.selling_unit === 'Tray' ? form.pieces_per_unit : 72 });
  }
  return updated;
}
