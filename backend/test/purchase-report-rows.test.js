import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseReportRows} from '../../frontend/src/utils/purchaseReport.js';
test('report uses saved unit rate when qty x rate matches the original amount',()=>{
 const [row]=purchaseReportRows([{id:1,qty_units:'50',rate:'250',total_amount:'12500'}]);
 assert.equal(row.effective_rate,false);assert.equal(row.report_rate,250);assert.equal(Math.round(row.qty*row.report_rate*100),1250000);
});
test('mixed tray/piece receipts preserve original totals with an identified average rate',()=>{
 const [row]=purchaseReportRows([{id:2,qty_units:'1.16666667',rate:'120',total_amount:'142'}]);
 assert.equal(row.effective_rate,true);assert.equal(row.total,142);assert.equal(Math.round(row.qty*row.report_rate*100),14200);
});
test('fractional tray rounding retains the original purchase rate and paise total',()=>{
 const [row]=purchaseReportRows([{id:3,qty_units:'10.13888889',rate:'1200',total_amount:'12166.67'}]);
 assert.equal(row.effective_rate,false);assert.equal(Math.round(row.qty*row.report_rate*100),1216667);
});
