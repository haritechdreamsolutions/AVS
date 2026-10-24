export function driverUnitPrice(product, unit) {
  if (!product || product.is_active === false || product.is_active === 0) throw new Error('Product is unavailable. Return to the bill and refresh products.');
  const requested = String(unit || '').toLowerCase();
  const base = String(product.base_unit || '').toLowerCase();
  const selling = String(product.selling_unit || '').toLowerCase();
  if (!requested || ![base, selling].includes(requested)) throw new Error('Product unit changed. Return to the bill and select the product again.');
  const value = requested === base ? product.piece_selling_price : product.unit_selling_price;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) throw new Error('Product selling price is not configured. Contact the owner.');
  return Number(value);
}

export function reviewDriverPrices(bill, products) {
  if (!Array.isArray(products) || !Array.isArray(bill?.items) || bill.items.length === 0) throw new Error('Unable to verify bill prices. Return to the bill and refresh products.');
  const byId = new Map(products.map(product => [String(product.id), product]));
  let changed = false;
  let totalPaise = 0;
  const items = bill.items.map(item => {
    const rate = driverUnitPrice(byId.get(String(item.product_id)), item.unit_type);
    const quantity = Number(item.qty);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Sale quantity must be a positive whole number');
    const linePaise = quantity * Math.round(rate * 100);
    totalPaise += linePaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise > 9999999999) throw new Error('Invoice total exceeds supported range');
    if (Number(item.rate) !== rate) changed = true;
    return { ...item, rate, amount: linePaise / 100 };
  });
  const total = totalPaise / 100;
  if (Number(bill.total_amount) !== total) changed = true;
  return { changed, bill: { ...bill, items, total_amount: total } };
}
