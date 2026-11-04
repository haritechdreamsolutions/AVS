// Preserve the received amount. Mixed tray/piece receipts can have different
// unit rates, so their effective rate is shown rather than repricing history.
export function purchaseReportRows(records=[]) {
  return records.map(record=>{
    const qty=Number(record.qty_units),total=Number(record.total_amount),savedRate=Number(record.rate);
    const effective=qty>0&&Math.round(qty*savedRate*100)!==Math.round(total*100);
    let rate=savedRate;
    if(effective){
      for(let decimals=2;decimals<=12;decimals++){
        rate=Number((total/qty).toFixed(decimals));
        if(Math.round(qty*rate*100)===Math.round(total*100))break;
      }
    }
    return {...record,qty,report_rate:rate,effective_rate:effective,total};
  });
}
