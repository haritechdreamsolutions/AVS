import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Utility to format currency in Indian Rupee format for PDF rendering
 */
const formatINR = (val) => {
  const num = Number(val || 0);
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Adds standard company header to any PDF report
 */
const addReportHeader = (doc, title, periodText, companyInfo = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent line
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(companyInfo.name || 'AVS AGENCIES', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('AVS MANAGEMENT SYSTEM • EXECUTIVE PORTAL', 14, 17);
  doc.text(companyInfo.address || 'Villupuram, Tamil Nadu • Phone: +91 98765 43210', 14, 22);

  // Report Title & Period badge on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(165, 180, 252); // indigo-200
  doc.text(`Period: ${periodText}`, pageWidth - 14, 18, { align: 'right' });

  const printTime = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${printTime}`, pageWidth - 14, 23, { align: 'right' });

  return 36; // Next Y cursor position
};

/**
 * Adds page numbering footer to all pages of the document
 */
const addPageFooters = (doc) => {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Top border of footer
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    doc.text('AVS Agencies • Confidential Executive Management Report', 14, pageHeight - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
  }
};

/**
 * 1. OWNER / ADMIN EXECUTIVE DASHBOARD MASTER PDF REPORT
 */
export const generateOwnerExecutivePDFReport = async ({
  period = 'TODAY',
  dateRangeText = '',
  kpis = {},
  dashboardData = {},
  expenses = [],
  damages = [],
  missingRecords = [],
  recentSales = [],
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const periodLabel = dateRangeText || period.replace(/_/g, ' ');

  let currentY = addReportHeader(doc, 'Executive Management Report', periodLabel, companyInfo);

  // --- SECTION 1: EXECUTIVE FINANCIAL SUMMARY KPI CARDS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Executive Financial Summary', 14, currentY);
  currentY += 4;

  const grossSales = Number(kpis.gross_sales || 0);
  const cashCol = Number(kpis.cash_collected || 0);
  const gpayCol = Number(kpis.gpay_collected || 0);
  const creditCol = Number(kpis.credit_issued || 0);
  const opExp = Number(kpis.expenses || 0);
  const dmgCost = Number(kpis.damage_loss || 0);
  const cogsCost = Number(kpis.cogs || 0);
  const netProfit = Number(kpis.net_profit || (grossSales - cogsCost - opExp - dmgCost));
  const profitMargin = kpis.profit_margin_pct || (grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : 0);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Metric', 'Amount (INR)', 'Metric', 'Amount (INR)']],
    body: [
      ['Gross Sales', formatINR(grossSales), 'Cost of Goods Sold (COGS)', formatINR(cogsCost)],
      ['Cash Collected', formatINR(cashCol), 'Operating Expenses', formatINR(opExp)],
      ['GPay / UPI Collected', formatINR(gpayCol), 'Damage / Wastage Loss', formatINR(dmgCost)],
      ['Credit / Dues Issued', formatINR(creditCol), 'Net Operating Profit', `${formatINR(netProfit)} (${profitMargin}%)`]
    ],
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'right', cellWidth: 42, fontStyle: 'bold', textColor: [5, 150, 105] },
      2: { fontStyle: 'bold', cellWidth: 50 },
      3: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // --- SECTION 2: PAYMENT MODES BREAKDOWN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Payment Collection Modes', 14, currentY);
  currentY += 3;

  const totalCollected = cashCol + gpayCol + creditCol;
  const cashPct = totalCollected > 0 ? ((cashCol / totalCollected) * 100).toFixed(1) : '0.0';
  const gpayPct = totalCollected > 0 ? ((gpayCol / totalCollected) * 100).toFixed(1) : '0.0';
  const creditPct = totalCollected > 0 ? ((creditCol / totalCollected) * 100).toFixed(1) : '0.0';

  autoTable(doc, {
    startY: currentY,
    theme: 'striped',
    head: [['Payment Mode', 'Collected Amount', 'Share (%)', 'Status']],
    body: [
      ['Cash Settlement', formatINR(cashCol), `${cashPct}%`, 'Direct Cash In Hand'],
      ['GPay / Digital UPI', formatINR(gpayCol), `${gpayPct}%`, 'Bank Settled'],
      ['Credit / Shop Dues', formatINR(creditCol), `${creditPct}%`, 'Accounts Receivable / Outstanding'],
      ['Total Billings', formatINR(totalCollected), '100.0%', 'Reconciled Gross Inflow']
    ],
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { textColor: [100, 116, 139] }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // --- SECTION 3: DRIVER EXPENSES (If records exist) ---
  if (expenses && expenses.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`3. Driver Expenses Breakdown (${expenses.length} Records)`, 14, currentY);
    currentY += 3;

    const totalExpAmt = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenseRows = expenses.map(e => [
      e.driver_name || e.employee_name || 'Driver',
      e.employee_code || 'EMP',
      e.vehicle_number || 'N/A',
      e.route_name || 'Direct',
      e.category || 'General',
      formatINR(e.amount || 0),
      e.title || e.notes || '—',
      e.recorded_by_name || 'Storekeeper',
      e.expense_date ? String(e.expense_date).slice(0, 10) : (e.created_at ? String(e.created_at).slice(0, 10) : 'Today'),
      e.session_id ? `S-${e.session_id}` : 'Direct'
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      head: [['Driver', 'Emp Code', 'Vehicle', 'Route', 'Category', 'Amount', 'Description', 'Recorded By', 'Date', 'Session']],
      body: expenseRows,
      foot: [['Total Driver Expenses', '', '', '', '', formatINR(totalExpAmt), '', '', '', '']],
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // --- SECTION 4: DAMAGE PIECES (If records exist) ---
  if (damages && damages.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`4. Damaged Stock & Transit Wastage (${damages.length} Records)`, 14, currentY);
    currentY += 3;

    const totalDmgPieces = damages.reduce((s, d) => s + Number(d.base_quantity ?? d.qty_units ?? 0), 0);
    const damageRows = damages.map(d => [
      d.driver_name || d.employee_name || 'Driver',
      d.employee_code || 'EMP',
      d.vehicle_number || 'N/A',
      d.route_name || 'Direct',
      d.product_name || 'Product',
      `${d.base_quantity ?? d.qty_units ?? 0} ${d.damage_unit || d.unit || 'Pieces'}`,
      d.reason || 'Damaged',
      d.verified_by_name || 'Storekeeper',
      d.session_date ? String(d.session_date).slice(0, 10) : (d.created_at ? String(d.created_at).slice(0, 10) : 'Today'),
      d.session_id ? `S-${d.session_id}` : 'Direct'
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      head: [['Driver', 'Emp Code', 'Vehicle', 'Route', 'Product', 'Damage Qty', 'Reason', 'Recorded By', 'Date', 'Session']],
      body: damageRows,
      foot: [['Total Damaged Pieces', '', '', '', '', `${totalDmgPieces} Pieces`, '', '', '', '']],
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [225, 29, 72], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        5: { halign: 'center', fontStyle: 'bold' },
        9: { halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // --- SECTION 5: MISSING PIECES & SHORTAGE RECONCILIATION ---
  if (missingRecords && missingRecords.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`5. Missing Stock Reconciliation (${missingRecords.length} Items)`, 14, currentY);
    currentY += 3;

    const totalMissing = missingRecords.reduce((s, r) => s + Number(r.missing_quantity ?? r.shortage_quantity ?? 0), 0);
    const missingRows = missingRecords.map(r => [
      r.driver_name || 'Driver',
      r.vehicle_number || 'N/A',
      r.route_name || 'Direct',
      r.product_name || 'Product',
      r.allocated_quantity ?? 0,
      r.sold_quantity ?? 0,
      r.damaged_quantity ?? 0,
      r.expected_quantity ?? 0,
      r.actual_quantity ?? 0,
      `${r.missing_quantity ?? 0} ${r.unit || 'Pcs'}`,
      r.status || 'MISSING',
      r.storekeeper_name || 'Storekeeper',
      r.return_no || (r.session_id ? `S-${r.session_id}` : 'RET')
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      head: [['Driver', 'Vehicle', 'Route', 'Product', 'Alloc', 'Sold', 'Dmg', 'Expected', 'Actual', 'Missing', 'Status', 'Storekeeper', 'Return #']],
      body: missingRows,
      foot: [['Total Physical Shortage', '', '', '', '', '', '', '', '', `${totalMissing} Pieces`, '', '', '']],
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 6.5, textColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [217, 119, 6], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        9: { halign: 'center', fontStyle: 'bold', textColor: [180, 83, 9] },
        10: { halign: 'center', fontStyle: 'bold', textColor: [225, 29, 72] }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // --- SECTION 6: RECENT BILLING & SALES TRANSACTIONS ---
  if (recentSales && recentSales.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`6. Recent Invoices & Billing Feed (${Math.min(recentSales.length, 15)} Records)`, 14, currentY);
    currentY += 3;

    const salesRows = recentSales.slice(0, 15).map(s => [
      s.invoice_no || s.bill_no || `INV-${s.id}`,
      s.shop_name || s.customer_name || 'AVS DIRECT',
      s.route_name || 'Main Route',
      s.employee_name || (s.is_store_direct_sale ? 'Store Keeper' : 'Driver'),
      formatINR(s.total_amount || s.amount || 0),
      s.payment_mode || 'CASH',
      s.sale_date ? String(s.sale_date).slice(0, 10) : (s.created_at ? String(s.created_at).slice(0, 10) : 'Today')
    ]);

    autoTable(doc, {
      startY: currentY,
      theme: 'striped',
      head: [['Invoice #', 'Shop / Customer', 'Route', 'Billed By', 'Total Amount', 'Payment Mode', 'Date']],
      body: salesRows,
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
        5: { halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Apply page numbering footers to all pages
  addPageFooters(doc);

  // Trigger automatic download
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Executive_Report_${period}_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * 2. DRIVER EXPENSES DEDICATED PDF REPORT
 */
export const generateDriverExpensesPDFReport = async ({
  expenses = [],
  period = 'ALL',
  dateRangeText = '',
  selectedDriverName = 'All Drivers',
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodLabel = dateRangeText || period.replace(/_/g, ' ');
  let currentY = addReportHeader(doc, 'Driver Expenses Report', `${periodLabel} • Driver: ${selectedDriverName}`, companyInfo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Driver Expense Transactions (${expenses.length} Records)`, 14, currentY);
  currentY += 4;

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const rows = expenses.map(e => [
    e.driver_name || e.employee_name || 'Driver',
    e.employee_code || 'EMP',
    e.vehicle_number || 'N/A',
    e.route_name || 'Direct',
    e.category || 'General',
    formatINR(e.amount || 0),
    e.title || e.notes || '—',
    e.recorded_by_name || 'Storekeeper',
    e.expense_date ? String(e.expense_date).slice(0, 10) : (e.created_at ? String(e.created_at).slice(0, 10) : 'Today'),
    e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    e.session_id ? `SESSION-${e.session_id}` : 'DIRECT'
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Driver Name', 'Emp Code', 'Vehicle #', 'Route', 'Category', 'Amount', 'Description / Note', 'Recorded By', 'Date', 'Time', 'Session ID']],
    body: rows,
    foot: [['Total Expenses', '', '', '', '', formatINR(totalAmount), '', '', '', '', '']],
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' },
      10: { halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  addPageFooters(doc);
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Driver_Expenses_Report_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * 3. DAMAGE PIECES DEDICATED PDF REPORT
 */
export const generateDamagePiecesPDFReport = async ({
  damages = [],
  period = 'ALL',
  dateRangeText = '',
  selectedDriverName = 'All Drivers',
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodLabel = dateRangeText || period.replace(/_/g, ' ');
  let currentY = addReportHeader(doc, 'Damage Pieces Report', `${periodLabel} • Driver: ${selectedDriverName}`, companyInfo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Damage Log Entries (${damages.length} Records)`, 14, currentY);
  currentY += 4;

  const totalPieces = damages.reduce((s, d) => s + Number(d.base_quantity ?? d.qty_units ?? 0), 0);
  const rows = damages.map(d => [
    d.driver_name || d.employee_name || 'Driver',
    d.employee_code || 'EMP',
    d.vehicle_number || 'N/A',
    d.route_name || 'Direct',
    d.product_name || 'Product',
    `${d.base_quantity ?? d.qty_units ?? 0} ${d.damage_unit || d.unit || 'Pieces'}`,
    d.reason || 'Damaged',
    d.notes || '—',
    d.verified_by_name || 'Storekeeper',
    d.session_date ? String(d.session_date).slice(0, 10) : (d.created_at ? String(d.created_at).slice(0, 10) : 'Today'),
    d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    d.session_id ? `SESSION-${d.session_id}` : 'DIRECT'
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Driver Name', 'Emp Code', 'Vehicle #', 'Route', 'Product Name', 'Damage Qty', 'Reason', 'Notes', 'Recorded By', 'Date', 'Time', 'Session ID']],
    body: rows,
    foot: [['Total Damaged Stock', '', '', '', '', `${totalPieces} Pieces`, '', '', '', '', '', '']],
    headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [225, 29, 72], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
      11: { halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  addPageFooters(doc);
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Damage_Pieces_Report_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * 4. MISSING PIECES DEDICATED PDF REPORT
 */
export const generateMissingPiecesPDFReport = async ({
  missingRecords = [],
  period = 'ALL',
  dateRangeText = '',
  selectedDriverName = 'All Drivers',
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodLabel = dateRangeText || period.replace(/_/g, ' ');
  let currentY = addReportHeader(doc, 'Missing Pieces Reconciliation Report', `${periodLabel} • Driver: ${selectedDriverName}`, companyInfo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Reconciled Stock Shortages (${missingRecords.length} Records)`, 14, currentY);
  currentY += 4;

  const totalMissing = missingRecords.reduce((s, r) => s + Number(r.missing_quantity ?? r.shortage_quantity ?? 0), 0);
  const rows = missingRecords.map(r => [
    r.driver_name || 'Driver',
    r.employee_code || 'EMP',
    r.vehicle_number || 'N/A',
    r.route_name || 'Direct',
    r.product_name || 'Product',
    r.allocated_quantity ?? 0,
    r.sold_quantity ?? 0,
    r.damaged_quantity ?? 0,
    r.expected_quantity ?? 0,
    r.actual_quantity ?? 0,
    `${r.missing_quantity ?? 0} ${r.unit || 'Pieces'}`,
    r.status || 'MISSING',
    r.shortage_reason || '—',
    r.storekeeper_name || 'Storekeeper',
    r.date || (r.created_at ? String(r.created_at).slice(0, 10) : 'Today'),
    r.return_no || (r.session_id ? `S-${r.session_id}` : 'RET')
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Driver Name', 'Emp Code', 'Vehicle', 'Route', 'Product', 'Alloc', 'Sold', 'Dmg', 'Expected', 'Actual', 'Missing Qty', 'Status', 'Shortage Reason', 'Storekeeper', 'Date', 'Return #']],
    body: rows,
    foot: [['Total Missing Shortage', '', '', '', '', '', '', '', '', '', `${totalMissing} Pieces`, '', '', '', '', '']],
    headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [217, 119, 6], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      10: { halign: 'center', fontStyle: 'bold', textColor: [180, 83, 9] },
      11: { halign: 'center', fontStyle: 'bold', textColor: [225, 29, 72] }
    },
    margin: { left: 14, right: 14 }
  });

  addPageFooters(doc);
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Missing_Pieces_Report_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * 5. SALES RECORDS PDF REPORT
 */
export const generateSalesRecordsPDFReport = async ({
  sales = [],
  period = 'ALL',
  dateRangeText = '',
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodLabel = dateRangeText || period.replace(/_/g, ' ');
  let currentY = addReportHeader(doc, 'Sales Invoices & Billing Report', periodLabel, companyInfo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Sales Transactions (${sales.length} Bills)`, 14, currentY);
  currentY += 4;

  const totalRevenue = sales.reduce((s, b) => s + Number(b.grand_total || b.total_amount || 0), 0);
  const totalReceived = sales.reduce((s, b) => s + Number(b.received_amount || 0), 0);
  const totalBalance = sales.reduce((s, b) => s + Number(b.balance_amount || 0), 0);

  const rows = sales.map(b => [
    b.bill_number || `BILL-${b.id}`,
    b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : 'Today',
    b.shop_name || 'Counter Sale',
    b.seller_name || b.driver_name || 'Staff',
    b.payment_mode || 'CASH',
    b.payment_status || 'PAID',
    formatINR(b.grand_total || b.total_amount || 0),
    formatINR(b.received_amount || 0),
    formatINR(b.balance_amount || 0)
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Bill Number', 'Date', 'Customer / Shop', 'Sold By', 'Payment Mode', 'Status', 'Total (INR)', 'Received (INR)', 'Balance (INR)']],
    body: rows,
    foot: [['Total Sales', '', '', '', '', '', formatINR(totalRevenue), formatINR(totalReceived), formatINR(totalBalance)]],
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [16, 185, 129], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] }
    },
    margin: { left: 14, right: 14 }
  });

  addPageFooters(doc);
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Sales_Report_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * 6. INVENTORY & WAREHOUSE STOCK PDF REPORT
 */
export const generateInventoryPDFReport = async ({
  inventory = [],
  companyInfo = {}
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let currentY = addReportHeader(doc, 'Warehouse Inventory & Stock Valuation Report', 'Current Live Stock', companyInfo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Warehouse Inventory Catalog (${inventory.length} SKUs)`, 14, currentY);
  currentY += 4;

  const totalStockQty = inventory.reduce((s, item) => s + Number(item.stock_quantity ?? item.current_stock ?? 0), 0);
  const totalValuation = inventory.reduce((s, item) => {
    const qty = Number(item.stock_quantity ?? item.current_stock ?? 0);
    const price = Number(item.base_unit_price ?? item.price ?? item.selling_price ?? 0);
    return s + (qty * price);
  }, 0);

  const rows = inventory.map(item => {
    const stock = Number(item.stock_quantity ?? item.current_stock ?? 0);
    const alloc = Number(item.allocated_quantity ?? 0);
    const price = Number(item.base_unit_price ?? item.price ?? item.selling_price ?? 0);
    const valuation = stock * price;

    return [
      item.product_name || item.name || 'Product',
      item.product_code || item.sku || 'SKU',
      item.category || 'General',
      item.base_unit || item.unit || 'Piece',
      stock,
      alloc,
      formatINR(price),
      formatINR(valuation),
      stock <= 10 ? 'LOW STOCK' : 'IN STOCK'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Product Name', 'SKU / Code', 'Category', 'Unit', 'Warehouse Stock', 'Driver Allocated', 'Unit Price (INR)', 'Stock Valuation (INR)', 'Status']],
    body: rows,
    foot: [['Total Inventory', '', '', '', `${totalStockQty} Units`, '', '', formatINR(totalValuation), '']],
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  addPageFooters(doc);
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `AVS_Warehouse_Inventory_Report_${dateSlug}.pdf`;
  doc.save(filename);
  return filename;
};
