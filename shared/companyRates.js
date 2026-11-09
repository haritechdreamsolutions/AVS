// Legacy imports sometimes stored computed rates (e.g. 822 / 24) with many
// decimals. Round only those saved rates; new monetary input stays strict.
export function savedCompanyMoney(value) {
 const text=String(value??0).trim();
 if(!/^\d+(?:\.\d+)?$/.test(text))throw Error('Stored company purchase rate is invalid. Edit this product rate.');
 const [whole,fraction='']=text.split('.');
 let cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
 if((fraction[2]||'0')>='5')cents++;
 if(cents>9999999999n)throw Error('Amount exceeds supported range');
 return Number(cents)/100;
}
export function savedCompanyRates(value) {
 const rate=value&&typeof value==='object'?value:{tray_rate:value};
 return {...rate,tray_rate:savedCompanyMoney(rate.tray_rate??rate.rate??0),
 ...(rate.piece_rate===undefined||rate.piece_rate===''||rate.piece_rate===null?{}:{piece_rate:savedCompanyMoney(rate.piece_rate)})};
}
