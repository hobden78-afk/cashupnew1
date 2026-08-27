import React, { useState, useEffect } from 'react';
import { SheetRecord } from '../types';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
  sortRecordsByDate,
} from '../utils/calculations';
import {
  Printer,
  Calendar,
  X,
  ExternalLink,
  Download,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  User,
  Layers,
} from 'lucide-react';

interface DateRangeReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SheetRecord[];
  operators?: string[];
  onSelectRecord?: (id: string) => void;
}

export const DateRangeReportModal: React.FC<DateRangeReportModalProps> = ({
  isOpen,
  onClose,
  records = [],
  operators = [],
  onSelectRecord,
}) => {
  // Sort records chronologically by default
  const sortedRecords = sortRecordsByDate(records);

  // Default dates: default to earliest & latest record dates, or last 30 days
  const latestDate = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].date : new Date().toISOString().split('T')[0];
  const earliestDate = sortedRecords.length > 0 ? sortedRecords[0].date : new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(earliestDate);
  const [endDate, setEndDate] = useState<string>(latestDate);
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);

  // Synchronize initial dates when modal opens
  useEffect(() => {
    if (isOpen && sortedRecords.length > 0) {
      setEndDate(sortedRecords[sortedRecords.length - 1].date);
      // Default to 14 days prior or earliest
      const endD = new Date(sortedRecords[sortedRecords.length - 1].date);
      const startD = new Date(endD);
      startD.setDate(startD.getDate() - 14);
      const startStr = startD.toISOString().split('T')[0];
      setStartDate(startStr < sortedRecords[0].date ? sortedRecords[0].date : startStr);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter records within date range & operator
  const filteredRecords = sortedRecords.filter((rec) => {
    const inDateRange = rec.date >= startDate && rec.date <= endDate;
    const matchesOperator = selectedOperator === 'all' || rec.operator === selectedOperator;
    return inDateRange && matchesOperator;
  });

  // Calculate Range Totals
  let rangeExpectedTotal = 0;
  let rangeActualTotal = 0;
  let rangeBankingTotal = 0;
  let rangeCardTotal = 0;
  let rangeVarianceTotal = 0;

  filteredRecords.forEach((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, records);
    rangeExpectedTotal += t.totalCol3Expected;
    rangeActualTotal += t.totalCol7Actual;
    rangeBankingTotal += t.totalCol4Banking;
    rangeCardTotal += t.totalCol6Card;
    rangeVarianceTotal += t.totalVariance;
  });

  // Quick preset handlers
  const handlePreset = (preset: '7days' | '14days' | '30days' | 'thisMonth' | 'all') => {
    if (sortedRecords.length === 0) return;
    const maxDateStr = sortedRecords[sortedRecords.length - 1].date;
    const maxDate = new Date(maxDateStr);

    if (preset === 'all') {
      setStartDate(sortedRecords[0].date);
      setEndDate(maxDateStr);
      return;
    }

    setEndDate(maxDateStr);
    const start = new Date(maxDate);

    if (preset === '7days') {
      start.setDate(start.getDate() - 6);
    } else if (preset === '14days') {
      start.setDate(start.getDate() - 13);
    } else if (preset === '30days') {
      start.setDate(start.getDate() - 29);
    } else if (preset === 'thisMonth') {
      start.setDate(1);
    }

    const startISO = start.toISOString().split('T')[0];
    setStartDate(startISO < sortedRecords[0].date ? sortedRecords[0].date : startISO);
  };

  // Generate printable HTML document for range of day pages
  const generateRangeReportHtml = () => {
    const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const startUK = formatToUKDate(startDate);
    const endUK = formatToUKDate(endDate);

    const daySectionsHtml = filteredRecords.map((rec) => {
      const dayTotals = calculateGrandTotals(rec.rows, rec, records);
      const dayFormatted = formatToUKDate(rec.date);

      const registerRowsHtml = rec.rows.map((row) => {
        const expTotal = getRowExpectedTotal(row);
        const actTotal = getRowActualTotal(row);
        const variance = getRowVariance(row, rec, records);

        const varStyle =
          variance < 0
            ? 'color: #dc2626; font-weight: 800;'
            : variance > 0
            ? 'color: #15803d; font-weight: 800;'
            : 'color: #000; font-weight: 800;';

        const varLabel = variance < 0 ? 'SHORT' : variance > 0 ? 'OVER' : 'OK';

        return `
          <tr style="border-bottom: 1.5px solid #d4d4d8;">
            <td style="padding: 7px 8px; font-weight: 800; font-size: 13px; background: #fafafa; border-right: 1.5px solid #e4e4e7; color: #000;">${row.name}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000;">${formatCurrency(row.col1ExpectedCash)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000;">${formatCurrency(row.col2ExpectedCard)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; background: #f4f4f5; color: #000;">${formatCurrency(expTotal)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: #000;">${formatCurrency(row.col4BankingCash)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000;">${formatCurrency(row.col5FloatCash)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000;">${formatCurrency(row.col6ActualCard)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; background: #f4f4f5; color: #000;">${formatCurrency(actTotal)}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 13px; ${varStyle}">${formatCurrency(variance, true)} (${varLabel})</td>
          </tr>
        `;
      }).join('');

      const varCardStyle = dayTotals.totalVariance < 0 ? 'color: #dc2626;' : dayTotals.totalVariance > 0 ? 'color: #15803d;' : 'color: #000;';

      return `
        <div class="day-page-block">
          <div class="header">
            <div>
              <div class="title-sub">Daily Till Cashing & Reconciliation</div>
              <h1>Day Cashing Sheet: ${dayFormatted}</h1>
              <div style="font-size: 12px; font-family: monospace; margin-top: 2px; font-weight: bold;">
                Operator: <strong>${rec.operator || 'Not Specified'}</strong> | Status: <strong>${rec.isSaved ? 'Locked / Finalised' : 'Draft'}</strong>
              </div>
            </div>
            <div class="meta">
              <div>Printed: ${printTimestamp}</div>
              <div>Date: ${dayFormatted}</div>
            </div>
          </div>

          <div class="stats">
            <div class="card">
              <div class="card-title">System Expected (D)</div>
              <div class="card-val">${formatCurrency(dayTotals.totalCol3Expected)}</div>
            </div>
            <div class="card">
              <div class="card-title">Cash Banked (E)</div>
              <div class="card-val">${formatCurrency(dayTotals.totalCol4Banking)}</div>
            </div>
            <div class="card">
              <div class="card-title">Card Machine (G)</div>
              <div class="card-val">${formatCurrency(dayTotals.totalCol6Card)}</div>
            </div>
            <div class="card">
              <div class="card-title">Actual Count (H)</div>
              <div class="card-val">${formatCurrency(dayTotals.totalCol7Actual)}</div>
            </div>
            <div class="card" style="background: #f4f4f5; border: 2px solid #000;">
              <div class="card-title">Till Difference (I)</div>
              <div class="card-val" style="${varCardStyle} font-weight: 800;">
                ${formatCurrency(dayTotals.totalVariance, true)}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Register</th>
                <th style="text-align: right;">(B) Sys Cash</th>
                <th style="text-align: right;">(C) Sys Card</th>
                <th style="text-align: right; background: #27272a; color: #ffffff; font-weight: 800;">(D) Sys Total</th>
                <th style="text-align: right;">(E) Banking</th>
                <th style="text-align: right;">(F) Float Cash</th>
                <th style="text-align: right;">(G) Card PDQ</th>
                <th style="text-align: right; background: #27272a; color: #ffffff; font-weight: 800;">(H) Count Total</th>
                <th style="text-align: right;">(I) Variance</th>
              </tr>
            </thead>
            <tbody>
              ${registerRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #000000 !important; color: #ffffff !important;">
                <td style="color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">DAY TOTALS</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol1Cash)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol2Card)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol3Expected)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol4Banking)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol5Float)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol6Card)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalCol7Actual)}</td>
                <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(dayTotals.totalVariance, true)}</td>
              </tr>
            </tfoot>
          </table>

          ${rec.notes ? `
            <div style="background: #f4f4f5; border: 1.5px solid #000; padding: 8px 12px; margin-top: 12px; font-size: 12px; color: #000; border-radius: 2px;">
              <strong style="font-weight: 800; text-transform: uppercase;">Daily Audit Note:</strong> ${rec.notes}
            </div>
          ` : ''}

          <div class="sign-section">
            <div class="sign-box">Operator Signature</div>
            <div class="sign-box">Manager / Auditor Approval</div>
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Day Page Range Report (${startUK} - ${endUK})</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
        .summary-header-section {
          page-break-after: always !important;
          break-after: page !important;
        }
        .day-page-block {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-bottom: 0 !important;
        }
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 20px;
        color: #000;
        background: #fff;
        line-height: 1.4;
      }
      .no-print {
        background: #f4f4f5;
        border: 2px solid #000;
        padding: 12px 16px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .print-btn {
        background: #000000;
        color: #ffffff;
        border: 2px solid #000;
        font-weight: bold;
        padding: 10px 20px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
      }
      .header {
        border-bottom: 3px solid #000;
        padding-bottom: 12px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .title-sub {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #000000;
      }
      h1 {
        font-family: Georgia, serif;
        font-style: italic;
        margin: 2px 0 4px 0;
        font-size: 24px;
        font-weight: bold;
        color: #000;
      }
      .meta {
        text-align: right;
        font-size: 12px;
        font-family: monospace;
        font-weight: bold;
        color: #000000;
      }
      .stats, .summary-cards {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }
      .card {
        flex: 1;
        border: 2px solid #000;
        padding: 10px;
        background: #fafafa;
      }
      .card-title {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #000000;
      }
      .card-val {
        font-size: 20px;
        font-family: monospace;
        font-weight: 800;
        margin-top: 2px;
        color: #000;
      }
      .day-page-block {
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        padding-top: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        border: 2px solid #000;
      }
      th {
        background: #000;
        color: #fff;
        padding: 8px 6px;
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }
      td {
        padding: 8px 6px;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
      }
      tfoot tr {
        background: #000000 !important;
        color: #ffffff !important;
        font-family: monospace;
        font-weight: 900 !important;
        font-size: 15px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tfoot td {
        padding: 10px 8px !important;
        font-weight: 900 !important;
        font-size: 15px !important;
        color: #ffffff !important;
        background-color: #000000 !important;
        border-top: 3px solid #000000 !important;
        border-bottom: 3px double #000000 !important;
      }
      .sign-section {
        margin-top: 24px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-family: monospace;
        font-weight: bold;
      }
      .sign-box {
        border-top: 1.5px solid #000;
        width: 220px;
        padding-top: 4px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <strong style="font-size: 14px;">🖨️ Day Pages Range Report Document</strong>
      <div>
        <button onclick="window.print()" class="print-btn">Click Here to Print / Save PDF</button>
      </div>
    </div>

    <div class="summary-header-section">
      <div class="header">
        <div>
          <div class="title-sub">DAILY TILL CASHING & RECONCILIATION AUDIT</div>
          <h1>Day Pages Range Report: ${startUK} to ${endUK}</h1>
          <div style="font-size: 12px; font-weight: bold; color: #000000;">
            Total Days Included: ${filteredRecords.length} | Operator Filter: ${selectedOperator === 'all' ? 'All Operators' : selectedOperator}
          </div>
        </div>
        <div class="meta">
          <div>Printed: ${printTimestamp}</div>
          <div>System Version: Delta v1.0</div>
        </div>
      </div>

      <!-- Executive Summary Cards -->
      <div class="summary-cards">
        <div class="card">
          <div class="card-title">(D) TOTAL EXPECTED</div>
          <div class="card-val">${formatCurrency(rangeExpectedTotal)}</div>
        </div>
        <div class="card">
          <div class="card-title">(E) CASH BANKED</div>
          <div class="card-val">${formatCurrency(rangeBankingTotal)}</div>
        </div>
        <div class="card">
          <div class="card-title">(G) CARD PDQ</div>
          <div class="card-val">${formatCurrency(rangeCardTotal)}</div>
        </div>
        <div class="card">
          <div class="card-title">(H) TOTAL COUNTED</div>
          <div class="card-val">${formatCurrency(rangeActualTotal)}</div>
        </div>
        <div class="card" style="background: ${rangeVarianceTotal < 0 ? '#fef2f2' : rangeVarianceTotal > 0 ? '#f0fdf4' : '#f4f4f5'}; border: 2px solid #000;">
          <div class="card-title">(I) NET VARIANCE</div>
          <div class="card-val" style="color: ${rangeVarianceTotal < 0 ? '#dc2626' : rangeVarianceTotal > 0 ? '#15803d' : '#000000'}; font-weight: 800;">
            ${formatCurrency(rangeVarianceTotal, true)}
          </div>
        </div>
      </div>

      <h2 style="font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 16px; color: #000;">
        Individual Day Pages (${filteredRecords.length} Days)
      </h2>
    </div>

    ${daySectionsHtml}

  </body>
</html>`;
  };

  const handleTriggerPrint = () => {
    const html = generateRangeReportHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPrintBlobUrl(url);
    setIsPrintModalOpen(true);

    try {
      const win = window.open(url, '_blank');
      if (win) {
        win.focus();
      }
    } catch (e) {
      console.warn('Popup blocked, falling back to modal preview', e);
    }
  };

  const handleDownloadCSV = () => {
    const lines: string[] = [
      'Day Pages Range Report Export',
      `Date Range: ${formatToUKDate(startDate)} to ${formatToUKDate(endDate)}`,
      `Total Days: ${filteredRecords.length}`,
      `Operator Filter: ${selectedOperator}`,
      '',
      'Date,Day,Operator,Expected Takings,Actual Counted,Cash Banked,Card PDQ Total,Till Variance,Status,Notes',
    ];

    filteredRecords.forEach((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, records);
      lines.push(
        [
          formatToUKDate(rec.date),
          new Date(rec.date).toLocaleDateString('en-GB', { weekday: 'short' }),
          `"${rec.operator || '—'}"`,
          t.totalCol3Expected.toFixed(2),
          t.totalCol7Actual.toFixed(2),
          t.totalCol4Banking.toFixed(2),
          t.totalCol6Card.toFixed(2),
          t.totalVariance.toFixed(2),
          rec.isSaved ? 'Finalised' : 'Open',
          `"${(rec.notes || '').replace(/"/g, '""')}"`,
        ].join(',')
      );
    });

    lines.push('');
    lines.push(
      [
        'RANGE TOTALS',
        '',
        '',
        rangeExpectedTotal.toFixed(2),
        rangeActualTotal.toFixed(2),
        rangeBankingTotal.toFixed(2),
        rangeCardTotal.toFixed(2),
        rangeVarianceTotal.toFixed(2),
      ].join(',')
    );

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DayPages_Report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Main Range Selection & Summary Modal */}
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:hidden">
        <div className="bg-white border-2 border-black w-full max-w-4xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="bg-black text-white p-4 border-b-2 border-black flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-400 text-black font-bold rounded-xs border border-black">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-white block">
                  Reporting & Audit Tool
                </span>
                <h2 className="font-serif italic font-bold text-lg sm:text-xl text-white">
                  Day Page Report on Date Range
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-[#fafafa]">
            {/* Range Controls */}
            <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-black border-b border-zinc-200 pb-2">
                <Filter className="w-4 h-4 text-amber-500" />
                <span>Select Range & Filter Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    End Date:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* Operator Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Operator Filter:
                  </label>
                  <select
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="all">All Saved Operators</option>
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
                  Quick Ranges:
                </span>
                <button
                  onClick={() => handlePreset('7days')}
                  className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-black border border-black cursor-pointer rounded-xs"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handlePreset('14days')}
                  className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-black border border-black cursor-pointer rounded-xs"
                >
                  Last 14 Days
                </button>
                <button
                  onClick={() => handlePreset('30days')}
                  className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-black border border-black cursor-pointer rounded-xs"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => handlePreset('thisMonth')}
                  className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-black border border-black cursor-pointer rounded-xs"
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePreset('all')}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-950 border border-black cursor-pointer rounded-xs"
                >
                  All Days ({records.length})
                </button>
              </div>
            </div>

            {/* Range Summary Dashboard Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-serif italic font-bold text-base text-black flex items-center gap-2">
                  <span>Range Audit Summary</span>
                  <span className="text-xs font-sans font-extrabold bg-black text-white px-2.5 py-0.5 rounded-xs border border-zinc-700">
                    {filteredRecords.length} Days Found
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Expected Takings
                  </span>
                  <span className="text-sm sm:text-base font-mono font-bold text-black mt-1 block">
                    {formatCurrency(rangeExpectedTotal)}
                  </span>
                </div>

                <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Cash Banked
                  </span>
                  <span className="text-sm sm:text-base font-mono font-bold text-black mt-1 block">
                    {formatCurrency(rangeBankingTotal)}
                  </span>
                </div>

                <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Card PDQ
                  </span>
                  <span className="text-sm sm:text-base font-mono font-bold text-black mt-1 block">
                    {formatCurrency(rangeCardTotal)}
                  </span>
                </div>

                <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Counted Total
                  </span>
                  <span className="text-sm sm:text-base font-mono font-bold text-black mt-1 block">
                    {formatCurrency(rangeActualTotal)}
                  </span>
                </div>

                <div
                  className={`border-2 border-black p-3 col-span-2 sm:col-span-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    rangeVarianceTotal < 0
                      ? 'bg-rose-50 text-rose-950'
                      : rangeVarianceTotal > 0
                      ? 'bg-emerald-50 text-emerald-950'
                      : 'bg-amber-50 text-amber-950'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider block">
                    Net Variance
                  </span>
                  <span className="text-sm sm:text-base font-mono font-extrabold mt-1 block">
                    {formatCurrency(rangeVarianceTotal, true)}
                  </span>
                </div>
              </div>
            </div>

            {/* List of Included Day Pages */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="bg-zinc-100 p-3 border-b-2 border-black flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-800">
                  Included Day Sheets ({filteredRecords.length})
                </span>
                <span className="text-[11px] font-mono text-zinc-600">
                  {formatToUKDate(startDate)} → {formatToUKDate(endDate)}
                </span>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Calendar className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className="text-sm font-bold text-zinc-700">No Day Sheets found in this date range.</p>
                  <p className="text-xs text-zinc-500">
                    Try adjusting your start and end dates or selecting "All Days".
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-200">
                  {filteredRecords.map((rec) => {
                    const dayT = calculateGrandTotals(rec.rows, rec, records);
                    return (
                      <div
                        key={rec.id}
                        className="p-3 hover:bg-amber-50/50 flex flex-wrap items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-black bg-zinc-200 px-2 py-0.5 rounded-xs">
                            {formatToUKDate(rec.date)}
                          </span>
                          <span className="font-bold text-zinc-700">
                            {rec.operator || 'Unassigned'}
                          </span>
                          {rec.isSaved ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.2 rounded-xs">
                              FINALISED
                            </span>
                          ) : (
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-300 px-1.5 py-0.2 rounded-xs">
                              OPEN
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 font-mono">
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block">Expected</span>
                            <span className="font-bold">{formatCurrency(dayT.totalCol3Expected)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block">Counted</span>
                            <span className="font-bold">{formatCurrency(dayT.totalCol7Actual)}</span>
                          </div>
                          <div className="text-right min-w-[70px]">
                            <span className="text-[10px] text-zinc-500 block">Variance</span>
                            <span
                              className={`font-extrabold ${
                                dayT.totalVariance < 0
                                  ? 'text-rose-600'
                                  : dayT.totalVariance > 0
                                  ? 'text-emerald-700'
                                  : 'text-zinc-900'
                              }`}
                            >
                              {formatCurrency(dayT.totalVariance, true)}
                            </span>
                          </div>

                          {onSelectRecord && (
                            <button
                              onClick={() => {
                                onSelectRecord(rec.id);
                                onClose();
                              }}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-800 hover:bg-black text-amber-400 rounded-xs cursor-pointer ml-2"
                            >
                              Open Sheet
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="bg-zinc-100 border-t-2 border-black p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              onClick={handleDownloadCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-200 text-black border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-200 hover:bg-zinc-300 text-black border border-black cursor-pointer rounded-xs"
              >
                Cancel
              </button>

              <button
                onClick={handleTriggerPrint}
                disabled={filteredRecords.length === 0}
                className="flex items-center gap-2 px-5 py-2 text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ Print Range Day Pages Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print View Modal (if popup was blocked or for previewing) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:hidden">
          <div className="bg-white border-2 border-black w-full max-w-5xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[95vh] flex flex-col">
            <div className="bg-black text-white p-3 border-b-2 border-black flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif italic font-bold text-base text-white">
                  Print Day Page Report ({formatToUKDate(startDate)} - {formatToUKDate(endDate)})
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span>Print document ready ({filteredRecords.length} Day Pages included)</span>
              <div className="flex items-center gap-2">
                {printBlobUrl && (
                  <a
                    href={printBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-white hover:bg-amber-100 text-black border border-black px-3 py-1 rounded-xs text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Printable Page</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    const html = generateRangeReportHtml();
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(html);
                      win.document.close();
                      win.print();
                    }
                  }}
                  className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black border border-black px-3 py-1 rounded-xs text-xs font-extrabold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print (Ctrl+P)</span>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-zinc-200">
              {printBlobUrl && (
                <iframe
                  src={printBlobUrl}
                  title="Print Preview"
                  className="w-full h-[65vh] border-2 border-black bg-white shadow-md"
                />
              )}
            </div>

            <div className="p-3 bg-white border-t-2 border-black flex justify-end shrink-0">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-1.5 bg-black text-white font-bold text-xs uppercase tracking-wider rounded-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
