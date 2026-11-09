// Filter by date before grouping, so each shop appears once in the report.
export function groupRouteSalesByShop(rows) {
 const shops = new Map();
 for (const source of rows) {
  const key = JSON.stringify([source.route_id, source.shop_id ?? [source.village_id, source.shop_name?.trim()]]);
  if (!shops.has(key)) shops.set(key, {...source, date:source.date, endDate:source.date, products:{}, litres:0});
  const target = shops.get(key);
  if (source.date < target.date) target.date = source.date;
  if (source.date > target.endDate) target.endDate = source.date;
  target.litres += Number(source.litres) || 0;
  for (const [id, cell] of Object.entries(source.products)) {
   if (!target.products[id]) target.products[id] = {...cell,qty:0,litres:0};
   target.products[id].qty += Number(cell.qty) || 0;
   target.products[id].litres += Number(cell.litres) || 0;
  }
 }
 return [...shops.values()];
}
