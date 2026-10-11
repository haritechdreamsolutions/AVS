/**
 * Single Source of Truth for Product Operational Units & Reconciliation Precision
 */

export const RECONCILIATION_EPSILON = 0.001;

/**
 * Returns the operational unit configuration for any product based on category/packaging.
 * Rule:
 *  - Tray packaging/category -> operational unit is 'Piece' (strictly integer-based pieces)
 *  - All other packaging (Case, Bag, Box, etc.) -> operational unit is configured selling unit
 */
export function getOperationalUnit(product, category = null) {
  const catName = (category?.name || product?.category_name || product?.category || '').trim().toLowerCase();
  const catOpUnit = (category?.operational_unit || product?.category_operational_unit || product?.operational_unit || '').trim();
  const sellUnit = (product?.selling_unit || product?.unit || '').trim().toLowerCase();
  const baseUnit = (product?.base_unit || '').trim().toLowerCase();
  const pkgType = (product?.package_type || '').trim().toLowerCase();
  const prodName = (product?.name || product?.display_name || '').trim().toLowerCase();

  const isMilkOrCurd = catName.includes('milk') || catName.includes('curd') || prodName.includes('milk') || prodName.includes('curd') || prodName.includes('mailk');
  const isTrayPackaging = (catName === 'tray' || sellUnit === 'tray' || pkgType === 'tray');
  const isExplicitPiece = catOpUnit.toLowerCase() === 'piece' || baseUnit === 'piece';

  // Rule: Milk, Curd, Tray-packaged items, or explicit Piece-operational items operate in Pieces
  if (isMilkOrCurd || isTrayPackaging || (isExplicitPiece && (sellUnit === 'tray' || !sellUnit || isTrayPackaging))) {
    const piecesPerUnit = Math.max(1, Number(product?.pieces_per_unit || 1));
    const packagingUnit = (product?.selling_unit && product.selling_unit.toLowerCase() !== 'piece') 
      ? (product.selling_unit.charAt(0).toUpperCase() + product.selling_unit.slice(1)) 
      : 'Tray';

    return {
      operationalUnit: 'Piece',
      isPieceBased: true,
      displayUnit: 'Piece',
      bundleUnit: packagingUnit,
      packagingUnit: packagingUnit,
      piecesPerPackagingUnit: piecesPerUnit,
      label: 'Piece',
      pluralLabel: 'Pieces'
    };
  }

  // Rule: Category / Product operational unit for Box, Case, Bag, Bottle, etc.
  const rawUnit = catOpUnit || product?.selling_unit || product?.unit || (catName ? (catName.charAt(0).toUpperCase() + catName.slice(1)) : 'Case');
  const bundleUnit = rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1);
  let pluralLabel = `${bundleUnit}s`;
  if (bundleUnit.toLowerCase() === 'box') {
    pluralLabel = 'Boxes';
  } else if (bundleUnit.endsWith('s') || bundleUnit.endsWith('S')) {
    pluralLabel = bundleUnit;
  }

  const piecesPerUnit = Math.max(1, Number(product?.pieces_per_unit || 1));

  return {
    operationalUnit: bundleUnit,
    isPieceBased: false,
    displayUnit: bundleUnit,
    bundleUnit: bundleUnit,
    packagingUnit: bundleUnit,
    piecesPerPackagingUnit: piecesPerUnit,
    label: bundleUnit,
    pluralLabel
  };
}

/**
 * Normalizes numeric quantity to 4 decimal places without string conversions
 */
export function normalizeQuantity(val) {
  if (val == null || isNaN(val)) return 0;
  return Math.round(Number(val) * 10000) / 10000;
}

/**
 * Robust, tolerance-based reconciliation formula checker:
 *   Allocated = Sold + Damaged + Current Return Stock
 * Absorbs floating-point calculation noise (<= EPSILON) while strictly catching real discrepancies.
 */
export function checkReconciliationEquation(allocated, sold, damaged, currentReturn) {
  const normAlloc = normalizeQuantity(allocated);
  const normSold = normalizeQuantity(sold);
  const normDmg = normalizeQuantity(damaged);
  const normRet = normalizeQuantity(currentReturn);

  const calculated = normalizeQuantity(normSold + normDmg + normRet);
  const rawDiff = normalizeQuantity(normAlloc - calculated);
  const diff = Math.abs(rawDiff);

  const isBalanced = diff <= RECONCILIATION_EPSILON;

  return {
    isBalanced,
    variance: isBalanced ? 0 : rawDiff,
    diff: isBalanced ? 0 : diff,
    allocated: normAlloc,
    sold: normSold,
    damaged: normDmg,
    currentReturn: normRet,
    calculated
  };
}

/**
 * Canonical Warehouse Inventory Stock Formatter.
 * Formats warehouse stock into Tray & Loose Pieces (with total piece count) or Standard Bundle Units.
 */
export function formatWarehouseStock(product) {
  const opUnit = getOperationalUnit(product);
  const ppu = Math.max(1, Number(product?.pieces_per_unit || 1));
  const whUnits = Number(product?.warehouse_stock_units || 0);
  const totalPieces = Math.round(whUnits * ppu);

  if (opUnit.isPieceBased) {
    const unitName = product?.selling_unit || 'Tray';
    if (totalPieces <= 0) {
      return {
        text: `0 ${unitName} (0 Pcs)`,
        isOutOfStock: true,
        totalPieces: 0,
        trays: 0,
        loosePcs: 0,
        units: 0,
        unitLabel: 'Pieces'
      };
    }

    const trays = Math.floor(totalPieces / ppu);
    const loosePcs = totalPieces % ppu;
    let text = '';
    if (trays > 0 && loosePcs > 0) {
      text = `${trays} ${unitName} ${loosePcs} Pcs (${totalPieces} Pcs)`;
    } else if (trays > 0) {
      text = `${trays} ${unitName}${trays > 1 ? 's' : ''} (${totalPieces} Pcs)`;
    } else {
      text = `${loosePcs} Pcs (${totalPieces} Pcs)`;
    }

    return {
      text,
      isOutOfStock: false,
      totalPieces,
      trays,
      loosePcs,
      units: trays,
      unitLabel: 'Pieces'
    };
  } else {
    // Non-tray products (Case, Box, Bag, Bottle): strictly full units only, never pieces
    const wholeUnits = ppu > 1 
      ? Math.floor(totalPieces / ppu) 
      : Math.floor(whUnits);

    const unitName = product?.selling_unit || opUnit.label || 'Case';
    const isPlural = wholeUnits !== 1;
    const label = isPlural && !unitName.endsWith('s') && !unitName.endsWith('S') ? `${unitName}s` : unitName;

    return {
      text: `${wholeUnits} ${label}`,
      isOutOfStock: wholeUnits <= 0,
      totalPieces: wholeUnits,
      trays: 0,
      loosePcs: 0,
      units: wholeUnits,
      unitLabel: label
    };
  }
}

/**
 * Formats driver/employee vehicle stock for card display.
 * For tray/piece-based products: returns `${trays} Trays ${loosePcs} Pcs` (or `${trays} Trays` or `${loosePcs} Pcs`)
 * For other categories: returns `${wholeUnits} ${unitName} ${loosePcs} Pcs` (or `${wholeUnits} ${unitName}`)
 */
export function formatVehicleStockDisplay(item) {
  const opUnit = getOperationalUnit(item);
  const ppu = Math.max(1, Number(item?.pieces_per_unit || 1));
  const totalPieces = Math.round(Number(item?.qty_units || 0) * ppu);

  if (opUnit.isPieceBased) {
    const unitName = item?.selling_unit || 'Tray';
    if (totalPieces <= 0) {
      return {
        breakdownText: `0 ${unitName}`,
        totalPieces: 0,
        trays: 0,
        loosePcs: 0,
        isPieceBased: true,
        unitLabel: item?.base_unit || 'PIECE'
      };
    }
    const trays = Math.floor(totalPieces / ppu);
    const loosePcs = totalPieces % ppu;
    let breakdownText = '';
    if (trays > 0 && loosePcs > 0) {
      breakdownText = `${trays} ${unitName}${trays > 1 ? 's' : ''} ${loosePcs} Pcs`;
    } else if (trays > 0) {
      breakdownText = `${trays} ${unitName}${trays > 1 ? 's' : ''}`;
    } else {
      breakdownText = `${loosePcs} Pcs`;
    }

    return {
      breakdownText,
      totalPieces,
      trays,
      loosePcs,
      isPieceBased: true,
      unitLabel: item?.base_unit ? item.base_unit.toUpperCase() : 'PIECE'
    };
  } else {
    // 2. ALL OTHER CATEGORIES (Case, Box, Bag, Bottle, etc.): strictly full units only, never pieces
    const rawUnits = Number(item?.qty_units || 0);
    const wholeUnits = ppu > 1 
      ? Math.floor(totalPieces / ppu) 
      : Math.floor(rawUnits);

    const unitName = item?.selling_unit || opUnit.label || 'Case';
    const isPlural = wholeUnits !== 1;
    const label = isPlural && !unitName.endsWith('s') && !unitName.endsWith('S') ? `${unitName}s` : unitName;

    return {
      breakdownText: `${wholeUnits} ${label}`,
      totalPieces: wholeUnits,
      units: wholeUnits,
      trays: 0,
      loosePcs: 0,
      isPieceBased: false,
      unitLabel: label.toUpperCase()
    };
  }
}
