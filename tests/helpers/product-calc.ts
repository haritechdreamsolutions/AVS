/**
 * Business Calculation Helper for Products, Invoicing, Returns, and Damage Value
 * Dynamically computes conversions based on product packaging configuration (selling_unit, pieces_per_unit).
 */

export interface ProductConfig {
  id: number;
  product_name: string;
  purchase_price: number;
  sale_price: number;
  selling_unit: string;
  pieces_per_unit: number;
  gst_rate?: number;
}

/**
 * Computes piece cost dynamically from master purchase price and pieces_per_unit.
 */
export function calculatePieceCost(purchasePrice: number, piecesPerUnit: number): number {
  if (!piecesPerUnit || piecesPerUnit <= 0) return purchasePrice;
  return Number((purchasePrice / piecesPerUnit).toFixed(4));
}

/**
 * Computes total damage cost value from damaged units and loose pieces.
 */
export function calculateDamageCost(
  purchasePrice: number,
  piecesPerUnit: number,
  unitsDamaged: number,
  piecesDamaged: number = 0
): number {
  const pieceCost = calculatePieceCost(purchasePrice, piecesPerUnit);
  const totalCost = (unitsDamaged * purchasePrice) + (piecesDamaged * pieceCost);
  return Number(totalCost.toFixed(2));
}

/**
 * Computes invoice line item total with discount and GST.
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
  gstRate: number = 0
): { subtotal: number; discountAmount: number; taxableAmount: number; gstAmount: number; totalAmount: number } {
  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = taxableAmount * (gstRate / 100);
  const totalAmount = taxableAmount + gstAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

/**
 * Validates inventory movement consistency.
 */
export function validateInventoryDeduction(
  initialStock: number,
  deductions: number[],
  inwardAdditions: number[] = []
): number {
  const totalDeductions = deductions.reduce((acc, curr) => acc + curr, 0);
  const totalAdditions = inwardAdditions.reduce((acc, curr) => acc + curr, 0);
  return initialStock - totalDeductions + totalAdditions;
}
