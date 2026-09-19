import React, { useState, useMemo, useEffect } from 'react';
import { SheetRecord, TillRowData } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import {
  calculateGrandTotals,
  downloadCSV,
  formatCurrency,
  formatToUKDate,
  sortRecordsByDate,
  getDayOfWeekName,
  getRowExpectedTotal,
  getRowActualTotal,
  getRowVariance,
  filterRecordsByFinancialYear,
} from '../utils/calculations';
import {
  Calendar,
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Scale,
  CheckCircle2,
  AlertTriangle,
  User,
  ExternalLink,
  Download,
  X,
  Filter,
  Layers,
  BarChart3,
  RotateCcw,
  Receipt,
  Coins,
  CreditCard,
  Building2,
  Check,
  Loader2,
} from 'lucide-react';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';
import { exportMonthlyReportToPDF } from '../utils/pdfExport';
import { triggerBrowserPrint, openPrintableTab } from '../utils/printHelper';

interface MonthlyReportViewProps {
  records: SheetRecord[];
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  onBackToSheet: () => void;
  onSelectRecord: (id: string) => void;
  operators?: string[];
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  records = [],
  selectedYear = 'all',
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  onBackToSheet,
  onSelectRecord,
  operators = [],
}) => {
  // Sort records chronologically (oldest to newest)
  const sortedRecords = useMemo(() => {
    return sortRecordsByDate(records).reverse();
  }, [records]);

  // Determine initial date range: default to current month or latest record month
  const initialDates = useMemo(() => {
    if (sortedRecords.length > 0) {
      const latestRecordDate = sortedRecords[sortedRecords.length - 1].date;
      const parts = latestRecordDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const startISO = `${y}-${String(m).padStart(2, '0')}-01`;
      // Find last day of month
      const lastDay = new Date(y, m, 0).getDate();
      const endISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start: startISO, end: endISO };
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const startISO = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start: startISO, end: endISO };
  }, [sortedRecords]);

  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'discrepancies' | 'balanced'>('all');
  const [activeChartTab, setActiveChartTab] = useState<'takings' | 'variance'>('takings');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);

  // Available unique Year-Month combinations in dataset for quick month picker
  const availableMonths = useMemo(() => {
    const map = new Map<string, { label: string; year: number; month: number; count: number }>();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    sortedRecords.forEach((r) => {
      if (!r.date || !r.date.includes('-')) return;
      const parts = r.date.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          label: `${monthNames[m - 1]} ${y}`,
          year: y,
          month: m,
          count: 0,
        });
      }
      map.get(key)!.count += 1;
    });

    // Also ensure current month is in list
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(curKey)) {
      map.set(curKey, {
        label: `${monthNames[cur.getMonth()]} ${cur.getFullYear()}`,
        year: cur.getFullYear(),
        month: cur.getMonth() + 1,
        count: 0,
      });
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({ key, ...data }));
  }, [sortedRecords]);

  // Handle Quick Month Selection
  const handleSelectMonth = (yearMonthKey: string) => {
    if (!yearMonthKey) return;
    const parts = yearMonthKey.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const startISO = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(startISO);
    setEndDate(endISO);
  };

  // Quick Preset Handlers
  const handleApplyPreset = (preset: 'thisMonth' | 'lastMonth' | 'last30' | 'last60' | 'thisQuarter' | 'all') => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    if (preset === 'thisMonth') {
      const y = currentYear;
      const m = currentMonth + 1;
      const startISO = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(startISO);
      setEndDate(endISO);
    } else if (preset === 'lastMonth') {
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const y = prevDate.getFullYear();
      const m = prevDate.getMonth() + 1;
      const startISO = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(startISO);
      setEndDate(endISO);
    } else if (preset === 'last30') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 29);
      setStartDate(startD.toISOString().split('T')[0]);
      setEndDate(endD.toISOString().split('T')[0]);
    } else if (preset === 'last60') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 59);
      setStartDate(startD.toISOString().split('T')[0]);
      setEndDate(endD.toISOString().split('T')[0]);
    } else if (preset === 'thisQuarter') {
      const quarter = Math.floor(currentMonth / 3);
      const startMonth = quarter * 3 + 1;
      const endMonth = startMonth + 2;
      const startISO = `${currentYear}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, endMonth, 0).getDate();
      const endISO = `${currentYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(startISO);
      setEndDate(endISO);
    } else if (preset === 'all') {
      if (sortedRecords.length > 0) {
        setStartDate(sortedRecords[0].date);
        setEndDate(sortedRecords[sortedRecords.length - 1].date);
      }
    }
  };

  // Filtered records based on user's entered date range & filters
  const filteredRecords = useMemo(() => {
    let list = sortedRecords.filter((rec) => {
      const inDateRange = rec.date >= startDate && rec.date <= endDate;
      const matchesOperator = selectedOperator === 'all' || rec.operator === selectedOperator;
      return inDateRange && matchesOperator;
    });

    if (varianceFilter === 'discrepancies') {
      list = list.filter((rec) => {
        const t = calculateGrandTotals(rec.rows, rec, records);
        return Math.abs(t.totalVariance) >= 0.01;
      });
    } else if (varianceFilter === 'balanced') {
      list = list.filter((rec) => {
        const t = calculateGrandTotals(rec.rows, rec, records);
        return Math.abs(t.totalVariance) < 0.01;
      });
    }

    return list;
  }, [sortedRecords, startDate, endDate, selectedOperator, varianceFilter, records]);

  // Aggregate Range Summary Totals
  const rangeTotals = useMemo(() => {
    let expCash = 0;
    let expCard = 0;
    let expTotal = 0;
    let bankingCash = 0;
    let floatCash = 0;
    let actualCard = 0;
    let actualTotal = 0;
    let varianceTotal = 0;
    let daysWithOver = 0;
    let daysWithShort = 0;
    let daysBalanced = 0;

    filteredRecords.forEach((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, records);
      expCash += t.totalCol1Cash;
      expCard += t.totalCol2Card;
      expTotal += t.totalCol3Expected;
      bankingCash += t.totalCol4Banking;
      floatCash += t.totalCol5Float;
      actualCard += t.totalCol6Card;
      actualTotal += t.totalCol7Actual;
      varianceTotal += t.totalVariance;

      if (t.totalVariance > 0.009) daysWithOver++;
      else if (t.totalVariance < -0.009) daysWithShort++;
      else daysBalanced++;
    });

    const daysCount = filteredRecords.length;
    const avgDailyExpected = daysCount > 0 ? expTotal / daysCount : 0;
    const avgDailyActual = daysCount > 0 ? actualTotal / daysCount : 0;
    const avgDailyVariance = daysCount > 0 ? varianceTotal / daysCount : 0;

    const totalTakingsCounted = bankingCash + actualCard;
    const cardPercentage = totalTakingsCounted > 0 ? (actualCard / totalTakingsCounted) * 100 : 0;
    const cashPercentage = totalTakingsCounted > 0 ? (bankingCash / totalTakingsCounted) * 100 : 0;

    return {
      expCash,
      expCard,
      expTotal,
      bankingCash,
      floatCash,
      actualCard,
      actualTotal,
      varianceTotal,
      daysCount,
      avgDailyExpected,
      avgDailyActual,
      avgDailyVariance,
      cardPercentage,
      cashPercentage,
      daysWithOver,
      daysWithShort,
      daysBalanced,
    };
  }, [filteredRecords, records]);

  // Aggregation by Register / Till Row across the date range
  const registerBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        isYard: boolean;
        col1ExpectedCash: number;
        col2ExpectedCard: number;
        col3ExpectedTotal: number;
        col4BankingCash: number;
        col5FloatCash: number;
        col6ActualCard: number;
        col7ActualTotal: number;
        variance: number;
        count: number;
      }
    >();

    filteredRecords.forEach((rec) => {
      rec.rows.forEach((row) => {
        const key = row.name || 'Till';
        if (!map.has(key)) {
          map.set(key, {
            name: row.name,
            isYard: !!row.isYard,
            col1ExpectedCash: 0,
            col2ExpectedCard: 0,
            col3ExpectedTotal: 0,
            col4BankingCash: 0,
            col5FloatCash: 0,
            col6ActualCard: 0,
            col7ActualTotal: 0,
            variance: 0,
            count: 0,
          });
        }
        const item = map.get(key)!;
        const rowExp = getRowExpectedTotal(row);
        const rowAct = getRowActualTotal(row);
        const rowVar = getRowVariance(row, rec, records);

        item.col1ExpectedCash += row.col1ExpectedCash || 0;
        item.col2ExpectedCard += row.col2ExpectedCard || 0;
        item.col3ExpectedTotal += rowExp;
        item.col4BankingCash += row.col4BankingCash || 0;
        item.col5FloatCash += row.col5FloatCash || 0;
        item.col6ActualCard += row.col6ActualCard || 0;
        item.col7ActualTotal += rowAct;
        item.variance += rowVar;
        item.count += 1;
      });
    });

    return Array.from(map.values());
  }, [filteredRecords, records]);

  // Chart dataset
  const chartData = useMemo(() => {
    return filteredRecords.map((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, records);
      const dayName = getDayOfWeekName(rec.date);
      const ukDate = formatToUKDate(rec.date);
      return {
        dateISO: rec.date,
        label: `${dayName.slice(0, 3)} ${ukDate.slice(0, 5)}`,
        fullDate: `${dayName}, ${ukDate}`,
        expected: Number(t.totalCol3Expected.toFixed(2)),
        actual: Number(t.totalCol7Actual.toFixed(2)),
        banking: Number(t.totalCol4Banking.toFixed(2)),
        card: Number(t.totalCol6Card.toFixed(2)),
        variance: Number(t.totalVariance.toFixed(2)),
        operator: rec.operator || 'Unassigned',
      };
    });
  }, [filteredRecords, records]);

  // Export to CSV
  const handleExportCSV = () => {
    const lines: string[] = [
      'Monthly Till Reconciliation Summary & Audit Report',
      `Date Range: ${formatToUKDate(startDate)} to ${formatToUKDate(endDate)}`,
      `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`,
      `Filter Operator: ${selectedOperator === 'all' ? 'All Staff' : selectedOperator}`,
      `Logged Trading Days: ${rangeTotals.daysCount}`,
      '',
      '=== EXECUTIVE RANGE TOTALS ===',
      `System Expected Cash (Col 1),£${rangeTotals.expCash.toFixed(2)}`,
      `System Expected Card (Col 2),£${rangeTotals.expCard.toFixed(2)}`,
      `Total System Expected Takings (Col 3),£${rangeTotals.expTotal.toFixed(2)}`,
      `Total Cash Banked (Col 4),£${rangeTotals.bankingCash.toFixed(2)}`,
      `Total Card PDQ Takings (Col 6),£${rangeTotals.actualCard.toFixed(2)}`,
      `Total Actual Counted (Col 7),£${rangeTotals.actualTotal.toFixed(2)}`,
      `Net Over/Short Variance,£${rangeTotals.varianceTotal.toFixed(2)}`,
      `Average Daily Takings,£${rangeTotals.avgDailyExpected.toFixed(2)}`,
      '',
      '=== REGISTER / TILL SUMMARY ===',
      'Register,Expected Cash,Expected Card,Total Expected,Cash Banked,Card PDQ,Actual Total,Net Variance',
    ];

    registerBreakdown.forEach((reg) => {
      lines.push(
        [
          `"${reg.name}"`,
          reg.col1ExpectedCash.toFixed(2),
          reg.col2ExpectedCard.toFixed(2),
          reg.col3ExpectedTotal.toFixed(2),
          reg.col4BankingCash.toFixed(2),
          reg.col6ActualCard.toFixed(2),
          reg.col7ActualTotal.toFixed(2),
          reg.variance.toFixed(2),
        ].join(',')
      );
    });

    lines.push('');
    lines.push('=== DAILY BREAKDOWN LEDGER ===');
    lines.push(
      'Date,Day,Operator,Col 1 Sys Cash,Col 2 Sys Card,Col 3 Sys Expected,Col 4 Banked Cash,Col 5 Float,Col 6 Card PDQ,Col 7 Actual Counted,Col 8 Variance,Status'
    );

    filteredRecords.forEach((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, records);
      const dayName = getDayOfWeekName(rec.date);
      const status = t.totalVariance > 0.009 ? 'OVER' : t.totalVariance < -0.009 ? 'SHORT' : 'BALANCED';
      lines.push(
        [
          formatToUKDate(rec.date),
          dayName,
          `"${rec.operator || '—'}"`,
          t.totalCol1Cash.toFixed(2),
          t.totalCol2Card.toFixed(2),
          t.totalCol3Expected.toFixed(2),
          t.totalCol4Banking.toFixed(2),
          t.totalCol5Float.toFixed(2),
          t.totalCol6Card.toFixed(2),
          t.totalCol7Actual.toFixed(2),
          t.totalVariance.toFixed(2),
          status,
        ].join(',')
      );
    });

    lines.push(
      [
        'TOTALS',
        '',
        '',
        rangeTotals.expCash.toFixed(2),
        rangeTotals.expCard.toFixed(2),
        rangeTotals.expTotal.toFixed(2),
        rangeTotals.bankingCash.toFixed(2),
        rangeTotals.floatCash.toFixed(2),
        rangeTotals.actualCard.toFixed(2),
        rangeTotals.actualTotal.toFixed(2),
        rangeTotals.varianceTotal.toFixed(2),
        rangeTotals.varianceTotal > 0.009 ? 'NET OVER' : rangeTotals.varianceTotal < -0.009 ? 'NET SHORT' : 'BALANCED',
      ].join(',')
    );

    const safeStart = startDate.replace(/-/g, '');
    const safeEnd = endDate.replace(/-/g, '');
    downloadCSV(`Monthly_Till_Report_${safeStart}_to_${safeEnd}.csv`, lines.join('\n'));
  };

  // Generate printable HTML document
  const generatePrintHtml = () => {
    const printDate = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const startUK = formatToUKDate(startDate);
    const endUK = formatToUKDate(endDate);

    const dailyRowsHtml =
      filteredRecords.length === 0
        ? `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #71717a;">No records found within date range ${startUK} to ${endUK}.</td></tr>`
        : filteredRecords
            .map((rec) => {
              const t = calculateGrandTotals(rec.rows, rec, records);
              const dayName = getDayOfWeekName(rec.date);
              const varColor =
                t.totalVariance < -0.009
                  ? 'color: #dc2626; font-weight: bold;'
                  : t.totalVariance > 0.009
                  ? 'color: #15803d; font-weight: bold;'
                  : 'color: #000; font-weight: bold;';
              const varLabel =
                t.totalVariance < -0.009 ? 'SHORT' : t.totalVariance > 0.009 ? 'OVER' : 'OK';

              return `
                <tr style="border-bottom: 1px solid #e4e4e7;">
                  <td style="padding: 7px 6px; font-family: monospace; font-weight: bold;"><strong>${dayName.slice(
                    0,
                    3
                  )}</strong> ${formatToUKDate(rec.date)}</td>
                  <td style="padding: 7px 6px;">${rec.operator || '—'}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace;">${formatCurrency(
                    t.totalCol1Cash
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace;">${formatCurrency(
                    t.totalCol2Card
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: bold; background: #f4f4f5;">${formatCurrency(
                    t.totalCol3Expected
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(
                    t.totalCol4Banking
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace;">${formatCurrency(
                    t.totalCol6Card
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: bold; background: #f4f4f5;">${formatCurrency(
                    t.totalCol7Actual
                  )}</td>
                  <td style="padding: 7px 6px; text-align: right; font-family: monospace; ${varColor}">${formatCurrency(
                t.totalVariance,
                true
              )}</td>
                  <td style="padding: 7px 6px; text-align: center; font-size: 10px; font-weight: bold;">${varLabel}</td>
                </tr>
              `;
            })
            .join('');

    const registersHtml = registerBreakdown
      .map((reg) => {
        const varStyle =
          reg.variance < -0.009
            ? 'color: #dc2626; font-weight: bold;'
            : reg.variance > 0.009
            ? 'color: #15803d; font-weight: bold;'
            : 'color: #000; font-weight: bold;';

        return `
          <tr style="border-bottom: 1px solid #e4e4e7;">
            <td style="padding: 7px 8px; font-weight: bold;">${reg.name}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace;">${formatCurrency(
              reg.col1ExpectedCash
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace;">${formatCurrency(
              reg.col2ExpectedCard
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: bold; background: #fafafa;">${formatCurrency(
              reg.col3ExpectedTotal
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(
              reg.col4BankingCash
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace;">${formatCurrency(
              reg.col6ActualCard
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: bold; background: #fafafa;">${formatCurrency(
              reg.col7ActualTotal
            )}</td>
            <td style="padding: 7px 8px; text-align: right; font-family: monospace; ${varStyle}">${formatCurrency(
          reg.variance,
          true
        )}</td>
          </tr>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Monthly Till Reconciliation Summary & Audit Report</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
      }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 18px; color: #000; background: #fff; line-height: 1.35; font-size: 11px; }
      .print-btn { background: #fbbf24; color: #000; border: 2px solid #000; font-weight: bold; padding: 8px 18px; cursor: pointer; font-size: 13px; margin-bottom: 16px; text-decoration: none; display: inline-block; }
      .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
      .title-sub { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: #52525b; }
      h1 { font-family: Georgia, serif; font-style: italic; margin: 2px 0 4px 0; font-size: 22px; color: #000; }
      .period { font-size: 12px; font-family: monospace; color: #18181b; }
      .meta { text-align: right; font-size: 10px; font-family: monospace; color: #52525b; }
      .stats { display: flex; gap: 10px; margin-bottom: 16px; }
      .card { flex: 1; border: 2px solid #000; padding: 10px; background: #fafafa; }
      .card-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #52525b; }
      .card-val { font-size: 18px; font-family: monospace; font-weight: bold; margin-top: 3px; color: #000; }
      .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 16px 0 8px 0; border-bottom: 1.5px solid #000; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; margin-bottom: 16px; }
      th { background: #000; color: #fff; padding: 7px 6px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; }
      td { border-bottom: 1px solid #e4e4e7; }
      tfoot tr { background: #000000 !important; color: #ffffff !important; font-family: monospace; font-weight: 900 !important; }
      tfoot td { padding: 8px 6px !important; font-weight: 900 !important; font-size: 11px !important; color: #ffffff !important; background-color: #000000 !important; border-top: 2px solid #000 !important; }
      .signoff { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1.5px dashed #a1a1aa; page-break-inside: avoid; }
      .sign-box { width: 30%; }
      .sign-line { border-bottom: 1.5px solid #000; height: 32px; margin-bottom: 6px; }
      .sign-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #52525b; }
    </style>
  </head>
  <body>
    <div class="no-print" style="background: #f4f4f5; border: 2px solid #000; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 13px;">🖨️ Monthly Reconciliation Report Print Document</strong>
      <button onclick="window.print()" class="print-btn" style="margin:0;">Click Here to Print / Save PDF</button>
    </div>

    <div class="header">
      <div>
        <div class="title-sub">Financial Audit & Reconciliation Ledger</div>
        <h1>Monthly Till Reconciliation Summary Report</h1>
        <div class="period">Date Range: <strong>${startUK}</strong> to <strong>${endUK}</strong> (${filteredRecords.length} trading days)</div>
      </div>
      <div class="meta">
        <div>Generated: ${printDate}</div>
        <div>Operator Filter: ${selectedOperator === 'all' ? 'All Staff' : selectedOperator}</div>
      </div>
    </div>

    <div class="stats">
      <div class="card">
        <div class="card-title">Total System Expected</div>
        <div class="card-val">${formatCurrency(rangeTotals.expTotal)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Cash Banked</div>
        <div class="card-val">${formatCurrency(rangeTotals.bankingCash)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Card PDQ Takings</div>
        <div class="card-val">${formatCurrency(rangeTotals.actualCard)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Actual Counted</div>
        <div class="card-val">${formatCurrency(rangeTotals.actualTotal)}</div>
      </div>
      <div class="card" style="background: ${
        rangeTotals.varianceTotal < -0.009 ? '#fef2f2' : rangeTotals.varianceTotal > 0.009 ? '#f0fdf4' : '#fafafa'
      };">
        <div class="card-title">Net Over / Short</div>
        <div class="card-val" style="${
          rangeTotals.varianceTotal < -0.009 ? 'color:#dc2626;' : rangeTotals.varianceTotal > 0.009 ? 'color:#15803d;' : 'color:#000;'
        }">${formatCurrency(rangeTotals.varianceTotal, true)}</div>
      </div>
    </div>

    <div class="section-title">1. Register / Till Summary (Aggregated over Range)</div>
    <table>
      <thead>
        <tr>
          <th>Register</th>
          <th style="text-align: right;">Col 1 Sys Cash</th>
          <th style="text-align: right;">Col 2 Sys Card</th>
          <th style="text-align: right;">Col 3 Total Expected</th>
          <th style="text-align: right;">Col 4 Cash Banked</th>
          <th style="text-align: right;">Col 6 Card PDQ</th>
          <th style="text-align: right;">Col 7 Actual Counted</th>
          <th style="text-align: right;">Col 8 Variance</th>
        </tr>
      </thead>
      <tbody>
        ${registersHtml}
      </tbody>
      <tfoot>
        <tr>
          <td>REGISTER TOTALS</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expCash)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expCard)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expTotal)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.bankingCash)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.actualCard)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.actualTotal)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.varianceTotal, true)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="section-title">2. Day-by-Day Daily Ledger</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Operator</th>
          <th style="text-align: right;">Col 1 Cash</th>
          <th style="text-align: right;">Col 2 Card</th>
          <th style="text-align: right;">Col 3 Expected</th>
          <th style="text-align: right;">Col 4 Banked</th>
          <th style="text-align: right;">Col 6 Card</th>
          <th style="text-align: right;">Col 7 Counted</th>
          <th style="text-align: right;">Col 8 Variance</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${dailyRowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td>PERIOD TOTALS</td>
          <td>${filteredRecords.length} days</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expCash)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expCard)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.expTotal)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.bankingCash)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.actualCard)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.actualTotal)}</td>
          <td style="text-align: right;">${formatCurrency(rangeTotals.varianceTotal, true)}</td>
          <td style="text-align: center;">${rangeTotals.varianceTotal > 0.009 ? 'OVER' : rangeTotals.varianceTotal < -0.009 ? 'SHORT' : 'BALANCED'}</td>
        </tr>
      </tfoot>
    </table>

    <div class="signoff">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Prepared By (Cashier / Duty Manager)</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Store Manager / General Manager</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Internal / Financial Auditor Sign-off</div>
      </div>
    </div>

    <script>
      window.addEventListener('load', function() {
        setTimeout(function() {
          try {
            window.print();
          } catch (e) {
            console.warn('Auto-print prevented by sandbox:', e);
          }
        }, 400);
      });
    </script>
  </body>
</html>`;
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportMonthlyReportToPDF({
        startDate,
        endDate,
        records: filteredRecords,
        allRecords: sortedRecords,
        rangeTotals,
        selectedOperator,
        registerBreakdown,
      });
    } catch (err) {
      console.error('Failed to export Monthly PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleTriggerPrint = async () => {
    const html = generatePrintHtml();
    const printed = await triggerBrowserPrint(html);
    if (!printed) {
      openPrintableTab(html);
    }
  };

  const handleOpenPrintPreview = () => {
    const html = generatePrintHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPrintBlobUrl(url);
    setIsPrintModalOpen(true);
  };

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (printBlobUrl) {
        URL.revokeObjectURL(printBlobUrl);
      }
    };
  }, [printBlobUrl]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Banner Navigation & Action Bar */}
      <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToSheet}
            className="p-2 border-2 border-black bg-zinc-100 hover:bg-amber-400 text-black active:scale-95 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            title="Back to Active Day Sheet"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-black bg-amber-400 px-2 py-0.5 border border-black shadow-xs">
                Monthly & Custom Period Audit
              </span>
              <span className="text-[10px] font-mono text-zinc-600 font-semibold">
                {rangeTotals.daysCount} trading {rangeTotals.daysCount === 1 ? 'day' : 'days'} in range
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-black tracking-tight mt-1 flex items-center gap-2 font-serif italic">
              Monthly Reconciliation Report
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-100 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Download CSV spreadsheet of this monthly report"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-100 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download high-definition PDF file directly"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <Download className="w-4 h-4 text-amber-600" />
            )}
            <span>{isExportingPDF ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handleOpenPrintPreview}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Print Monthly Report or Save as PDF"
          >
            <Printer className="w-4 h-4 text-black" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Interactive Date Range Controller Card */}
      <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-black uppercase tracking-wider">
              Date Range Selection
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-600">
            <span>Range:</span>
            <span className="bg-zinc-100 px-2 py-0.5 border border-zinc-400 text-black">
              {formatToUKDate(startDate)}
            </span>
            <span>to</span>
            <span className="bg-zinc-100 px-2 py-0.5 border border-zinc-400 text-black">
              {formatToUKDate(endDate)}
            </span>
          </div>
        </div>

        {/* Date Inputs & Month Quick Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Start Date Input */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
              Start Date (Enter / Pick)
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none focus:bg-amber-50 shadow-xs"
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              UK: {formatToUKDate(startDate)} ({getDayOfWeekName(startDate)})
            </div>
          </div>

          {/* End Date Input */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
              End Date (Enter / Pick)
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none focus:bg-amber-50 shadow-xs"
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              UK: {formatToUKDate(endDate)} ({getDayOfWeekName(endDate)})
            </div>
          </div>

          {/* Quick Month Dropdown Picker */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
              Quick Month Picker
            </label>
            <select
              onChange={(e) => handleSelectMonth(e.target.value)}
              defaultValue=""
              className="w-full bg-zinc-50 hover:bg-zinc-100 border-2 border-black px-3 py-2 text-xs font-bold text-black focus:outline-none focus:bg-amber-50 shadow-xs cursor-pointer"
            >
              <option value="" disabled>
                -- Choose Calendar Month --
              </option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {m.count > 0 ? `(${m.count} days)` : ''}
                </option>
              ))}
            </select>
            <div className="text-[10px] font-mono text-zinc-500">
              Auto-fills start & end of selected month
            </div>
          </div>

          {/* Operator / Staff Filter */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
              Staff / Operator Filter
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full bg-zinc-50 hover:bg-zinc-100 border-2 border-black px-3 py-2 text-xs font-bold text-black focus:outline-none focus:bg-amber-50 shadow-xs cursor-pointer"
            >
              <option value="all">All Staff & Operators</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <div className="text-[10px] font-mono text-zinc-500">
              Filter by specific till cashier
            </div>
          </div>
        </div>

        {/* Quick Range Shortcut Pills */}
        <div className="pt-2 border-t border-zinc-200 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mr-1">
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => handleApplyPreset('thisMonth')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('lastMonth')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            Last Month
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('last30')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('last60')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            Last 60 Days
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('thisQuarter')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            Current Quarter
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('all')}
            className="px-2.5 py-1 text-xs font-bold bg-zinc-100 hover:bg-amber-300 border border-black text-black active:scale-95 transition-all cursor-pointer"
          >
            All Recorded Dates
          </button>

          <div className="ml-auto flex items-center gap-1 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mr-1">
              Variance Filter:
            </span>
            <button
              onClick={() => setVarianceFilter('all')}
              className={`px-2 py-0.5 text-xs font-bold border ${
                varianceFilter === 'all'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              All Days
            </button>
            <button
              onClick={() => setVarianceFilter('discrepancies')}
              className={`px-2 py-0.5 text-xs font-bold border ${
                varianceFilter === 'discrepancies'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              Discrepancies Only
            </button>
            <button
              onClick={() => setVarianceFilter('balanced')}
              className={`px-2 py-0.5 text-xs font-bold border ${
                varianceFilter === 'balanced'
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              Balanced Only
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Total Expected Takings */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-zinc-700">
              Col 3 Sys Expected
            </span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-black mt-1">
            {formatCurrency(rangeTotals.expTotal)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1 flex justify-between">
            <span>Cash: {formatCurrency(rangeTotals.expCash)}</span>
            <span>Card: {formatCurrency(rangeTotals.expCard)}</span>
          </div>
        </div>

        {/* Metric 2: Cash Banked */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-zinc-700">
              Col 4 Cash Banked
            </span>
            <Building2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-black mt-1">
            {formatCurrency(rangeTotals.bankingCash)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">
            {rangeTotals.cashPercentage.toFixed(1)}% of total takings
          </div>
        </div>

        {/* Metric 3: Card Machine PDQ */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-zinc-700">
              Col 6 Card PDQ
            </span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-black mt-1">
            {formatCurrency(rangeTotals.actualCard)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">
            {rangeTotals.cardPercentage.toFixed(1)}% of total takings
          </div>
        </div>

        {/* Metric 4: Total Actual Counted */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-zinc-700">
              Col 7 Actual Counted
            </span>
            <Coins className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-black mt-1">
            {formatCurrency(rangeTotals.actualTotal)}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">
            Avg daily: {formatCurrency(rangeTotals.avgDailyActual)}
          </div>
        </div>

        {/* Metric 5: Net Over / Short Variance */}
        <div
          className={`col-span-2 md:col-span-1 border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
            rangeTotals.varianceTotal < -0.009
              ? 'bg-rose-50'
              : rangeTotals.varianceTotal > 0.009
              ? 'bg-emerald-50'
              : 'bg-zinc-50'
          }`}
        >
          <div className="flex items-center justify-between text-zinc-700">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider">
              Net Over / Short
            </span>
            <Scale
              className={`w-4 h-4 ${
                rangeTotals.varianceTotal < -0.009
                  ? 'text-rose-600'
                  : rangeTotals.varianceTotal > 0.009
                  ? 'text-emerald-600'
                  : 'text-zinc-600'
              }`}
            />
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
              rangeTotals.varianceTotal < -0.009
                ? 'text-rose-700'
                : rangeTotals.varianceTotal > 0.009
                ? 'text-emerald-700'
                : 'text-black'
            }`}
          >
            {formatCurrency(rangeTotals.varianceTotal, true)}
          </div>
          <div className="text-[10px] font-mono font-bold mt-1">
            {rangeTotals.varianceTotal < -0.009 ? (
              <span className="text-rose-700">⚠️ Net Shortage over period</span>
            ) : rangeTotals.varianceTotal > 0.009 ? (
              <span className="text-emerald-700">✓ Net Surplus over period</span>
            ) : (
              <span className="text-zinc-700">✓ Perfectly Balanced</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics Chart Section */}
      <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-black" />
            <h3 className="font-extrabold text-sm sm:text-base text-black uppercase tracking-wider">
              Daily Trend & Variance Analysis
            </h3>
          </div>
          <div className="flex items-center bg-zinc-100 p-1 border border-black gap-1">
            <button
              onClick={() => setActiveChartTab('takings')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeChartTab === 'takings' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
              }`}
            >
              Revenue Takings Trend
            </button>
            <button
              onClick={() => setActiveChartTab('variance')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeChartTab === 'variance' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
              }`}
            >
              Daily Variance (Overs & Shorts)
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-mono text-sm border-2 border-dashed border-zinc-300">
            No day sheet records found in date range {formatToUKDate(startDate)} to {formatToUKDate(endDate)}.
          </div>
        ) : activeChartTab === 'takings' ? (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="label"
                  stroke="#52525b"
                  fontSize={10}
                  tickMargin={8}
                  interval={chartData.length > 15 ? Math.ceil(chartData.length / 12) : 0}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={10}
                  tickFormatter={(val) => `£${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-black text-white border-2 border-amber-400 p-3 shadow-xl font-mono text-xs">
                          <div className="font-bold text-amber-400 border-b border-zinc-700 pb-1 mb-1.5">
                            {data.fullDate}
                          </div>
                          <div className="text-zinc-300">Operator: <strong className="text-white">{data.operator}</strong></div>
                          <div className="text-zinc-300 mt-1">Col 3 Expected: <strong className="text-amber-300">{formatCurrency(data.expected)}</strong></div>
                          <div className="text-zinc-300">Col 4 Cash Banked: <strong className="text-emerald-400">{formatCurrency(data.banking)}</strong></div>
                          <div className="text-zinc-300">Col 6 Card PDQ: <strong className="text-blue-400">{formatCurrency(data.card)}</strong></div>
                          <div className="text-zinc-300">Col 7 Counted: <strong className="text-white">{formatCurrency(data.actual)}</strong></div>
                          <div className="mt-1 pt-1 border-t border-zinc-700">
                            Variance: <strong className={data.variance > 0 ? 'text-emerald-400' : data.variance < 0 ? 'text-rose-400' : 'text-zinc-300'}>
                              {formatCurrency(data.variance, true)}
                            </strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 11, fontWeight: 'bold' }}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  name="Col 3 System Expected"
                  stroke="#000000"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#000000' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Col 7 Actual Counted"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="banking"
                  name="Col 4 Cash Banked"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="card"
                  name="Col 6 Card PDQ"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="label"
                  stroke="#52525b"
                  fontSize={10}
                  tickMargin={8}
                  interval={chartData.length > 15 ? Math.ceil(chartData.length / 12) : 0}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={10}
                  tickFormatter={(val) => `£${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-black text-white border-2 border-amber-400 p-3 shadow-xl font-mono text-xs">
                          <div className="font-bold text-amber-400 border-b border-zinc-700 pb-1 mb-1.5">
                            {data.fullDate}
                          </div>
                          <div>Operator: <strong>{data.operator}</strong></div>
                          <div className="mt-1">
                            Till Variance: <strong className={data.variance > 0 ? 'text-emerald-400' : data.variance < 0 ? 'text-rose-400' : 'text-zinc-300'}>
                              {formatCurrency(data.variance, true)}
                            </strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="#000000" strokeWidth={1.5} />
                <Bar dataKey="variance" name="Over / Short Variance">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.variance < -0.009 ? '#ef4444' : entry.variance > 0.009 ? '#10b981' : '#71717a'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Register / Till Aggregated Performance Table */}
      <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
        <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-black uppercase tracking-wider">
              Register / Till Summary (Aggregated over Selected Range)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-600">
            {registerBreakdown.length} registers active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-black text-xs font-mono">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-2.5 text-left font-bold uppercase tracking-wider border-r border-zinc-700">Register</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 1 Sys Cash</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 2 Sys Card</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700 bg-zinc-900 text-amber-300">Col 3 Sys Total</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 4 Banked</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 6 Card PDQ</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700 bg-zinc-900 text-white">Col 7 Actual</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider">Col 8 Variance</th>
              </tr>
            </thead>
            <tbody>
              {registerBreakdown.map((reg, idx) => {
                const varColor =
                  reg.variance < -0.009
                    ? 'text-rose-700 bg-rose-50'
                    : reg.variance > 0.009
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-zinc-800';

                return (
                  <tr
                    key={reg.name || idx}
                    className={`border-b border-zinc-300 hover:bg-amber-50/50 transition-colors ${
                      idx % 2 === 1 ? 'bg-zinc-50' : 'bg-white'
                    }`}
                  >
                    <td className="p-2.5 font-sans font-extrabold text-black border-r border-zinc-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 border border-black" />
                      {reg.name}
                    </td>
                    <td className="p-2.5 text-right border-r border-zinc-300 text-zinc-700">
                      {formatCurrency(reg.col1ExpectedCash)}
                    </td>
                    <td className="p-2.5 text-right border-r border-zinc-300 text-zinc-700">
                      {formatCurrency(reg.col2ExpectedCard)}
                    </td>
                    <td className="p-2.5 text-right font-bold border-r border-zinc-300 bg-amber-50 text-black">
                      {formatCurrency(reg.col3ExpectedTotal)}
                    </td>
                    <td className="p-2.5 text-right font-bold border-r border-zinc-300 text-emerald-800">
                      {formatCurrency(reg.col4BankingCash)}
                    </td>
                    <td className="p-2.5 text-right border-r border-zinc-300 text-blue-800">
                      {formatCurrency(reg.col6ActualCard)}
                    </td>
                    <td className="p-2.5 text-right font-bold border-r border-zinc-300 bg-zinc-100 text-black">
                      {formatCurrency(reg.col7ActualTotal)}
                    </td>
                    <td className={`p-2.5 text-right font-black ${varColor}`}>
                      {formatCurrency(reg.variance, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-black text-white font-mono font-black border-t-2 border-black">
                <td className="p-2.5 text-left border-r border-zinc-700">REGISTER TOTALS</td>
                <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.expCash)}</td>
                <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.expCard)}</td>
                <td className="p-2.5 text-right border-r border-zinc-700 text-amber-300">{formatCurrency(rangeTotals.expTotal)}</td>
                <td className="p-2.5 text-right border-r border-zinc-700 text-emerald-300">{formatCurrency(rangeTotals.bankingCash)}</td>
                <td className="p-2.5 text-right border-r border-zinc-700 text-blue-300">{formatCurrency(rangeTotals.actualCard)}</td>
                <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.actualTotal)}</td>
                <td className="p-2.5 text-right text-amber-300">{formatCurrency(rangeTotals.varianceTotal, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Daily Breakdown Ledger Table */}
      <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
        <div className="flex flex-wrap items-center justify-between border-b-2 border-black pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-black" />
            <h3 className="font-extrabold text-sm sm:text-base text-black uppercase tracking-wider">
              Day-by-Day Reconciliation Audit Ledger
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono font-bold text-zinc-600">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {rangeTotals.daysWithOver} Over
            </span>
            <span className="flex items-center gap-1 text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {rangeTotals.daysWithShort} Short
            </span>
            <span className="flex items-center gap-1 text-zinc-700">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              {rangeTotals.daysBalanced} Balanced
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-black text-xs font-mono">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-2.5 text-left font-bold uppercase tracking-wider border-r border-zinc-700">Date</th>
                <th className="p-2.5 text-left font-bold uppercase tracking-wider border-r border-zinc-700">Operator</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 1 Cash</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 2 Card</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700 bg-zinc-900 text-amber-300">Col 3 Expected</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 4 Banked</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 5 Float</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 6 Card</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700 bg-zinc-900 text-white">Col 7 Counted</th>
                <th className="p-2.5 text-right font-bold uppercase tracking-wider border-r border-zinc-700">Col 8 Variance</th>
                <th className="p-2.5 text-center font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-zinc-500 font-sans text-sm">
                    No records found matching the selected range and filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const t = calculateGrandTotals(rec.rows, rec, records);
                  const dayName = getDayOfWeekName(rec.date);
                  const ukDate = formatToUKDate(rec.date);
                  const isOver = t.totalVariance > 0.009;
                  const isShort = t.totalVariance < -0.009;

                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-zinc-300 hover:bg-amber-50/60 transition-colors ${
                        idx % 2 === 1 ? 'bg-zinc-50' : 'bg-white'
                      }`}
                    >
                      <td className="p-2.5 font-bold text-black border-r border-zinc-300 whitespace-nowrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-zinc-200 text-black px-1.5 py-0.5 rounded-xs mr-1.5">
                          {dayName.slice(0, 3)}
                        </span>
                        {ukDate}
                      </td>
                      <td className="p-2.5 border-r border-zinc-300 font-sans text-zinc-800 truncate max-w-[120px]">
                        {rec.operator || '—'}
                      </td>
                      <td className="p-2.5 text-right border-r border-zinc-300 text-zinc-700">
                        {formatCurrency(t.totalCol1Cash)}
                      </td>
                      <td className="p-2.5 text-right border-r border-zinc-300 text-zinc-700">
                        {formatCurrency(t.totalCol2Card)}
                      </td>
                      <td className="p-2.5 text-right font-bold border-r border-zinc-300 bg-amber-50 text-black">
                        {formatCurrency(t.totalCol3Expected)}
                      </td>
                      <td className="p-2.5 text-right font-bold border-r border-zinc-300 text-emerald-800">
                        {formatCurrency(t.totalCol4Banking)}
                      </td>
                      <td className="p-2.5 text-right border-r border-zinc-300 text-zinc-600">
                        {formatCurrency(t.totalCol5Float)}
                      </td>
                      <td className="p-2.5 text-right border-r border-zinc-300 text-blue-800">
                        {formatCurrency(t.totalCol6Card)}
                      </td>
                      <td className="p-2.5 text-right font-bold border-r border-zinc-300 bg-zinc-100 text-black">
                        {formatCurrency(t.totalCol7Actual)}
                      </td>
                      <td
                        className={`p-2.5 text-right font-black border-r border-zinc-300 ${
                          isShort
                            ? 'text-rose-700 bg-rose-50'
                            : isOver
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-zinc-800'
                        }`}
                      >
                        {formatCurrency(t.totalVariance, true)}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectRecord(rec.id)}
                          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-black hover:bg-zinc-800 text-amber-400 border border-black active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1"
                          title="Open this day sheet for full inspection / editing"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-black text-white font-mono font-black border-t-2 border-black">
                  <td className="p-2.5 text-left border-r border-zinc-700">PERIOD TOTALS</td>
                  <td className="p-2.5 border-r border-zinc-700 font-sans text-zinc-300">{filteredRecords.length} days</td>
                  <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.expCash)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.expCard)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 text-amber-300">{formatCurrency(rangeTotals.expTotal)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 text-emerald-300">{formatCurrency(rangeTotals.bankingCash)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.floatCash)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 text-blue-300">{formatCurrency(rangeTotals.actualCard)}</td>
                  <td className="p-2.5 text-right border-r border-zinc-700">{formatCurrency(rangeTotals.actualTotal)}</td>
                  <td
                    className={`p-2.5 text-right border-r border-zinc-700 ${
                      rangeTotals.varianceTotal < -0.009 ? 'text-rose-400' : rangeTotals.varianceTotal > 0.009 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {formatCurrency(rangeTotals.varianceTotal, true)}
                  </td>
                  <td className="p-2 text-center text-zinc-400 text-[10px]">ALL LOGS</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Preview Modal */}
      {isPrintModalOpen && printBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs">
          <div className="bg-white border-2 border-black w-full max-w-5xl h-[92vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="bg-black text-white px-4 py-3 border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif italic font-bold text-base sm:text-lg text-white">
                  Monthly Report Print & Export
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close Print Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Bar */}
            <div className="bg-amber-50 border-b-2 border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Date Range: <strong>{formatToUKDate(startDate)}</strong> to <strong>{formatToUKDate(endDate)}</strong> ({filteredRecords.length} trading days)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleTriggerPrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  title="Trigger browser print dialog"
                >
                  <Printer className="w-4 h-4 text-black" />
                  <span>Print Document</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-100 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Download crisp landscape PDF document directly"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  ) : (
                    <Download className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{isExportingPDF ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>

                <button
                  onClick={() => openPrintableTab(generatePrintHtml())}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  title="Open in regular browser tab where printing is 100% unrestricted"
                >
                  <ExternalLink className="w-4 h-4 text-zinc-700" />
                  <span>Open in New Tab</span>
                </button>

                <a
                  href={printBlobUrl}
                  download={`Monthly_Till_Report_${startDate}_to_${endDate}.html`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-400 hover:border-black transition-colors"
                  title="Save standalone HTML file"
                >
                  <span>.HTML</span>
                </a>
              </div>
            </div>

            {/* Iframe Preview */}
            <div className="flex-1 bg-zinc-200 p-2 sm:p-4 overflow-hidden">
              <iframe
                id="monthly-print-frame"
                src={printBlobUrl}
                className="w-full h-full bg-white border border-zinc-400 shadow-md"
                title="Monthly Report Print Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
