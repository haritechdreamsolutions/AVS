import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, ArrowLeft } from 'lucide-react';

export const A4ReportView = ({ onBack }) => {
  const { companyInfo } = useApp();

  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      
      {/* Printable Control Bar */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 print:hidden shadow-md">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-bold transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg glow-blue transition"
        >
          <Printer className="w-4 h-4" />
          PRINT A4 DAILY REPORT
        </button>
      </div>

      {/* A4 Document Container (Formatted for 210mm x 297mm A4 Paper) */}
      <div className="a4-report bg-white text-black p-8 rounded-xl shadow-2xl space-y-6 font-sans text-xs border border-slate-300">
        
        {/* Document Header */}
        <div className="text-center border-b-2 border-black pb-4">
          <h2 className="text-xl font-black uppercase tracking-wider text-black">DAILY BUSINESS SALES REPORT</h2>
          <h3 className="text-base font-black text-blue-900 mt-1 uppercase">{companyInfo?.name || 'AVS DISTRIBUTORS'}</h3>
          <p className="text-[10px] text-gray-600 font-bold">{companyInfo?.subtitle || 'Distribution Management System'} | {companyInfo?.address || 'Salem, Tamil Nadu'}</p>

          <div className="flex justify-between items-center text-[11px] font-bold mt-4 pt-2 border-t border-gray-300">
            <span>Date: {todayStr}</span>
            <span>Route: All Active Routes</span>
            <span>Employees: 7 Active</span>
          </div>
        </div>

        {/* Executive Summary Table */}
        <div className="space-y-2">
          <h4 className="font-extrabold text-xs uppercase tracking-wider border-b border-black pb-1">1. FINANCIAL SUMMARY</h4>
          <table className="w-full text-left border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="p-2 border-r border-black font-extrabold">Particulars</th>
                <th className="p-2 text-right font-extrabold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">Total Gross Sales</td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">1,24,500</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black">Cash Collection</td>
                <td className="p-2 text-right font-mono font-bold text-blue-700">72,500</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black">GPay / UPI Collection</td>
                <td className="p-2 text-right font-mono font-bold text-indigo-700">42,000</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black">Credit Sales (Dues)</td>
                <td className="p-2 text-right font-mono font-bold text-amber-700">10,000</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black">Total Expenses & Damage</td>
                <td className="p-2 text-right font-mono font-bold text-rose-600">14,600</td>
              </tr>
              <tr className="bg-gray-100 font-black text-sm">
                <td className="p-2 border-r border-black">Net Operating Collection</td>
                <td className="p-2 text-right font-mono text-emerald-800">1,09,900</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Product Wise Sales Table */}
        <div className="space-y-2">
          <h4 className="font-extrabold text-xs uppercase tracking-wider border-b border-black pb-1">2. PRODUCT WISE SALES BREAKDOWN</h4>
          <table className="w-full text-left border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-extrabold">
                <th className="p-2 border-r border-black">Product Name</th>
                <th className="p-2 border-r border-black text-center">Unit</th>
                <th className="p-2 border-r border-black text-right">Quantity Sold</th>
                <th className="p-2 text-right">Total Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">200ml Milk</td>
                <td className="p-2 border-r border-black text-center">Tray</td>
                <td className="p-2 border-r border-black text-right font-mono font-bold">120</td>
                <td className="p-2 text-right font-mono font-bold">58,250</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">Water Bottle 1L</td>
                <td className="p-2 border-r border-black text-center">Tray</td>
                <td className="p-2 border-r border-black text-right font-mono font-bold">80</td>
                <td className="p-2 text-right font-mono font-bold">32,600</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">Coccola 500ml</td>
                <td className="p-2 border-r border-black text-center">Box</td>
                <td className="p-2 border-r border-black text-right font-mono font-bold">60</td>
                <td className="p-2 text-right font-mono font-bold">23,850</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">Recharge Card</td>
                <td className="p-2 border-r border-black text-center">Pack</td>
                <td className="p-2 border-r border-black text-right font-mono font-bold">200</td>
                <td className="p-2 text-right font-mono font-bold">9,800</td>
              </tr>
              <tr className="bg-gray-100 font-black">
                <td className="p-2 border-r border-black">Total</td>
                <td className="p-2 border-r border-black"></td>
                <td className="p-2 border-r border-black text-right font-mono">460 Units</td>
                <td className="p-2 text-right font-mono text-emerald-800">1,24,500</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Employee Wise Summary Table */}
        <div className="space-y-2">
          <h4 className="font-extrabold text-xs uppercase tracking-wider border-b border-black pb-1">3. EMPLOYEE FLEET PERFORMANCE</h4>
          <table className="w-full text-left border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-extrabold">
                <th className="p-1.5 border-r border-black">Employee Executive</th>
                <th className="p-1.5 border-r border-black text-center">Bills</th>
                <th className="p-1.5 border-r border-black text-right">Sales (₹)</th>
                <th className="p-1.5 border-r border-black text-right">Collection (₹)</th>
                <th className="p-1.5 border-r border-black text-right">Expenses (₹)</th>
                <th className="p-1.5 text-right">Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-black font-bold">Tharun (TN 32 XX 2222)</td>
                <td className="p-1.5 border-r border-black text-center font-mono">42</td>
                <td className="p-1.5 border-r border-black text-right font-mono font-bold">38,250</td>
                <td className="p-1.5 border-r border-black text-right font-mono">37,900</td>
                <td className="p-1.5 border-r border-black text-right font-mono text-red-600">4,100</td>
                <td className="p-1.5 text-right font-mono font-bold">33,800</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-black font-bold">Kumar (TN 32 AB 1234)</td>
                <td className="p-1.5 border-r border-black text-center font-mono">35</td>
                <td className="p-1.5 border-r border-black text-right font-mono font-bold">34,600</td>
                <td className="p-1.5 border-r border-black text-right font-mono">34,600</td>
                <td className="p-1.5 border-r border-black text-right font-mono text-red-600">2,800</td>
                <td className="p-1.5 text-right font-mono font-bold">31,800</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-black font-bold">Suresh (TN 32 CD 5678)</td>
                <td className="p-1.5 border-r border-black text-center font-mono">31</td>
                <td className="p-1.5 border-r border-black text-right font-mono font-bold">28,300</td>
                <td className="p-1.5 border-r border-black text-right font-mono">28,100</td>
                <td className="p-1.5 border-r border-black text-right font-mono text-red-600">1,900</td>
                <td className="p-1.5 text-right font-mono font-bold">26,200</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-black font-bold">Mani (TN 32 BF 9012)</td>
                <td className="p-1.5 border-r border-black text-center font-mono">28</td>
                <td className="p-1.5 border-r border-black text-right font-mono font-bold">23,350</td>
                <td className="p-1.5 border-r border-black text-right font-mono">23,000</td>
                <td className="p-1.5 border-r border-black text-right font-mono text-red-600">1,200</td>
                <td className="p-1.5 text-right font-mono font-bold">21,800</td>
              </tr>
              <tr className="bg-gray-100 font-black">
                <td className="p-1.5 border-r border-black">Total Fleet Summary</td>
                <td className="p-1.5 border-r border-black text-center font-mono">136</td>
                <td className="p-1.5 border-r border-black text-right font-mono">1,24,500</td>
                <td className="p-1.5 border-r border-black text-right font-mono">1,23,600</td>
                <td className="p-1.5 border-r border-black text-right font-mono">10,000</td>
                <td className="p-1.5 text-right font-mono text-emerald-800">1,13,600</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="flex justify-between pt-12 text-[10px] font-bold text-center">
          <div className="w-36 border-t border-black pt-1">Prepared By (Store Keeper)</div>
          <div className="w-36 border-t border-black pt-1">Audited By (Accountant)</div>
          <div className="w-36 border-t border-black pt-1">Approved By (Owner Sign)</div>
        </div>

      </div>
    </div>
  );
};
