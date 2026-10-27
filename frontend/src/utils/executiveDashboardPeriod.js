const DAY_MS = 86400000;
const IST_OFFSET_MS = 19800000;
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});

export const dashboardBusinessDay = (now = new Date()) => formatter.format(now);

export function dashboardDateRange(period = 'TODAY', now = new Date()) {
  const today = dashboardBusinessDay(now);
  const calendar = new Date(`${today}T00:00:00Z`);
  const dateText = (value) => value.toISOString().slice(0,10);
  if (period === 'YESTERDAY') {
    const yesterday = dateText(new Date(calendar.getTime() - DAY_MS));
    return {start:yesterday,end:yesterday};
  }
  if (period === 'THIS_WEEK') return {start:dateText(new Date(calendar.getTime() - 7 * DAY_MS)),end:today};
  if (period === 'THIS_MONTH') return {start:today.slice(0,7) + '-01',end:today};
  return {start:today,end:today};
}

export function millisecondsToDashboardMidnight(now = new Date()) {
  const today = dashboardBusinessDay(now);
  return new Date(`${today}T00:00:00Z`).getTime() + DAY_MS - IST_OFFSET_MS - now.getTime();
}

export function dashboardSaleDate(sale) {
  for (const value of [sale.sale_date,sale.date]) {
    if (typeof value !== 'string') continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10);
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value.split('-').reverse().join('-');
  }
  const created = sale.created_at && new Date(sale.created_at);
  return created && !isNaN(created.getTime()) ? dashboardBusinessDay(created) : '';
}

export function dashboardPeriodSales(sales, range) {
  return sales.filter(sale => {
    if (!sale || String(sale.status || '').toUpperCase() === 'CANCELLED') return false;
    const day = dashboardSaleDate(sale);
    return day && day >= range.start && day <= range.end;
  });
}
