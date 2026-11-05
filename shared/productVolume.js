// Derive volumes from the saved packaging fields so every role can use the
// same calculation without storing a second, potentially stale conversion.
export function getTrayVolume(product, categoryName = product?.category_name || product?.category) {
  if (String(categoryName || '').trim().toLowerCase() !== 'tray') return null;

  const match = String(product?.pack_size || '').trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(ml|l|ltr|ltrs|litres?|liters?)$/i);
  const pieces = Number(product?.pieces_per_unit);
  if (!match || !Number.isFinite(pieces) || pieces <= 0 || !Number.isInteger(pieces)) return null;

  const pieceMl = Number(match[1]) * (match[2].toLowerCase() === 'ml' ? 1 : 1000);
  const trayLitres = pieceMl * pieces / 1000;
  if (pieceMl <= 0 || !Number.isFinite(trayLitres)) return null;
  return { pieceMl, trayLitres };
}

export const formatLitres = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 6 });

export function getStockLitres(product, trays = 0, pieces = 0) {
  const volume = getTrayVolume(product);
  if (!volume) return null;
  const totalPieces = Math.round(Number(trays || 0) * Number(product.pieces_per_unit) + Number(pieces || 0));
  return totalPieces * volume.pieceMl / 1000;
}
