import React, { useState, useMemo } from 'react';
import { SheetRecord } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  calculateGrandTotals,
  downloadCSV,
  formatCurrency,
  formatToUKDate,
  sortRecordsByDate,
  groupRecordsByCalendarWeek,
  getDayOfWeekName,
  getFinancialYear,
  filterRecordsByFinancialYear,
} from '../utils/calculations';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  CheckCircle2,
  User,
  ExternalLink,
  Download,
  X,
  Activity,
  Loader2,
  Globe,
} from 'lucide-react';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';
import { exportWeeklyReportToPDF } from '../utils/pdfExport';
import { triggerBrowserPrint, openPrintableTab } from '../utils/printHelper';

interface WeeklyReportViewProps {
  records: SheetRecord[];
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  onBackToSheet: () => void;
  onSelectRecord: (id: string) => void;
  onOpenRangeReport?: () => void;
  onOpenMonthlyReport?: () => void;
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  records,
  selectedYear = 'all',
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  onBackToSheet,
  onSelectRecord,
  onOpenRangeReport,
  onOpenMonthlyReport,
}) => {
  // Filter records by selected financial year if applicable
  const displayRecords = useMemo(() => {
    if (selectedYear === 'all' || !selectedYear) return records;
    return filterRecordsByFinancialYear(records, selectedYear, financialYearFormat);
  }, [records, selectedYear, financialYearFormat]);

  // Group records by Monday-to-Sunday calendar weeks
  const weekGroups = useMemo(() => {
    return groupRecordsByCalendarWeek(displayRecords);
  }, [displayRecords]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);

  const activeWeek = weekGroups[selectedWeekIndex] || weekGroups[0] || {
    mondayISO: '',
    sundayISO: '',
    mondayUK: '',
    sundayUK: '',
    label: 'No data',
    records: [],
  };

  const currentWeekRecords = activeWeek.records;

  // Weekly Stats
  let weeklyExpectedSum = 0;
  let weeklyActualSum = 0;
  let weeklyBankingSum = 0;
  let weeklyCardSum = 0;
  let weeklyVarianceSum = 0;

  currentWeekRecords.forEach((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, records);
    weeklyExpectedSum += t.totalCol3Expected;
    weeklyActualSum += t.totalCol7Actual;
    weeklyBankingSum += t.totalCol4Banking;
    weeklyCardSum += t.totalCol6Card;
    weeklyVarianceSum += t.totalVariance;
  });

  const avgDaily = currentWeekRecords.length > 0 ? weeklyExpectedSum / currentWeekRecords.length : 0;

  // Weekly Online Sales & VAT Aggregates
  const onlineSalesData = useMemo(() => {
    return currentWeekRecords.map((rec) => {
      const onlineRow = rec.rows.find(
        (r) =>
          r.isOnlineOrders ||
          r.id === 'online-orders' ||
          (r.name && (r.name.toLowerCase() === 'online orders' || r.name.toLowerCase() === 'online sales'))
      );
      const cardExpected = onlineRow ? onlineRow.col2ExpectedCard || 0 : 0;
      const cardActual = onlineRow ? onlineRow.col6ActualCard || 0 : 0;
      const cardTakings = cardExpected || cardActual;
      const vat = onlineRow ? onlineRow.vat || 0 : 0;
      const netTakings = Math.max(0, cardTakings - vat);
      const diff = cardActual - cardExpected;
      const isMatch = Math.abs(diff) < 0.005;
      return {
        recordId: rec.id,
        date: rec.date,
        dayName: getDayOfWeekName(rec.date),
        operator: rec.operator || '—',
        cardExpected,
        cardActual,
        cardTakings,
        vat,
        netTakings,
        diff,
        isMatch,
        hasRow: !!onlineRow,
      };
    });
  }, [currentWeekRecords]);

  const { weeklyOnlineTakingsSum, weeklyOnlineVatSum, weeklyOnlineNetSum } = useMemo(() => {
    let takings = 0;
    let vatSum = 0;
    let netSum = 0;
    onlineSalesData.forEach((d) => {
      takings += d.cardTakings;
      vatSum += d.vat;
      netSum += d.netTakings;
    });
    return {
      weeklyOnlineTakingsSum: takings,
      weeklyOnlineVatSum: vatSum,
      weeklyOnlineNetSum: netSum,
    };
  }, [onlineSalesData]);

  // Recharts trend data (chronological order Monday -> Sunday)
  const chartData = currentWeekRecords.map((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, records);
    const dayName = getDayOfWeekName(rec.date);
    return {
      date: `${dayName.slice(0, 3)} ${formatToUKDate(rec.date)}`,
      variance: Number(t.totalVariance.toFixed(2)),
      expected: Number(t.totalCol3Expected.toFixed(2)),
      actual: Number(t.totalCol7Actual.toFixed(2)),
      operator: rec.operator || 'Unassigned',
    };
  });

  const handleExportWeeklyCSV = () => {
    const lines: string[] = [
      'Weekly Till Reconciliation Summary Report',
      `Calendar Week: Mon ${activeWeek.mondayUK} to Sun ${activeWeek.sundayUK}`,
      '',
      'Day,Date,Operator,Expected Takings,Actual Counted,Cash Banked,Card PDQ Total,Till Difference',
    ];

    currentWeekRecords.forEach((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, records);
      lines.push(
        [
          getDayOfWeekName(rec.date),
          formatToUKDate(rec.date),
          `"${rec.operator || '—'}"`,
          t.totalCol3Expected.toFixed(2),
          t.totalCol7Actual.toFixed(2),
          t.totalCol4Banking.toFixed(2),
          t.totalCol6Card.toFixed(2),
          t.totalVariance.toFixed(2),
        ].join(',')
      );
    });

    lines.push(
      [
        'WEEKLY TOTALS',
        '',
        '',
        weeklyExpectedSum.toFixed(2),
        weeklyActualSum.toFixed(2),
        weeklyBankingSum.toFixed(2),
        weeklyCardSum.toFixed(2),
        weeklyVarianceSum.toFixed(2),
      ].join(',')
    );

    lines.push('');
    lines.push('=== WEEKLY ONLINE SALES & VAT AUDIT ===');
    lines.push('Day,Date,Operator,Sys Card (2),Card PDQ (6),Total Online Takings,Online VAT,Net Ex-VAT,Status');
    onlineSalesData.forEach((d) => {
      lines.push(
        [
          d.dayName,
          formatToUKDate(d.date),
          `"${d.operator}"`,
          d.cardExpected.toFixed(2),
          d.cardActual.toFixed(2),
          d.cardTakings.toFixed(2),
          d.vat.toFixed(2),
          d.netTakings.toFixed(2),
          d.isMatch ? 'MATCHED' : `DIFF: £${d.diff.toFixed(2)}`,
        ].join(',')
      );
    });
    lines.push(
      [
        'ONLINE SALES TOTALS',
        '',
        '',
        onlineSalesData.reduce((s, d) => s + d.cardExpected, 0).toFixed(2),
        onlineSalesData.reduce((s, d) => s + d.cardActual, 0).toFixed(2),
        weeklyOnlineTakingsSum.toFixed(2),
        weeklyOnlineVatSum.toFixed(2),
        weeklyOnlineNetSum.toFixed(2),
        onlineSalesData.every((d) => d.isMatch) ? 'ALL MATCHED' : 'DISCREPANCIES MONITORED',
      ].join(',')
    );

    downloadCSV(`Weekly_Till_Report_Mon_${activeWeek.mondayISO}.csv`, lines.join('\n'));
  };

  const generatePrintHtml = () => {
    const periodText = `Mon ${activeWeek.mondayUK} to Sun ${activeWeek.sundayUK}`;
    const printDate = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const rowsHtml = currentWeekRecords.length === 0
      ? `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #71717a;">No records found for this week.</td></tr>`
      : currentWeekRecords.map((rec) => {
          const t = calculateGrandTotals(rec.rows, rec, records);
          const varColor = t.totalVariance < 0 ? 'color: #dc2626;' : t.totalVariance > 0 ? 'color: #15803d;' : 'color: #000;';
          const dayName = getDayOfWeekName(rec.date);
          return `
            <tr style="border-bottom: 1px solid #e4e4e7;">
              <td style="padding: 10px 8px; font-family: monospace; font-weight: bold;"><strong>${dayName.slice(0, 3)}</strong> ${formatToUKDate(rec.date)}</td>
              <td style="padding: 10px 8px;">${rec.operator || '—'}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace;">${formatCurrency(t.totalCol1Cash)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace;">${formatCurrency(t.totalCol2Card)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; background: #f4f4f5;">${formatCurrency(t.totalCol3Expected)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(t.totalCol4Banking)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace;">${formatCurrency(t.totalCol6Card)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; background: #f4f4f5;">${formatCurrency(t.totalCol7Actual)}</td>
              <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: bold; ${varColor}">${formatCurrency(t.totalVariance, true)}</td>
            </tr>
          `;
        }).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Weekly Till Reconciliation Summary Report</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
      }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; line-height: 1.4; }
      .print-btn { background: #fbbf24; color: #000; border: 2px solid #000; font-weight: bold; padding: 10px 20px; cursor: pointer; font-size: 14px; margin-bottom: 20px; text-decoration: none; display: inline-block; }
      .header { border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
      .title-sub { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: #52525b; }
      h1 { font-family: Georgia, serif; font-style: italic; margin: 2px 0 4px 0; font-size: 24px; color: #000; }
      .period { font-size: 12px; font-family: monospace; color: #3f3f46; }
      .meta { text-align: right; font-size: 11px; font-family: monospace; color: #52525b; }
      .stats { display: flex; gap: 12px; margin-bottom: 20px; }
      .card { flex: 1; border: 2px solid #000; padding: 12px; background: #fafafa; }
      .card-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #52525b; }
      .card-val { font-size: 20px; font-family: monospace; font-weight: bold; margin-top: 4px; color: #000; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; border: 2px solid #000; }
      th { background: #000; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; }
      td { border-bottom: 1px solid #e4e4e7; }
      tfoot tr { background: #000000 !important; color: #ffffff !important; font-family: monospace; font-weight: 900 !important; font-size: 15px !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      tfoot td { padding: 10px 8px !important; font-weight: 900 !important; font-size: 15px !important; color: #ffffff !important; background-color: #000000 !important; border-top: 3px solid #000000 !important; border-bottom: 3px double #000000 !important; }
    </style>
  </head>
  <body>
    <div class="no-print" style="background: #f4f4f5; border: 2px solid #000; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 14px;">🖨️ Weekly Report Print Document</strong>
      <button onclick="window.print()" class="print-btn" style="margin:0;">Click Here to Print / Save PDF</button>
    </div>

    <div class="header">
      <div>
        <div class="title-sub">Operational Audit & Reconciliation</div>
        <h1>Weekly Till Reconciliation Summary Report</h1>
        <div class="period">Week Period: <strong>${periodText}</strong></div>
      </div>
      <div class="meta">
        <div>Printed: ${printDate}</div>
        <div>Recorded Days: ${currentWeekRecords.length} day(s)</div>
      </div>
    </div>

    <div class="stats">
      <div class="card">
        <div class="card-title">Weekly Expected</div>
        <div class="card-val">${formatCurrency(weeklyExpectedSum)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Cash Banked</div>
        <div class="card-val">${formatCurrency(weeklyBankingSum)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Card Takings</div>
        <div class="card-val">${formatCurrency(weeklyCardSum)}</div>
      </div>
      <div class="card">
        <div class="card-title">Net Variance</div>
        <div class="card-val">${formatCurrency(weeklyVarianceSum, true)}</div>
      </div>
      <div class="card" style="background: #f0f9ff; border: 2px solid #0284c7;">
        <div class="card-title" style="color: #0369a1;">Online Sales &amp; VAT</div>
        <div class="card-val" style="color: #0c4a6e;">${formatCurrency(weeklyOnlineTakingsSum)}</div>
        <div style="font-size: 10px; font-family: monospace; color: #0284c7; margin-top: 3px;">
          VAT: <strong>${formatCurrency(weeklyOnlineVatSum)}</strong> | Net: ${formatCurrency(weeklyOnlineNetSum)}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Operator</th>
          <th style="text-align: right;">(B) Sys Cash</th>
          <th style="text-align: right;">(C) Sys Card</th>
          <th style="text-align: right; background: #27272a; color: #ffffff; font-weight: bold;">(D) Sys Total</th>
          <th style="text-align: right;">(E) Banking</th>
          <th style="text-align: right;">(G) Card PDQ</th>
          <th style="text-align: right; background: #27272a; color: #ffffff; font-weight: bold;">(H) Actual Total</th>
          <th style="text-align: right;">(I) Variance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #000000 !important; color: #ffffff !important;">
          <td style="color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">WEEKLY TOTALS</td>
          <td style="color: #ffffff !important; background: #000000 !important;"></td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows).totalCol1Cash, 0))}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows).totalCol2Card, 0))}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(weeklyExpectedSum)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(weeklyBankingSum)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(weeklyCardSum)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(weeklyActualSum)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 10px 8px !important;">${formatCurrency(weeklyVarianceSum, true)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top: 24px; border: 2px solid #000; background: #fff;">
      <div style="background: #0c4a6e; color: #fff; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
        <strong style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Weekly Online Sales &amp; VAT Audit (Card Settlements)</strong>
        <span style="font-family: monospace; font-size: 11px;">Total VAT: <strong>${formatCurrency(weeklyOnlineVatSum)}</strong> | Net Ex-VAT: <strong>${formatCurrency(weeklyOnlineNetSum)}</strong></span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #000; color: #fff;">
            <th style="padding: 8px;">Date</th>
            <th style="padding: 8px;">Operator</th>
            <th style="padding: 8px; text-align: right;">Sys Card (2)</th>
            <th style="padding: 8px; text-align: right;">PDQ Card (6)</th>
            <th style="padding: 8px; text-align: right; background: #27272a;">Online Takings</th>
            <th style="padding: 8px; text-align: right; background: #0369a1; color: #fff;">Online VAT</th>
            <th style="padding: 8px; text-align: right;">Net Ex-VAT</th>
            <th style="padding: 8px; text-align: center;">Reconciliation</th>
          </tr>
        </thead>
        <tbody>
          ${onlineSalesData.map((d) => `
            <tr style="border-bottom: 1px solid #e4e4e7;">
              <td style="padding: 8px; font-family: monospace;"><strong>${d.dayName.slice(0, 3)}</strong> ${formatToUKDate(d.date)}</td>
              <td style="padding: 8px;">${d.operator}</td>
              <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(d.cardExpected)}</td>
              <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(d.cardActual)}</td>
              <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; background: #f4f4f5;">${formatCurrency(d.cardTakings)}</td>
              <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; background: #e0f2fe; color: #0369a1;">${formatCurrency(d.vat)}</td>
              <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(d.netTakings)}</td>
              <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: bold;">
                ${d.cardTakings === 0 && d.vat === 0 ? '<span style="color: #a1a1aa;">No Orders</span>' : d.isMatch ? '<span style="color: #15803d;">MATCHED</span>' : `<span style="color: #b91c1c;">DIFF: £${d.diff.toFixed(2)}</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #000; color: #fff; font-family: monospace; font-weight: 900;">
            <td style="padding: 8px;" colspan="2">ONLINE TOTALS</td>
            <td style="padding: 8px; text-align: right;">${formatCurrency(onlineSalesData.reduce((s, d) => s + d.cardExpected, 0))}</td>
            <td style="padding: 8px; text-align: right;">${formatCurrency(onlineSalesData.reduce((s, d) => s + d.cardActual, 0))}</td>
            <td style="padding: 8px; text-align: right; color: #fbbf24;">${formatCurrency(weeklyOnlineTakingsSum)}</td>
            <td style="padding: 8px; text-align: right; background: #0369a1; color: #fbbf24;">${formatCurrency(weeklyOnlineVatSum)}</td>
            <td style="padding: 8px; text-align: right;">${formatCurrency(weeklyOnlineNetSum)}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; color: #4ade80;">${onlineSalesData.every((d) => d.isMatch) ? 'RECONCILED' : 'MONITORED'}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <script>
      window.onload = function() {
        setTimeout(function() {
          try { window.print(); } catch(e){}
        }, 300);
      };
    </script>
  </body>
</html>`;
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportWeeklyReportToPDF({
        mondayStr: activeWeek.mondayUK,
        sundayStr: activeWeek.sundayUK,
        records: currentWeekRecords,
        allRecords: records,
        totals: {
          totalCol1Cash: currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows, r, records).totalCol1Cash, 0),
          totalCol2Card: currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows, r, records).totalCol2Card, 0),
          totalCol3Expected: weeklyExpectedSum,
          totalCol4Banking: weeklyBankingSum,
          totalCol6Card: weeklyCardSum,
          totalCol7Actual: weeklyActualSum,
          totalVariance: weeklyVarianceSum,
        },
      });
    } catch (err) {
      console.error('Failed to export weekly PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = async () => {
    const html = generatePrintHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPrintBlobUrl(url);
    setIsPrintModalOpen(true);

    const printed = await triggerBrowserPrint(html);
    if (!printed) {
      console.warn('Direct print blocked by sandbox');
    }
  };

  return (
    <div className="w-full max-w-full ml-0 mr-auto p-3 sm:p-5 lg:p-6 space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-4">
      {/* Print-Only Professional Header */}
      <div className="hidden print:block border-b-2 border-black pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              Operational Audit & Reconciliation
            </div>
            <h1 className="text-2xl font-serif italic font-bold text-black">
              Weekly Till Reconciliation Summary Report
            </h1>
            <p className="text-xs font-mono text-zinc-600 mt-1">
              Calendar Week Period:{' '}
              <span className="font-bold text-black">
                Mon {activeWeek.mondayUK} to Sun {activeWeek.sundayUK}
              </span>
            </p>
          </div>
          <div className="text-right text-xs font-mono text-zinc-600">
            <div>Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            <div>Recorded Days: {currentWeekRecords.length} day(s)</div>
          </div>
        </div>
      </div>

      {/* Financial Year Switcher Bar */}
      {onSelectYear && (
        <div className="print:hidden">
          <FinancialYearSwitcher
            selectedYear={selectedYear}
            onSelectYear={onSelectYear}
            records={records}
            format={financialYearFormat}
            onChangeFormat={onChangeFinancialYearFormat}
            compact={false}
            showFormatToggle={true}
          />
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToSheet}
            className="p-2 bg-black hover:bg-zinc-800 text-white transition-colors cursor-pointer"
            title="Back to Sheet"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-0.5">
              Weekly Calendar Audit (Monday – Sunday)
            </div>
            <h1 className="text-2xl font-serif italic font-bold text-black flex items-center gap-2">
              Weekly Cashing Up Summary Report
            </h1>
            <p className="text-xs font-mono text-amber-900 font-bold mt-0.5">
              Mon {activeWeek.mondayUK} – Sun {activeWeek.sundayUK}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selection Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedWeekIndex}
              onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              className="bg-white border-2 border-black text-xs font-mono font-bold px-2 py-2 cursor-pointer focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {weekGroups.map((group, idx) => (
                <option key={group.mondayISO} value={idx}>
                  Mon {group.mondayUK} – Sun {group.sundayUK} ({group.records.length} day{group.records.length === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSelectedWeekIndex((prev) => Math.min(weekGroups.length - 1, prev + 1))}
            disabled={selectedWeekIndex >= weekGroups.length - 1}
            className="p-2 bg-white border-2 border-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-zinc-100 text-black flex items-center gap-1 cursor-pointer"
            title="Older Week"
          >
            <ChevronLeft className="w-4 h-4" />
            Older
          </button>

          <button
            onClick={() => setSelectedWeekIndex((prev) => Math.max(0, prev - 1))}
            disabled={selectedWeekIndex === 0}
            className="p-2 bg-white border-2 border-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-zinc-100 text-black flex items-center gap-1 cursor-pointer"
            title="Newer Week"
          >
            Newer
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-zinc-400 mx-1" />

          <button
            onClick={handleExportWeeklyCSV}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Print Weekly
          </button>

          {onOpenRangeReport && (
            <button
              onClick={onOpenRangeReport}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Printer className="w-4 h-4 text-black" />
              Date Range Report
            </button>
          )}

          {onOpenMonthlyReport && (
            <button
              onClick={onOpenMonthlyReport}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-black font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Open Monthly Report with Custom Date Range"
            >
              <Calendar className="w-4 h-4 text-black" />
              Monthly Report
            </button>
          )}
        </div>
      </div>

      {/* Weekly Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">
            <span>Weekly Expected</span>
            <Scale className="w-4 h-4 text-black" />
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(weeklyExpectedSum)}
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            Avg Daily: {formatCurrency(avgDaily)}
          </p>
        </div>

        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">
            <span>Total Cash Banked</span>
            <DollarSign className="w-4 h-4 text-black" />
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(weeklyBankingSum)}
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            Ready for bank deposit
          </p>
        </div>

        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">
            <span>Total Card Takings</span>
            <BarChart3 className="w-4 h-4 text-black" />
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(weeklyCardSum)}
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            PDQ Machine Settlement
          </p>
        </div>

        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">
            <span>Net Weekly Variance</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                weeklyVarianceSum < 0
                  ? 'bg-rose-100 border-rose-600 text-rose-800'
                  : weeklyVarianceSum > 0
                  ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                  : 'bg-zinc-100 border-zinc-400 text-black'
              }`}
            >
              {weeklyVarianceSum < 0 ? (
                <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
              ) : weeklyVarianceSum > 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-700 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-black shrink-0" />
              )}
              {weeklyVarianceSum < 0 ? 'Short' : weeklyVarianceSum > 0 ? 'Over' : 'Balanced'}
            </span>
          </div>
          <p
            className={`text-2xl font-mono font-bold ${
              weeklyVarianceSum < 0
                ? 'text-rose-600'
                : weeklyVarianceSum > 0
                ? 'text-emerald-700'
                : 'text-black'
            }`}
          >
            {formatCurrency(weeklyVarianceSum, true)}
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            Across {currentWeekRecords.length} recorded days
          </p>
        </div>

        {/* 5. Online Sales & VAT KPI Card */}
        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-sky-700" />
              Online Sales &amp; VAT
            </span>
            <span className="bg-sky-100 text-sky-900 border border-sky-400 text-[9px] px-1.5 py-0.2 rounded font-black">
              Card Only
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(weeklyOnlineTakingsSum)}
          </p>
          <div className="text-xs font-mono mt-1 flex items-center justify-between text-zinc-700">
            <span className="font-extrabold text-sky-950">
              VAT: {formatCurrency(weeklyOnlineVatSum)}
            </span>
            <span className="text-zinc-500">
              Net: {formatCurrency(weeklyOnlineNetSum)}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Net Variance Trend Line Chart */}
      <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-400 border border-black text-black font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif italic font-bold text-lg text-black">
                Daily Net Variance Trend
              </h3>
              <p className="text-xs text-zinc-500 font-mono">
                Tracking daily till accuracy surpluses (+) and shortages (-) over time
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-400 border border-black rounded-full" />
              <span>Net Variance (£)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-black" />
              <span className="text-zinc-600">Zero Balance Line</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-500 font-mono">
            No daily reconciliation data available for chart.
          </div>
        ) : (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#000', fontSize: 11, fontWeight: 'bold' }} 
                  stroke="#000"
                />
                <YAxis 
                  tick={{ fill: '#000', fontSize: 11, fontFamily: 'monospace' }} 
                  stroke="#000"
                  tickFormatter={(val) => `£${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isShort = data.variance < 0;
                      const isOver = data.variance > 0;
                      return (
                        <div className="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs text-black font-mono">
                          <div className="font-serif italic font-bold border-b border-black pb-1 mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span>{data.date}</span>
                            <span className="font-sans text-[10px] bg-amber-100 border border-black px-1.5 py-0.5 font-bold uppercase">
                              {data.operator}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="flex justify-between gap-4">
                              <span className="text-zinc-500">Expected:</span>
                              <span className="font-bold">{formatCurrency(data.expected)}</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-zinc-500">Actual Count:</span>
                              <span className="font-bold">{formatCurrency(data.actual)}</span>
                            </p>
                            <p className={`flex justify-between gap-4 font-bold border-t border-zinc-200 pt-1 mt-1 ${isShort ? 'text-rose-600' : isOver ? 'text-emerald-700' : 'text-black'}`}>
                              <span>Till Variance:</span>
                              <span>{formatCurrency(data.variance, true)} ({isShort ? 'Short' : isOver ? 'Over' : 'Balanced'})</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine 
                  y={0} 
                  stroke="#000" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="variance"
                  name="Net Variance"
                  stroke="#000"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#fbbf24', stroke: '#000', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#f59e0b', stroke: '#000', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Weekly Breakdown Table */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="p-4 bg-zinc-100 border-b-2 border-black font-serif italic font-bold text-black text-lg">
          Daily Breakdown Grid
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead className="bg-black text-white font-serif italic border-b-2 border-black text-sm">
              <tr>
                <th className="py-4 px-4 font-bold text-sm">Date</th>
                <th className="py-4 px-4 font-bold text-sm">Operator</th>
                <th className="py-4 px-4 text-right font-bold text-sm">(B) Sys Cash</th>
                <th className="py-4 px-4 text-right font-bold text-sm">(C) Sys Card</th>
                <th className="py-4 px-4 text-right font-black text-sm bg-zinc-800 text-white border-x border-zinc-700">(D) Sys Total</th>
                <th className="py-4 px-4 text-right font-bold text-sm">(E) Banking</th>
                <th className="py-4 px-4 text-right font-bold text-sm">(G) Card PDQ</th>
                <th className="py-4 px-4 text-right font-black text-sm bg-zinc-800 text-white border-x border-zinc-700">(H) Actual Total</th>
                <th className="py-4 px-4 text-right font-bold text-sm">(I) Variance</th>
                <th className="py-4 px-4 text-center font-bold text-sm print:hidden">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-black font-medium">
              {currentWeekRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-zinc-500 font-mono text-sm">
                    No cashing up records available for this period.
                  </td>
                </tr>
              ) : (
                currentWeekRecords.map((rec) => {
                  const t = calculateGrandTotals(rec.rows, rec, records);
                  const ukDate = formatToUKDate(rec.date);
                  const dayName = getDayOfWeekName(rec.date);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-black flex items-center gap-2 text-base">
                        <Calendar className="w-4 h-4 text-zinc-500 print:hidden" />
                        <span className="font-sans text-xs uppercase font-extrabold bg-zinc-200 text-zinc-900 px-2 py-0.5 rounded print:border-0">
                          {dayName.slice(0, 3)}
                        </span>
                        {ukDate}
                      </td>

                      <td className="py-4 px-4 font-mono text-sm">
                        <span className="inline-flex items-center gap-1 font-extrabold bg-zinc-100 border border-black text-black px-2.5 py-1 rounded print:border-0 print:bg-transparent print:p-0 text-xs">
                          <User className="w-3.5 h-3.5 text-zinc-700 print:hidden" />
                          {rec.operator || '—'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right font-mono text-base font-semibold">
                        {formatCurrency(t.totalCol1Cash)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono text-base font-semibold">
                        {formatCurrency(t.totalCol2Card)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-black text-base bg-zinc-100 border-x border-zinc-200">
                        {formatCurrency(t.totalCol3Expected)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-black text-base text-black">
                        {formatCurrency(t.totalCol4Banking)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono text-base font-semibold">
                        {formatCurrency(t.totalCol6Card)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-black text-base bg-zinc-100 border-x border-zinc-200">
                        {formatCurrency(t.totalCol7Actual)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-sm font-extrabold ${
                            t.totalVariance < 0
                              ? 'bg-rose-100 border-rose-600 text-rose-800'
                              : t.totalVariance > 0
                              ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                              : 'bg-zinc-100 border-zinc-400 text-black'
                          }`}
                        >
                          {t.totalVariance < 0 ? (
                            <TrendingDown className="w-4 h-4 text-rose-600 shrink-0 print:hidden" />
                          ) : t.totalVariance > 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0 print:hidden" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-black shrink-0 print:hidden" />
                          )}
                          <span>{formatCurrency(t.totalVariance, true)}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center print:hidden">
                        <button
                          onClick={() => onSelectRecord(rec.id)}
                          className="text-xs font-black uppercase tracking-wider underline text-black cursor-pointer hover:text-amber-600"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot className="bg-black text-white font-mono font-bold border-t-2 border-black text-base">
              <tr>
                <td className="py-4 px-4 font-serif italic text-white font-extrabold uppercase text-sm tracking-wider">Period Total</td>
                <td className="py-4 px-4 text-right text-base">
                  {formatCurrency(
                    currentWeekRecords.reduce(
                      (acc, r) => acc + calculateGrandTotals(r.rows).totalCol1Cash,
                      0
                    )
                  )}
                </td>
                <td className="py-4 px-4 text-right text-base">
                  {formatCurrency(
                    currentWeekRecords.reduce(
                      (acc, r) => acc + calculateGrandTotals(r.rows).totalCol2Card,
                      0
                    )
                  )}
                </td>
                <td className="py-4 px-4 text-right text-white font-black bg-zinc-800 text-base border-x border-zinc-700">
                  {formatCurrency(weeklyExpectedSum)}
                </td>
                <td className="py-4 px-4 text-right text-base">
                  {formatCurrency(weeklyBankingSum)}
                </td>
                <td className="py-4 px-4 text-right text-base">{formatCurrency(weeklyCardSum)}</td>
                <td className="py-4 px-4 text-right text-white font-black bg-zinc-800 text-base border-x border-zinc-700">{formatCurrency(weeklyActualSum)}</td>
                <td className="py-4 px-4 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-extrabold border ${
                      weeklyVarianceSum < 0
                        ? 'bg-rose-600 border-white text-white'
                        : weeklyVarianceSum > 0
                        ? 'bg-emerald-600 border-white text-white'
                        : 'bg-zinc-800 border-zinc-600 text-white'
                    }`}
                  >
                    {weeklyVarianceSum < 0 ? (
                      <TrendingDown className="w-4 h-4 shrink-0 print:hidden" />
                    ) : weeklyVarianceSum > 0 ? (
                      <TrendingUp className="w-4 h-4 shrink-0 print:hidden" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white print:hidden" />
                    )}
                    <span>{formatCurrency(weeklyVarianceSum, true)}</span>
                  </span>
                </td>
                <td className="py-4 px-4 print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dedicated Weekly Online Sales & VAT Audit Section */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="p-4 bg-sky-900 text-white border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-black text-amber-400 border border-sky-400 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif italic font-bold text-lg text-white">
                  Weekly Online Sales &amp; VAT Audit
                </h3>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-sky-400 text-black px-2 py-0.5 rounded">
                  Card Only • No Float
                </span>
              </div>
              <p className="text-xs text-sky-200 font-sans">
                Non-physical credit card orders, merchant settlement, and output VAT breakdown for this calendar week
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="bg-sky-950 border border-sky-400/60 px-3 py-1.5 text-right">
              <div className="text-[9px] uppercase tracking-wider text-sky-300 font-bold">Total Weekly VAT</div>
              <div className="font-black text-amber-400 text-sm sm:text-base">{formatCurrency(weeklyOnlineVatSum)}</div>
            </div>
            <div className="bg-sky-950 border border-sky-400/60 px-3 py-1.5 text-right">
              <div className="text-[9px] uppercase tracking-wider text-sky-300 font-bold">Net Sales (Ex-VAT)</div>
              <div className="font-black text-white text-sm sm:text-base">{formatCurrency(weeklyOnlineNetSum)}</div>
            </div>
            <div className="bg-sky-950 border border-sky-400/60 px-3 py-1.5 text-right">
              <div className="text-[9px] uppercase tracking-wider text-sky-300 font-bold">Gross Online Takings</div>
              <div className="font-black text-white text-sm sm:text-base">{formatCurrency(weeklyOnlineTakingsSum)}</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse font-mono text-xs">
            <thead className="bg-black text-white font-serif italic border-b border-black text-xs">
              <tr>
                <th className="py-3 px-4 font-bold">Trading Date</th>
                <th className="py-3 px-4 font-bold">Operator</th>
                <th className="py-3 px-4 text-right font-bold">Sys Card (2)</th>
                <th className="py-3 px-4 text-right font-bold">Card PDQ (6)</th>
                <th className="py-3 px-4 text-right font-black bg-zinc-900 text-amber-300 border-x border-zinc-700">Gross Online Takings</th>
                <th className="py-3 px-4 text-right font-black bg-sky-950 text-sky-200 border-r border-sky-800">Online VAT</th>
                <th className="py-3 px-4 text-right font-bold">Net Sales (Ex-VAT)</th>
                <th className="py-3 px-4 text-center font-bold">Reconciliation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-black">
              {onlineSalesData.map((d) => (
                <tr key={d.recordId} className="hover:bg-sky-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-black flex items-center gap-2">
                    <span className="font-sans text-[10px] uppercase font-extrabold bg-zinc-200 text-zinc-900 px-1.5 py-0.5 rounded">
                      {d.dayName.slice(0, 3)}
                    </span>
                    <span>{formatToUKDate(d.date)}</span>
                  </td>
                  <td className="py-3 px-4 text-zinc-700 font-sans">{d.operator}</td>
                  <td className="py-3 px-4 text-right font-semibold text-zinc-800">{formatCurrency(d.cardExpected)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-zinc-800">{formatCurrency(d.cardActual)}</td>
                  <td className="py-3 px-4 text-right font-black bg-zinc-100 text-black border-x border-zinc-200">{formatCurrency(d.cardTakings)}</td>
                  <td className="py-3 px-4 text-right font-black bg-sky-50 text-sky-950 border-r border-zinc-200">
                    <span className="bg-sky-200 text-sky-950 px-2 py-0.5 rounded border border-sky-400 font-bold">
                      {formatCurrency(d.vat)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-zinc-800">{formatCurrency(d.netTakings)}</td>
                  <td className="py-3 px-4 text-center">
                    {d.cardTakings === 0 && d.vat === 0 ? (
                      <span className="text-[10px] text-zinc-400 font-sans">No Online Orders</span>
                    ) : d.isMatch ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-500 px-2.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" /> Matched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] text-amber-900 bg-amber-100 border border-amber-500 px-2 py-0.5 rounded">
                        <TrendingDown className="w-3 h-3 text-amber-700 shrink-0" /> Diff: £{d.diff.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-black text-white font-mono font-black border-t-2 border-black text-xs sm:text-sm">
              <tr>
                <td className="py-3 px-4 uppercase text-amber-400 font-serif italic" colSpan={2}>
                  WEEKLY ONLINE TOTALS
                </td>
                <td className="py-3 px-4 text-right">
                  {formatCurrency(onlineSalesData.reduce((sum, d) => sum + d.cardExpected, 0))}
                </td>
                <td className="py-3 px-4 text-right">
                  {formatCurrency(onlineSalesData.reduce((sum, d) => sum + d.cardActual, 0))}
                </td>
                <td className="py-3 px-4 text-right text-amber-400 bg-zinc-900 border-x border-zinc-800">
                  {formatCurrency(weeklyOnlineTakingsSum)}
                </td>
                <td className="py-3 px-4 text-right bg-sky-950 text-amber-300 border-r border-sky-800 font-black">
                  {formatCurrency(weeklyOnlineVatSum)}
                </td>
                <td className="py-3 px-4 text-right font-black">
                  {formatCurrency(weeklyOnlineNetSum)}
                </td>
                <td className="py-3 px-4 text-center text-emerald-400 font-sans text-[10px] font-bold">
                  {onlineSalesData.every((d) => d.isMatch) ? 'All Days Reconciled' : 'Discrepancies Monitored'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Print & PDF Export Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:hidden">
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-black text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400 text-black border border-black font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif italic text-lg sm:text-xl font-bold text-white">
                    Print / Save Weekly Report
                  </h3>
                  <p className="text-xs font-mono text-zinc-400">
                    Select your preferred print method below
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Options Action Bar */}
            <div className="bg-amber-100 p-4 border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-amber-950 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                If the browser print dialog didn't open automatically, use the buttons below:
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {printBlobUrl && (
                  <a
                    href={printBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Printable Page in New Tab
                  </a>
                )}

                <button
                  onClick={async () => {
                    const html = generatePrintHtml();
                    const printed = await triggerBrowserPrint(html);
                    if (!printed) {
                      openPrintableTab(html);
                    }
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  Print (Ctrl+P)
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-100 text-black font-bold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Download PDF directly"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  ) : (
                    <Download className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{isExportingPDF ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>

                {printBlobUrl && (
                  <a
                    href={printBlobUrl}
                    download={`Weekly_Till_Report_${new Date().toISOString().slice(0, 10)}.html`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider px-3.5 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download HTML
                  </a>
                )}
              </div>
            </div>

            {/* Document Preview */}
            <div className="flex-1 p-4 bg-zinc-100 overflow-y-auto max-h-[60vh]">
              <div className="bg-white p-6 sm:p-8 border-2 border-black shadow-sm text-black space-y-6">
                <div className="border-b-2 border-black pb-4 flex justify-between items-end">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Operational Audit & Reconciliation
                    </div>
                    <h2 className="text-xl font-serif italic font-bold">
                      Weekly Till Reconciliation Summary Report
                    </h2>
                    <p className="text-xs font-mono text-zinc-600 mt-1">
                      Period:{' '}
                      <span className="font-bold">
                        {currentWeekRecords.length > 0
                          ? formatToUKDate(currentWeekRecords[currentWeekRecords.length - 1].date)
                          : 'N/A'}{' '}
                        to{' '}
                        {currentWeekRecords.length > 0
                          ? formatToUKDate(currentWeekRecords[0].date)
                          : 'N/A'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono text-zinc-500">
                    <div>Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div>Days: {currentWeekRecords.length}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="border-2 border-black p-3 bg-zinc-50">
                    <div className="text-[9px] font-bold uppercase text-zinc-500">Weekly Expected</div>
                    <div className="text-lg font-mono font-bold">{formatCurrency(weeklyExpectedSum)}</div>
                  </div>
                  <div className="border-2 border-black p-3 bg-zinc-50">
                    <div className="text-[9px] font-bold uppercase text-zinc-500">Total Cash Banked</div>
                    <div className="text-lg font-mono font-bold">{formatCurrency(weeklyBankingSum)}</div>
                  </div>
                  <div className="border-2 border-black p-3 bg-zinc-50">
                    <div className="text-[9px] font-bold uppercase text-zinc-500">Total Card Takings</div>
                    <div className="text-lg font-mono font-bold">{formatCurrency(weeklyCardSum)}</div>
                  </div>
                  <div className="border-2 border-black p-3 bg-zinc-50">
                    <div className="text-[9px] font-bold uppercase text-zinc-500">Net Variance</div>
                    <div className="text-lg font-mono font-bold">{formatCurrency(weeklyVarianceSum, true)}</div>
                  </div>
                  <div className="border-2 border-sky-600 p-3 bg-sky-50">
                    <div className="text-[9px] font-bold uppercase text-sky-900 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-sky-700" /> Online Sales &amp; VAT
                    </div>
                    <div className="text-lg font-mono font-bold text-sky-950">{formatCurrency(weeklyOnlineTakingsSum)}</div>
                    <div className="text-[10px] font-mono text-sky-800 mt-0.5">
                      VAT: <strong>{formatCurrency(weeklyOnlineVatSum)}</strong>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-black text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Operator</th>
                        <th className="p-2.5 text-right">(B) Sys Cash</th>
                        <th className="p-2.5 text-right">(C) Sys Card</th>
                        <th className="p-2.5 text-right bg-zinc-800 text-white font-bold">(D) Sys Total</th>
                        <th className="p-2.5 text-right">(E) Banking</th>
                        <th className="p-2.5 text-right">(G) Card PDQ</th>
                        <th className="p-2.5 text-right bg-zinc-800 text-white font-bold">(H) Actual Total</th>
                        <th className="p-2.5 text-right">(I) Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 font-mono">
                      {currentWeekRecords.map((rec) => {
                        const t = calculateGrandTotals(rec.rows, rec, records);
                        return (
                          <tr key={rec.id}>
                            <td className="p-2.5 font-bold">{formatToUKDate(rec.date)}</td>
                            <td className="p-2.5 font-sans">{rec.operator || '—'}</td>
                            <td className="p-2.5 text-right">{formatCurrency(t.totalCol1Cash)}</td>
                            <td className="p-2.5 text-right">{formatCurrency(t.totalCol2Card)}</td>
                            <td className="p-2.5 text-right font-bold bg-zinc-50">{formatCurrency(t.totalCol3Expected)}</td>
                            <td className="p-2.5 text-right font-bold">{formatCurrency(t.totalCol4Banking)}</td>
                            <td className="p-2.5 text-right">{formatCurrency(t.totalCol6Card)}</td>
                            <td className="p-2.5 text-right font-bold bg-zinc-50">{formatCurrency(t.totalCol7Actual)}</td>
                            <td className={`p-2.5 text-right font-bold ${t.totalVariance < 0 ? 'text-rose-600' : t.totalVariance > 0 ? 'text-emerald-700' : ''}`}>
                              {formatCurrency(t.totalVariance, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-black text-white font-mono font-black text-sm sm:text-base border-t-4 border-black">
                      <tr>
                        <td className="p-3 text-white font-serif italic font-black text-sm sm:text-base bg-black">WEEKLY TOTALS</td>
                        <td className="p-3 bg-black"></td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows).totalCol1Cash, 0))}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(currentWeekRecords.reduce((a, r) => a + calculateGrandTotals(r.rows).totalCol2Card, 0))}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(weeklyExpectedSum)}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(weeklyBankingSum)}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(weeklyCardSum)}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(weeklyActualSum)}</td>
                        <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">{formatCurrency(weeklyVarianceSum, true)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Modal Online Sales & VAT Table */}
                <div className="border-2 border-black overflow-hidden">
                  <div className="bg-sky-900 text-white p-2.5 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-sky-400" />
                      Weekly Online Sales &amp; VAT Audit
                    </span>
                    <span>VAT: <strong>{formatCurrency(weeklyOnlineVatSum)}</strong> | Net Ex-VAT: <strong>{formatCurrency(weeklyOnlineNetSum)}</strong></span>
                  </div>
                  <table className="w-full text-xs text-left font-mono">
                    <thead className="bg-black text-white text-[10px] uppercase font-bold">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Operator</th>
                        <th className="p-2 text-right">Sys Card (2)</th>
                        <th className="p-2 text-right">PDQ Card (6)</th>
                        <th className="p-2 text-right bg-zinc-800 text-amber-300">Online Takings</th>
                        <th className="p-2 text-right bg-sky-950 text-sky-300">Online VAT</th>
                        <th className="p-2 text-right">Net Ex-VAT</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {onlineSalesData.map((d) => (
                        <tr key={d.recordId}>
                          <td className="p-2 font-bold">{formatToUKDate(d.date)}</td>
                          <td className="p-2 font-sans">{d.operator}</td>
                          <td className="p-2 text-right">{formatCurrency(d.cardExpected)}</td>
                          <td className="p-2 text-right">{formatCurrency(d.cardActual)}</td>
                          <td className="p-2 text-right font-bold bg-zinc-50">{formatCurrency(d.cardTakings)}</td>
                          <td className="p-2 text-right font-bold text-sky-900 bg-sky-50">{formatCurrency(d.vat)}</td>
                          <td className="p-2 text-right">{formatCurrency(d.netTakings)}</td>
                          <td className="p-2 text-center text-[10px]">
                            {d.isMatch ? <span className="text-emerald-700 font-bold">Matched</span> : <span className="text-rose-600 font-bold">Diff £{d.diff.toFixed(2)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-black text-white font-bold text-xs">
                      <tr>
                        <td className="p-2" colSpan={2}>ONLINE TOTALS</td>
                        <td className="p-2 text-right">{formatCurrency(onlineSalesData.reduce((s, d) => s + d.cardExpected, 0))}</td>
                        <td className="p-2 text-right">{formatCurrency(onlineSalesData.reduce((s, d) => s + d.cardActual, 0))}</td>
                        <td className="p-2 text-right text-amber-400">{formatCurrency(weeklyOnlineTakingsSum)}</td>
                        <td className="p-2 text-right text-sky-300 bg-sky-950">{formatCurrency(weeklyOnlineVatSum)}</td>
                        <td className="p-2 text-right">{formatCurrency(weeklyOnlineNetSum)}</td>
                        <td className="p-2 text-center text-emerald-400">{onlineSalesData.every(d => d.isMatch) ? 'Reconciled' : 'Monitored'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-zinc-100 p-3 border-t-2 border-black flex justify-end">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider border-2 border-black cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
