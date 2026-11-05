export function normalizePrintSettings(value={},fallback='58mm'){
 const paperWidth=Number(value.paperWidth||parseFloat(fallback));
 if(!Number.isFinite(paperWidth)||paperWidth<40||paperWidth>120)throw Error('Paper width must be 40–120mm');
 const printableWidth=Number(value.printableWidth||({58:48,80:72,110:104}[paperWidth]||paperWidth-6));
 if(!Number.isFinite(printableWidth)||printableWidth<30||printableWidth>paperWidth)throw Error('Printable width must fit the paper');
 return {paperWidth,printableWidth,fontSize:Math.min(16,Math.max(10,Number(value.fontSize)||12)),transport:value.transport==='bluetooth'?'bluetooth':'system'};
}
export const printSettingsKey=user=>'avs:printer:v1:'+String(user?.company_id||'')+':'+String(user?.id||'guest');
export function loadPrintSettings(user,fallback){
 try{return normalizePrintSettings(JSON.parse(localStorage.getItem(printSettingsKey(user)))||{},fallback);}
 catch{return normalizePrintSettings({},fallback);}
}
