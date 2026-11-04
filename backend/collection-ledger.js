import {paise} from './financial.js';

// Same FIFO model as shop-balance-receipt: bill-time old_credit_paid is
// already included in sales cash/gpay and already deducted from current_due.
// Apply those recorded payments virtually, without creating duplicate receipts.
export function collectionLedger(opening, invoices) {
  const openingPaise = paise(opening);
  let oldPaid = invoices.reduce((sum, sale) => sum + paise(sale.old_credit_paid), 0);
  const remainingOpening = Math.max(0, openingPaise - oldPaid);
  oldPaid = Math.max(0, oldPaid - openingPaise);
  const entries = invoices.map(sale => {
    const outstanding = paise(sale.credit_paid) - paise(sale.allocated) + paise(sale.refunded);
    if (outstanding < 0) throw new Error('Shop invoice allocations require reconciliation');
    const applied = Math.min(oldPaid, outstanding);
    oldPaid -= applied;
    return {...sale, outstanding: outstanding - applied};
  });
  if (oldPaid) throw new Error('Shop old-credit payments require reconciliation');
  return {
    opening: remainingOpening,
    invoices: entries,
    balance: remainingOpening + entries.reduce((sum, sale) => sum + sale.outstanding, 0)
  };
}
