const iso = date => date.toISOString().slice(0,10);
export function routeSalesDates(period, now = new Date()) {
 const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(now);
 const end = new Date(`${today}T00:00:00Z`), start = new Date(end);
 if(period==='yesterday'){start.setUTCDate(start.getUTCDate()-1);return {from:iso(start),to:iso(start)};}
 if(period==='week')start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
 if(period==='month')start.setUTCDate(1);
 return {from:iso(start),to:iso(end)};
}
