import { SheetRecord } from '../types';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
  getDayOfWeekName,
} from './calculations';

/**
 * Generate a complete, single CSV string containing all saved records in state.
 */
export function generateBulkRecordsCSV(records: SheetRecord[]): string {
  if (!records || records.length === 0) {
    return 'Date,Day,Operator,Till/Register,Sys Cash,Sys Card,Sys Takings,Cash Banked,Float Cash,Card PDQ,Actual Counted,Variance,Status,Notes\n';
  }

  // Sort chronologically (oldest to newest) for financial ledger standard
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const earliestDate = formatToUKDate(sortedRecords[0].date);
  const latestDate = formatToUKDate(sortedRecords[sortedRecords.length - 1].date);
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  let grandExpected = 0;
  let grandActual = 0;
  let grandBanking = 0;
  let grandFloat = 0;
  let grandCard = 0;
  let grandVariance = 0;

  sortedRecords.forEach((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, sortedRecords);
    grandExpected += t.totalCol3Expected;
    grandActual += t.totalCol7Actual;
    grandBanking += t.totalCol4Banking;
    grandFloat += t.totalCol5Float;
    grandCard += t.totalCol6Card;
    grandVariance += t.totalVariance;
  });

  const lines: string[] = [];

  // Metadata / Audit Header Block
  lines.push('DAILY TILL RECONCILIATION - MASTER AUDIT EXPORT');
  lines.push(`Generated At,${timestamp}`);
  lines.push(`Date Span,${earliestDate} to ${latestDate}`);
  lines.push(`Total Records Logged,${sortedRecords.length}`);
  lines.push(`Total Expected Takings,${grandExpected.toFixed(2)}`);
  lines.push(`Total Actual Counted,${grandActual.toFixed(2)}`);
  lines.push(`Total Cash Banked,${grandBanking.toFixed(2)}`);
  lines.push(`Total Float Cash,${grandFloat.toFixed(2)}`);
  lines.push(`Total Card PDQ,${grandCard.toFixed(2)}`);
  lines.push(`Net Total Variance,${grandVariance.toFixed(2)}`);
  lines.push('');

  // Detailed Ledger Table
  lines.push('--- DETAILED DAILY REGISTER LEDGER ---');
  lines.push(
    [
      'Date (UK)',
      'ISO Date',
      'Day of Week',
      'Operator',
      'Register Name',
      '(B) Expected Cash',
      '(C) Expected Card',
      '(D) Total Expected Takings',
      '(E) Cash Banked',
      '(F) Float Cash',
      '(G) Card Machine PDQ',
      '(H) Total Counted',
      '(I) Variance / Difference',
      'Record Status',
      'Audit Notes',
    ].join(',')
  );

  sortedRecords.forEach((rec) => {
    const ukDate = formatToUKDate(rec.date);
    const dayName = getDayOfWeekName(rec.date);
    const operatorEscaped = `"${(rec.operator || 'Unassigned').replace(/"/g, '""')}"`;
    const notesEscaped = `"${(rec.notes || '').replace(/"/g, '""')}"`;
    const statusStr = rec.isSaved ? 'Finalised' : 'Draft / Open';

    // Register Rows
    rec.rows.forEach((row) => {
      const expTotal = getRowExpectedTotal(row);
      const actTotal = getRowActualTotal(row);
      const variance = getRowVariance(row, rec, sortedRecords);

      lines.push(
        [
          ukDate,
          rec.date,
          dayName,
          operatorEscaped,
          `"${row.name.replace(/"/g, '""')}"`,
          (row.col1ExpectedCash || 0).toFixed(2),
          (row.col2ExpectedCard || 0).toFixed(2),
          expTotal.toFixed(2),
          (row.col4BankingCash || 0).toFixed(2),
          (row.col5FloatCash || 0).toFixed(2),
          (row.col6ActualCard || 0).toFixed(2),
          actTotal.toFixed(2),
          variance.toFixed(2),
          statusStr,
          notesEscaped,
        ].join(',')
      );
    });

    // Day Subtotal Row for readability
    const dayTotals = calculateGrandTotals(rec.rows, rec, sortedRecords);
    lines.push(
      [
        ukDate,
        rec.date,
        dayName,
        operatorEscaped,
        `"** ${ukDate} DAY TOTAL **"`,
        dayTotals.totalCol1Cash.toFixed(2),
        dayTotals.totalCol2Card.toFixed(2),
        dayTotals.totalCol3Expected.toFixed(2),
        dayTotals.totalCol4Banking.toFixed(2),
        dayTotals.totalCol5Float.toFixed(2),
        dayTotals.totalCol6Card.toFixed(2),
        dayTotals.totalCol7Actual.toFixed(2),
        dayTotals.totalVariance.toFixed(2),
        statusStr,
        notesEscaped,
      ].join(',')
    );
    lines.push(''); // Blank separator between days
  });

  // Master Summary Section
  lines.push('--- DAILY SUMMARY TOTALS SUMMARY ---');
  lines.push(
    [
      'Date (UK)',
      'ISO Date',
      'Day of Week',
      'Operator',
      'Expected Takings',
      'Cash Banked',
      'Float Cash',
      'Card PDQ Total',
      'Actual Counted Total',
      'Daily Variance',
      'Status',
      'Audit Notes',
    ].join(',')
  );

  sortedRecords.forEach((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, sortedRecords);
    lines.push(
      [
        formatToUKDate(rec.date),
        rec.date,
        getDayOfWeekName(rec.date),
        `"${(rec.operator || 'Unassigned').replace(/"/g, '""')}"`,
        t.totalCol3Expected.toFixed(2),
        t.totalCol4Banking.toFixed(2),
        t.totalCol5Float.toFixed(2),
        t.totalCol6Card.toFixed(2),
        t.totalCol7Actual.toFixed(2),
        t.totalVariance.toFixed(2),
        rec.isSaved ? 'Finalised' : 'Draft / Open',
        `"${(rec.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
  });

  lines.push('');
  lines.push(
    [
      'GRAND AUDIT TOTALS',
      '',
      '',
      '',
      grandExpected.toFixed(2),
      grandBanking.toFixed(2),
      grandFloat.toFixed(2),
      grandCard.toFixed(2),
      grandActual.toFixed(2),
      grandVariance.toFixed(2),
      '',
      '',
    ].join(',')
  );

  return lines.join('\n');
}

/**
 * Trigger immediate browser download of the single CSV file.
 */
export function downloadBulkRecordsCSV(records: SheetRecord[]): void {
  const csvContent = generateBulkRecordsCSV(records);
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const dateRangeStr =
    sortedRecords.length > 0
      ? `${sortedRecords[0].date}_to_${sortedRecords[sortedRecords.length - 1].date}`
      : 'empty';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DailyTill_AllRecords_AuditExport_${dateRangeStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate printable PDF-ready HTML for all records in the state.
 */
export function generateBulkRecordsPdfHtml(records: SheetRecord[]): string {
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const earliestDate = sortedRecords.length > 0 ? formatToUKDate(sortedRecords[0].date) : 'N/A';
  const latestDate = sortedRecords.length > 0 ? formatToUKDate(sortedRecords[sortedRecords.length - 1].date) : 'N/A';

  let grandExpected = 0;
  let grandActual = 0;
  let grandBanking = 0;
  let grandFloat = 0;
  let grandCard = 0;
  let grandVariance = 0;

  sortedRecords.forEach((rec) => {
    const t = calculateGrandTotals(rec.rows, rec, sortedRecords);
    grandExpected += t.totalCol3Expected;
    grandActual += t.totalCol7Actual;
    grandBanking += t.totalCol4Banking;
    grandFloat += t.totalCol5Float;
    grandCard += t.totalCol6Card;
    grandVariance += t.totalVariance;
  });

  // Build Summary Rows
  const summaryRowsHtml = sortedRecords
    .map((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, sortedRecords);
      const varColor =
        t.totalVariance < 0 ? 'color: #dc2626; font-weight: 800;' : t.totalVariance > 0 ? 'color: #15803d; font-weight: 800;' : 'color: #000; font-weight: 800;';
      const varLabel = t.totalVariance < 0 ? 'SHORT' : t.totalVariance > 0 ? 'OVER' : 'OK';

      return `
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 6px 8px; font-weight: 700; font-size: 12px; font-family: monospace;">${formatToUKDate(rec.date)}</td>
        <td style="padding: 6px 8px; font-size: 12px;">${getDayOfWeekName(rec.date)}</td>
        <td style="padding: 6px 8px; font-size: 12px; font-weight: 600;">${rec.operator || '—'}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol3Expected)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 700;">${formatCurrency(t.totalCol4Banking)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol5Float)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol6Card)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 800; background: #f4f4f5;">${formatCurrency(t.totalCol7Actual)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; ${varColor}">${formatCurrency(t.totalVariance, true)} <span style="font-size: 10px;">(${varLabel})</span></td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 2px; font-weight: 700; font-size: 10px; ${rec.isSaved ? 'background: #000; color: #fff;' : 'background: #fef08a; color: #854d0e;'}">
            ${rec.isSaved ? 'FINALISED' : 'OPEN'}
          </span>
        </td>
      </tr>
    `;
    })
    .join('');

  // Build Individual Day Breakdown Pages
  const dayPagesHtml = sortedRecords
    .map((rec) => {
      const dayTotals = calculateGrandTotals(rec.rows, rec, sortedRecords);
      const ukDate = formatToUKDate(rec.date);
      const dayName = getDayOfWeekName(rec.date);

      const rowsHtml = rec.rows
        .map((row) => {
          const expTotal = getRowExpectedTotal(row);
          const actTotal = getRowActualTotal(row);
          const variance = getRowVariance(row, rec, sortedRecords);

          const varStyle =
            variance < 0
              ? 'color: #dc2626; font-weight: 800;'
              : variance > 0
              ? 'color: #15803d; font-weight: 800;'
              : 'color: #000; font-weight: 800;';

          const varLabel = variance < 0 ? 'SHORT' : variance > 0 ? 'OVER' : 'BALANCED';

          return `
          <tr style="border-bottom: 1.5px solid #d4d4d8;">
            <td style="padding: 6px 8px; font-weight: 800; font-size: 12px; background: #fafafa; border-right: 1.5px solid #e4e4e7; color: #000;">${row.name}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 600; color: #000;">${formatCurrency(row.col1ExpectedCash)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 600; color: #000;">${formatCurrency(row.col2ExpectedCard)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 800; background: #f4f4f5; color: #000;">${formatCurrency(expTotal)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 700; color: #000;">${formatCurrency(row.col4BankingCash)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 600; color: #000;">${formatCurrency(row.col5FloatCash)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 600; color: #000;">${formatCurrency(row.col6ActualCard)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 800; background: #f4f4f5; color: #000;">${formatCurrency(actTotal)}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 12px; ${varStyle}">${formatCurrency(variance, true)} <span style="font-size: 10px;">(${varLabel})</span></td>
          </tr>
        `;
        })
        .join('');

      return `
      <div class="day-breakdown-card" style="page-break-after: always; break-after: page; margin-bottom: 24px; border: 2px solid #000; padding: 14px; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">DAILY TILL CASHING SHEET</div>
            <h2 style="font-family: Georgia, serif; font-style: italic; font-size: 18px; margin: 2px 0 0 0; color: #000;">
              ${dayName}, ${ukDate}
            </h2>
          </div>
          <div style="text-align: right; font-size: 11px; font-family: monospace;">
            <div><strong>Operator:</strong> ${rec.operator || 'Unassigned'}</div>
            <div><strong>Status:</strong> ${rec.isSaved ? 'FINALISED' : 'OPEN'}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
          <thead>
            <tr style="background: #f4f4f5; border-bottom: 2px solid #000; border-top: 1px solid #000;">
              <th style="text-align: left; padding: 6px 8px; font-weight: 800;">Register</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 700;">(B) Sys Cash</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 700;">(C) Sys Card</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 800; background: #27272a; color: #fff;">(D) Sys Total</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 700;">(E) Banking</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 700;">(F) Float</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 700;">(G) Card PDQ</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 800; background: #27272a; color: #fff;">(H) Count Total</th>
              <th style="text-align: right; padding: 6px 8px; font-weight: 800;">(I) Variance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #000 !important; color: #fff !important; font-weight: 900;">
              <td style="padding: 8px; background: #000; color: #fff;">DAY TOTAL</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol1Cash)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol2Card)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol3Expected)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol4Banking)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol5Float)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol6Card)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalCol7Actual)}</td>
              <td style="padding: 8px; text-align: right; background: #000; color: #fff; font-family: monospace;">${formatCurrency(dayTotals.totalVariance, true)}</td>
            </tr>
          </tfoot>
        </table>

        ${
          rec.notes
            ? `<div style="background: #fafafa; border: 1px solid #000; padding: 6px 10px; margin-bottom: 12px; font-size: 11px;">
                <strong>Audit Notes:</strong> ${rec.notes}
               </div>`
            : ''
        }

        <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; font-family: monospace; font-weight: bold;">
          <div style="border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px;">Operator Signature</div>
          <div style="border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px;">Manager / Auditor Signature</div>
        </div>
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bulk Export - Complete All-Records Audit Report (${earliestDate} - ${latestDate})</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 8mm 10mm;
      }
      @media print {
        body { padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
        .summary-page {
          page-break-after: always !important;
          break-after: page !important;
        }
        .day-breakdown-card {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 16px;
        color: #000;
        background: #fff;
        line-height: 1.35;
      }
      .no-print {
        background: #f4f4f5;
        border: 2px solid #000;
        padding: 12px 16px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .print-btn {
        background: #000000;
        color: #ffffff;
        border: 2px solid #000;
        font-weight: bold;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .header-bar {
        border-bottom: 3px solid #000;
        padding-bottom: 10px;
        margin-bottom: 14px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .title-sub {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #000000;
      }
      h1 {
        font-family: Georgia, serif;
        font-style: italic;
        margin: 2px 0 4px 0;
        font-size: 22px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .kpi-box {
        border: 2px solid #000;
        padding: 10px;
        background: #fafafa;
      }
      .kpi-title {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        color: #52525b;
      }
      .kpi-val {
        font-size: 16px;
        font-weight: 900;
        font-family: monospace;
        color: #000;
        margin-top: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <div>
        <strong style="font-size: 14px; display: block;">📑 Master Audit Ledger Report (All Records)</strong>
        <span style="font-size: 12px; color: #52525b;">Contains all ${sortedRecords.length} daily cashing sheets from ${earliestDate} to ${latestDate}</span>
      </div>
      <div>
        <button onclick="window.print()" class="print-btn">🖨️ Click to Print / Save as PDF</button>
      </div>
    </div>

    <!-- Page 1: Executive Master Summary -->
    <div class="summary-page">
      <div class="header-bar">
        <div>
          <div class="title-sub">FINANCIAL AUDIT & COMPLIANCE LEDGER</div>
          <h1>Complete All-Records Reconciliation Report</h1>
          <div style="font-size: 12px; font-weight: 700; color: #000;">
            Date Span: ${earliestDate} to ${latestDate} | Total Days Logged: ${sortedRecords.length}
          </div>
        </div>
        <div style="text-align: right; font-size: 11px; font-family: monospace;">
          <div><strong>Printed:</strong> ${printTimestamp}</div>
          <div><strong>System:</strong> Delta Daily Till v1.0</div>
        </div>
      </div>

      <!-- KPI Overview Grid -->
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="kpi-title">(D) TOTAL EXPECTED TAKINGS</div>
          <div class="kpi-val">${formatCurrency(grandExpected)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-title">(E) CASH BANKED</div>
          <div class="kpi-val">${formatCurrency(grandBanking)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-title">(G) CARD MACHINE PDQ</div>
          <div class="kpi-val">${formatCurrency(grandCard)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-title">(H) TOTAL COUNTED</div>
          <div class="kpi-val">${formatCurrency(grandActual)}</div>
        </div>
        <div class="kpi-box" style="background: ${grandVariance < 0 ? '#fef2f2' : grandVariance > 0 ? '#f0fdf4' : '#fafafa'}; border: 2px solid #000;">
          <div class="kpi-title">(I) NET OVER / SHORT</div>
          <div class="kpi-val" style="color: ${grandVariance < 0 ? '#dc2626' : grandVariance > 0 ? '#15803d' : '#000'};">
            ${formatCurrency(grandVariance, true)}
          </div>
        </div>
      </div>

      <!-- High-Level Master Table -->
      <h2 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 16px 0 8px 0;">
        Chronological Master Day-by-Day Summary
      </h2>
      <table style="margin-bottom: 16px;">
        <thead>
          <tr style="background: #000; color: #fff;">
            <th style="padding: 6px 8px; text-align: left;">Date</th>
            <th style="padding: 6px 8px; text-align: left;">Day</th>
            <th style="padding: 6px 8px; text-align: left;">Operator</th>
            <th style="padding: 6px 8px; text-align: right;">(D) Sys Takings</th>
            <th style="padding: 6px 8px; text-align: right;">(E) Banked</th>
            <th style="padding: 6px 8px; text-align: right;">(F) Float</th>
            <th style="padding: 6px 8px; text-align: right;">(G) Card PDQ</th>
            <th style="padding: 6px 8px; text-align: right; background: #27272a; color: #fff;">(H) Counted</th>
            <th style="padding: 6px 8px; text-align: right;">(I) Variance</th>
            <th style="padding: 6px 8px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #000; color: #fff; font-weight: 900; font-size: 12px;">
            <td colspan="3" style="padding: 8px;">GRAND AUDIT TOTALS (${sortedRecords.length} DAYS)</td>
            <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(grandExpected)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(grandBanking)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(grandFloat)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(grandCard)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; background: #27272a; color: #fff;">${formatCurrency(grandActual)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace;">${formatCurrency(grandVariance, true)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 11px; font-family: monospace; font-weight: bold;">
        <div style="border-top: 1.5px solid #000; width: 220px; text-align: center; padding-top: 4px;">Head Auditor Signature</div>
        <div style="border-top: 1.5px solid #000; width: 220px; text-align: center; padding-top: 4px;">Financial Controller Approval</div>
      </div>
    </div>

    <!-- Section 2: Individual Day Detail Sheets -->
    <div style="margin-top: 20px;">
      <h2 style="font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 16px;">
        Detailed Daily Till Breakdowns (${sortedRecords.length} Sheets)
      </h2>
      ${dayPagesHtml}
    </div>
  </body>
</html>`;
}
