/** Owner catalogue ordering only; billing/stock ordering is unchanged. */
export function ownerProductRank(product) {
 const name=[product.display_name,product.name].filter(Boolean).join(' ').toLowerCase();
 const category=String(product.category_name||product.category||'').toLowerCase();
 const text=name+' '+String(product.pack_size||'').toLowerCase();
 const amount=text.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(ml|ltr|litres?|liters?|l|kg|g)\b/i);
 const volume=amount ? Number(amount[1])*(['l','ltr','litre','litres','liter','liters','kg'].includes(amount[2])?1000:1) : null;
 const butter=/butter\s*milk/.test(name)||/butter\s*milk/.test(category);
 const curd=name.includes('curd')||category.includes('curd');
 const milk=!butter&&!curd&&(name.includes('milk')||category.includes('milk')||/\b(fcm|tm)\b/.test(name));
 const water=/water|aqua/.test(name+' '+category);
 if(water)return volume===300?200:volume===500?210:volume===1000?220:230;
 if(butter)return volume===200?90:volume===500?100:105;
 if(milk&&volume===200)return 10;
 if(curd&&volume===200)return 20;
 if(milk&&volume===500&&/\btm\b|toned/.test(name))return 50;
 if(milk&&volume===500)return 30;
 if(curd&&volume===500)return 40;
 if(milk&&volume===1000)return 60;
 if(curd&&volume===100)return 70;
 if(curd&&volume>=1000)return 80;
 if(milk||curd)return 110;
 // Remaining drinks/new products stay before water, which is always last.
 return 120;
}
export function sortOwnerProducts(products) {
 return [...(products||[])].sort((a,b)=>ownerProductRank(a)-ownerProductRank(b)||
 String(a.display_name||a.name||'').localeCompare(String(b.display_name||b.name||''))||
 String(a.id||'').localeCompare(String(b.id||''),undefined,{numeric:true}));
}
