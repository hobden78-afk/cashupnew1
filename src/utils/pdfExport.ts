import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SheetRecord, TillRowData } from '../types';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
  getDayOfWeekName,
  getFinancialYear,
} from './calculations';
import { generateRecordQrDataUrl } from './qrCode';

export interface DaySheetPDFOptions {
  financialYearFormat?: 'calendar' | 'uk_tax';
}

/**
 * Generates an HTML element styled specifically to match the official print media query styles,
 * captures it with html2canvas at high DPI, and exports a clean, document-ready A4 PDF using jsPDF.
 */
export async function exportDaySheetToPDF(
  record: SheetRecord,
  allRecords: SheetRecord[] = [],
  options?: DaySheetPDFOptions
): Promise<void> {
  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const formattedDate = formatToUKDate(record.date);
  const dayName = getDayOfWeekName(record.date);
  const fy = getFinancialYear(record.date, options?.financialYearFormat || 'calendar');
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  // Generate QR Code data URL for digital audit verification (safely caught)
  let qrDataUrl = '';
  try {
    qrDataUrl = await generateRecordQrDataUrl(record, totals, 160);
  } catch (e) {
    console.warn('QR code generation notice for PDF:', e);
  }

  // Create an off-screen print container with exact print CSS and typography
  const container = document.createElement('div');
  container.id = 'jspdf-day-sheet-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px'; // A4 Landscape optimal width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '26px 32px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.zIndex = '-1000';
  container.style.boxSizing = 'border-box';

  const isOnlineOrdersRow = (r: TillRowData) =>
    !!r.isOnlineOrders ||
    r.id === 'online-orders' ||
    (!!r.name && (r.name.toLowerCase() === 'online orders' || r.name.toLowerCase() === 'online sales'));

  const onlineRow = record.rows.find(isOnlineOrdersRow);
  const normalRows = record.rows.filter((r) => !isOnlineOrdersRow(r));

  const onlineCardExp = onlineRow ? onlineRow.col2ExpectedCard || 0 : 0;
  const onlineCardAct = onlineRow ? onlineRow.col6ActualCard || 0 : 0;
  const onlineTakings = onlineCardExp || onlineCardAct;
  const onlineVat = onlineRow ? onlineRow.vat || 0 : 0;
  const onlineNet = Math.max(0, onlineTakings - onlineVat);
  const onlineDiff = onlineCardAct - onlineCardExp;
  const onlineMatched = Math.abs(onlineDiff) < 0.005;

  const onlineSalesHtml = onlineRow
    ? `
    <!-- ONLINE SALES AUDIT SECTION (Utilizing Print Styles) -->
    <div style="border: 2px solid #0284c7; padding: 10px 14px; margin-bottom: 14px; background-color: #f0f9ff; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0284c7; padding-bottom: 6px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900; font-size: 11.5pt; text-transform: uppercase; color: #0c4a6e; letter-spacing: 0.04em;">Online Sales Audit</span>
          <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; padding: 2px 7px; border-radius: 2px;">Card Settlement &amp; HM Revenue VAT</span>
        </div>
        <div style="font-size: 8pt; font-weight: 600; color: #475569;">
          Non-physical sales revenue (credit card takings only • deposited directly to bank • no float or cash drawer)
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
        <div style="background: #ffffff; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">(C) Sys Card</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #000000; text-align: right; margin-top: 2px;">${formatCurrency(onlineCardExp)}</div>
        </div>
        <div style="background: #e0f2fe; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">(D) Sys Total</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #0c4a6e; text-align: right; margin-top: 2px;">${formatCurrency(onlineCardExp)}</div>
        </div>
        <div style="background: #ffffff; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">(G) Card PDQ</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #000000; text-align: right; margin-top: 2px;">${formatCurrency(onlineCardAct)}</div>
        </div>
        <div style="background: #e0f2fe; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">(H) Count Total</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #0c4a6e; text-align: right; margin-top: 2px;">${formatCurrency(onlineCardAct)}</div>
        </div>
        <div style="background: #ffffff; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">Output VAT Value</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #0284c7; text-align: right; margin-top: 2px;">${formatCurrency(onlineVat)}</div>
        </div>
        <div style="background: #ffffff; border: 1.5px solid #0284c7; padding: 6px 8px;">
          <div style="font-size: 7pt; font-weight: 800; color: #0369a1; text-transform: uppercase;">Net Sales (Ex-VAT)</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5pt; font-weight: 800; color: #000000; text-align: right; margin-top: 2px;">${formatCurrency(onlineNet)}</div>
        </div>
      </div>
    </div>
  `
    : '';

  const rowsHtml = normalRows
    .map((row, idx) => {
      const expTotal = getRowExpectedTotal(row);
      const actTotal = getRowActualTotal(row);
      const variance = getRowVariance(row, record, allRecords);

      const varColor =
        variance < -0.009 ? '#b91c1c' : variance > 0.009 ? '#15803d' : '#000000';
      const varBg =
        variance < -0.009 ? '#fef2f2' : variance > 0.009 ? '#f0fdf4' : 'transparent';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1.5px solid #d4d4d8;">
          <td style="padding: 7px 9px; font-weight: 800; font-size: 12pt; color: #000000; border-right: 1.5px solid #e4e4e7;">${row.name}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 700; color: #000000;">${formatCurrency(row.col1ExpectedCash)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 700; color: #000000;">${formatCurrency(row.col2ExpectedCard)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 800; background-color: #f1f5f9; color: #000000;">${formatCurrency(expTotal)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 800; color: #000000;">${formatCurrency(row.col4BankingCash)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 700; color: #000000;">${formatCurrency(row.col5FloatCash)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 700; color: #000000;">${formatCurrency(row.col6ActualCard)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 800; background-color: #f1f5f9; color: #000000;">${formatCurrency(actTotal)}</td>
          <td style="padding: 7px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: ${varColor}; background-color: ${varBg};">
            ${formatCurrency(variance, true)}
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.35;">
      <!-- Automatic Print Summary Header (Exact Print Styles) -->
      <div style="border-bottom: 2.5px solid #000000; padding-bottom: 8px; margin-bottom: 12px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #4b5563; margin-bottom: 2px;">
              Retail Operations • Till Cashing &amp; Reconciliation
            </div>
            <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 21pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #000000; line-height: 1.1; margin: 0;">
              Daily Till Reconciliation Report
            </h1>
            <div style="font-size: 8pt; font-weight: 600; color: #374151; margin-top: 3px;">
              Official Daily Cash Register Audit, Float Verification &amp; Card Settlement
            </div>
          </div>
          <div style="text-align: right; font-family: 'JetBrains Mono', monospace;">
            <div style="display: inline-block; border: 1.5px solid #000000; padding: 3px 8px; font-size: 8pt; font-weight: 900; text-transform: uppercase; background-color: #f4f4f5; color: #000000; letter-spacing: 0.05em;">
              Financial Year: ${fy}
            </div>
            <div style="font-size: 7.5pt; color: #3f3f46; margin-top: 4px;">
              Record ID: <strong style="color: #000000;">${record.id}</strong> | Status: <strong style="color: #000000;">${record.isSaved ? 'LOCKED AUDIT' : 'ACTIVE DRAFT'}</strong>
            </div>
          </div>
        </div>

        <!-- Details Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 6px 12px; border: 1.5px solid #000000; background-color: #f9fafb; font-size: 8.5pt; margin-top: 6px;">
          <div>
            <span style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; display: block;">Trading Date</span>
            <span style="font-size: 9.5pt; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #000000;">${dayName}, ${formattedDate}</span>
          </div>
          <div>
            <span style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; display: block;">Cashier / Operator</span>
            <span style="font-size: 9.5pt; font-weight: 900; color: #000000;">${record.operator || 'Unassigned Staff'}</span>
          </div>
          <div>
            <span style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; display: block;">Registers / Tills</span>
            <span style="font-size: 9.5pt; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #000000;">${normalRows.length} Physical + ${onlineRow ? '1 Online' : '0 Online'}</span>
          </div>
          <div>
            <span style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; display: block;">Generated / Printed</span>
            <span style="font-size: 9.5pt; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #000000;">${printTimestamp}</span>
          </div>
        </div>
      </div>

      <!-- Key Executive KPI Cards Grid -->
      <div style="display: grid; grid-template-columns: ${onlineRow ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)'}; gap: 8px; margin-bottom: 12px; page-break-inside: avoid;">
        <div style="border: 2px solid #000000; padding: 8px 10px; background-color: #fafafa;">
          <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">(D) System Expected</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: #000000;">${formatCurrency(totals.totalCol3Expected)}</div>
          <div style="font-size: 7pt; color: #64748b; font-weight: 600; margin-top: 1px;">Gross System Takings</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px 10px; background-color: #fafafa;">
          <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">(E) Cash Banked</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: #000000;">${formatCurrency(totals.totalCol4Banking)}</div>
          <div style="font-size: 7pt; color: #64748b; font-weight: 600; margin-top: 1px;">Physical Bank Deposit</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px 10px; background-color: #fafafa;">
          <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">(G) Card PDQ</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: #000000;">${formatCurrency(totals.totalCol6Card)}</div>
          <div style="font-size: 7pt; color: #64748b; font-weight: 600; margin-top: 1px;">Terminal Settlements</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px 10px; background-color: #fafafa;">
          <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">(H) Actual Count</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: #000000;">${formatCurrency(totals.totalCol7Actual)}</div>
          <div style="font-size: 7pt; color: #64748b; font-weight: 600; margin-top: 1px;">Cash + Float + Card</div>
        </div>
        <div style="border: 3px double #000000; outline: 2px solid #000000; outline-offset: 1px; padding: 8px 10px; background-color: ${totals.totalVariance < -0.009 ? '#fef2f2' : totals.totalVariance > 0.009 ? '#f0fdf4' : '#fafafa'};">
          <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">(I) Day Variance</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: ${totals.totalVariance < -0.009 ? '#dc2626' : totals.totalVariance > 0.009 ? '#15803d' : '#000000'};">
            ${formatCurrency(totals.totalVariance, true)}
          </div>
          <div style="font-size: 7pt; font-weight: 800; text-transform: uppercase; margin-top: 1px; color: ${totals.totalVariance < -0.009 ? '#b91c1c' : totals.totalVariance > 0.009 ? '#15803d' : '#334155'};">
            ${totals.totalVariance < -0.009 ? 'SHORT (-)' : totals.totalVariance > 0.009 ? 'OVER (+)' : 'BALANCED (RECONCILED)'}
          </div>
        </div>
        ${
          onlineRow
            ? `
        <div style="border: 2px solid #0284c7; padding: 8px 10px; background-color: #f0f9ff;">
          <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #0369a1;">Online Sales &amp; VAT</div>
          <div style="font-size: 16pt; font-family: 'JetBrains Mono', monospace; font-weight: 900; margin-top: 2px; color: #0c4a6e;">${formatCurrency(onlineTakings)}</div>
          <div style="font-size: 7pt; font-family: 'JetBrains Mono', monospace; color: #0369a1; font-weight: 700; margin-top: 1px;">
            VAT: <strong>${formatCurrency(onlineVat)}</strong> | Net: ${formatCurrency(onlineNet)}
          </div>
        </div>
        `
            : ''
        }
      </div>

      ${onlineSalesHtml}

      <!-- Normal Sales Section Header -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; page-break-inside: avoid;">
        <span style="font-weight: 900; font-size: 11pt; text-transform: uppercase; color: #000000; letter-spacing: 0.04em;">Normal Sales (Physical Till Registers &amp; Cash Floats)</span>
        <span style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase; background: #f4f4f5; color: #18181b; border: 1px solid #a1a1aa; padding: 2px 6px;">In-Store Cash Drawers &amp; PDQs</span>
      </div>

      <!-- Main Ledger Table (Utilizing Print Styles) -->
      <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000000; font-size: 11pt; margin-bottom: 14px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 7px 9px; text-align: left; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">Register</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(B) Sys Cash</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(C) Sys Card</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; background-color: #1e293b; color: #ffffff;">(D) Sys Total</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(E) Banking</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(F) Float Cash</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(G) Card PDQ</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; background-color: #1e293b; color: #ffffff;">(H) Count Total</th>
            <th style="padding: 7px 9px; text-align: right; font-size: 9.5pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.04em; color: #ffffff;">(I) Variance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 3px solid #000000;">
            <td style="padding: 9px 9px; font-weight: 900; font-size: 12pt; color: #ffffff; background-color: #000000; font-family: Georgia, serif; font-style: italic;">DAY TOTALS</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol1Cash)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol2Card)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #1e293b;">${formatCurrency(totals.totalCol3Expected)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol4Banking)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol5Float)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol6Card)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 900; color: #ffffff; background-color: #1e293b;">${formatCurrency(totals.totalCol7Actual)}</td>
            <td style="padding: 9px 9px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13pt; font-weight: 900; color: #ffffff; background-color: #000000; text-decoration: underline;">${formatCurrency(totals.totalVariance, true)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Audit Notes Section (if notes present) -->
      ${
        record.notes
          ? `<div style="margin-bottom: 14px; padding: 8px 12px; border: 1.5px solid #000000; font-family: 'JetBrains Mono', monospace; font-size: 9.5pt; background-color: #f8fafc; page-break-inside: avoid;">
              <strong style="color: #000000; text-transform: uppercase; font-size: 8pt; display: block; margin-bottom: 2px;">Shift / Audit Notes:</strong>
              ${record.notes}
            </div>`
          : ''
      }

      <!-- Physical Filing Verification & Approval Footer (Exact Print Styles) -->
      <div style="margin-top: 14px; border-top: 2px solid #000000; padding-top: 10px; page-break-inside: avoid;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr) auto; gap: 10px; align-items: stretch; margin-bottom: 8px;">
          <!-- 1. Cashier / Operator Signature Box -->
          <div style="border: 1.5px solid #000000; padding: 7px 9px; background-color: #fafafa; display: flex; flex-direction: column; justify-content: space-between; min-height: 80px;">
            <div>
              <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; color: #000000; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>1. Cashier / Operator</span>
                <span style="font-size: 6.5pt; color: #4b5563;">Count Cert</span>
              </div>
              <div style="font-size: 6.5pt; color: #64748b; line-height: 1.25; margin-bottom: 8px;">
                I certify that all cash drawer counts, safe takings, and card terminal batch records are accurate.
              </div>
            </div>
            <div style="border-top: 1.5px solid #000000; width: 100%; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; font-weight: bold; padding-top: 3px; color: #000000;">
              <div>Signature: _______________________</div>
              <div style="font-size: 6.5pt; color: #4b5563; font-weight: normal; margin-top: 1px;">Name: ${record.operator || 'Staff Member'} | Date: ${formattedDate}</div>
            </div>
          </div>

          <!-- 2. Shift Supervisor Box -->
          <div style="border: 1.5px solid #000000; padding: 7px 9px; background-color: #fafafa; display: flex; flex-direction: column; justify-content: space-between; min-height: 80px;">
            <div>
              <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; color: #000000; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>2. Shift Supervisor</span>
                <span style="font-size: 6.5pt; color: #4b5563;">Witness</span>
              </div>
              <div style="font-size: 6.5pt; color: #64748b; line-height: 1.25; margin-bottom: 8px;">
                Physical floats, opening balance consistency, and cash banking envelopes witnessed and verified.
              </div>
            </div>
            <div style="border-top: 1.5px solid #000000; width: 100%; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; font-weight: bold; padding-top: 3px; color: #000000;">
              <div>Signature: _______________________</div>
              <div style="font-size: 6.5pt; color: #4b5563; font-weight: normal; margin-top: 1px;">Witness: _________________ | Date: ___/___/___</div>
            </div>
          </div>

          <!-- 3. Store Manager / Auditor Box -->
          <div style="border: 1.5px solid #000000; padding: 7px 9px; background-color: #fafafa; display: flex; flex-direction: column; justify-content: space-between; min-height: 80px;">
            <div>
              <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; color: #000000; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>3. Manager / Auditor</span>
                <span style="font-size: 6.5pt; color: #4b5563;">Sign-Off</span>
              </div>
              <div style="font-size: 6.5pt; color: #64748b; line-height: 1.25; margin-bottom: 8px;">
                Financial audit complete. Daily register balance variance reviewed and posted.
              </div>
            </div>
            <div style="border-top: 1.5px solid #000000; width: 100%; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; font-weight: bold; padding-top: 3px; color: #000000;">
              <div>Signature: _______________________</div>
              <div style="font-size: 6.5pt; color: #4b5563; font-weight: normal; margin-top: 1px;">Manager: _________________ | Date: ___/___/___</div>
            </div>
          </div>

          <!-- 4. Digital Audit Stamp & QR Code Card -->
          <div style="border: 2px solid #000000; background-color: #f4f4f5; padding: 6px 10px; display: flex; align-items: center; gap: 8px; min-width: 175px;">
            ${
              qrDataUrl
                ? `<img src="${qrDataUrl}" alt="Digital Audit QR Code" style="width: 52px; height: 52px; display: block; border: 1px solid #000000; background: #ffffff;" />`
                : ''
            }
            <div style="font-family: 'JetBrains Mono', monospace; text-align: left;">
              <div style="font-size: 6pt; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Net Day Variance</div>
              <div style="font-size: 11pt; font-weight: 900; color: ${totals.totalVariance < -0.009 ? '#dc2626' : totals.totalVariance > 0.009 ? '#15803d' : '#000000'};">
                ${formatCurrency(totals.totalVariance, true)}
              </div>
              <div style="font-size: 6.5pt; color: #3f3f46; margin-top: 1px;">ID: <strong style="color: #000000;">${record.id}</strong></div>
              <div style="display: inline-block; margin-top: 2px; padding: 1px 4px; background: #000000; color: #ffffff; font-size: 6pt; font-weight: 900; text-transform: uppercase;">
                ${totals.totalVariance < -0.009 ? 'SHORT' : totals.totalVariance > 0.009 ? 'OVER' : 'BALANCED'}
              </div>
            </div>
          </div>
        </div>

        <!-- Compliance Statement -->
        <div style="font-size: 6.5pt; font-weight: 600; color: #4b5563; text-align: center; border-top: 1px dashed #9ca3af; padding-top: 4px; text-transform: uppercase; letter-spacing: 0.06em;">
          Official Till Cashing &amp; Reconciliation Record • Retain for Statutory Audit &amp; Accounting Compliance
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution crisp text
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    // Create jsPDF instance in A4 Landscape (297 x 210 mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;
    const margin = 8; // 8mm margin
    const availableWidth = pdfWidth - margin * 2;
    const availableHeight = pdfHeight - margin * 2;

    const imgWidth = availableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= availableHeight) {
      // Perfectly fits on a single page - center vertically for a document-ready finish
      const yPos = margin + (availableHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Clean multi-page split if content exceeds single page
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= availableHeight;

      while (heightLeft > 0) {
        position -= availableHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= availableHeight;
      }
    }

    const cleanDate = record.date.replace(/[^a-zA-Z0-9-]/g, '_');
    pdf.save(`Daily_Till_Sheet_${cleanDate}.pdf`);
  } catch (error) {
    console.error('jsPDF export error:', error);
    throw error;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export interface MonthlyReportPDFOptions {
  startDate: string;
  endDate: string;
  records: SheetRecord[];
  allRecords?: SheetRecord[];
  rangeTotals: {
    expCash: number;
    expCard: number;
    expTotal: number;
    bankingCash: number;
    floatCash?: number;
    actualCard: number;
    actualTotal: number;
    varianceTotal: number;
  };
  selectedOperator: string;
  registerBreakdown?: Array<{
    name: string;
    col1ExpectedCash: number;
    col2ExpectedCard: number;
    col3ExpectedTotal: number;
    col4BankingCash: number;
    col6ActualCard: number;
    col7ActualTotal: number;
    variance: number;
  }>;
}

/**
 * Generates and downloads a high-definition PDF of the Monthly Till Reconciliation Report.
 */
export async function exportMonthlyReportToPDF(options: MonthlyReportPDFOptions): Promise<void> {
  const { startDate, endDate, records, allRecords = [], rangeTotals, selectedOperator, registerBreakdown = [] } = options;
  const startUK = formatToUKDate(startDate);
  const endUK = formatToUKDate(endDate);
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const container = document.createElement('div');
  container.id = 'jspdf-monthly-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '28px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.zIndex = '-1000';
  container.style.boxSizing = 'border-box';

  // Compute Online Sales & Output VAT data for the date range
  let onlineCardExpected = 0;
  let onlineCardActual = 0;
  let onlineCardTakings = 0;
  let onlineVatSum = 0;
  let onlineNetSum = 0;

  const monthlyOnlineRows = records.map((rec) => {
    const onlineRow = rec.rows.find(
      (r) =>
        r.isOnlineOrders ||
        r.id === 'online-orders' ||
        (r.name && (r.name.toLowerCase() === 'online orders' || r.name.toLowerCase() === 'online sales'))
    );
    const cExp = onlineRow ? onlineRow.col2ExpectedCard || 0 : 0;
    const cAct = onlineRow ? onlineRow.col6ActualCard || 0 : 0;
    const cTakings = cExp || cAct;
    const vat = onlineRow ? onlineRow.vat || 0 : 0;
    const net = Math.max(0, cTakings - vat);
    const diff = cAct - cExp;
    const isMatch = Math.abs(diff) < 0.005;

    onlineCardExpected += cExp;
    onlineCardActual += cAct;
    onlineCardTakings += cTakings;
    onlineVatSum += vat;
    onlineNetSum += net;

    return {
      recordId: rec.id,
      date: rec.date,
      operator: rec.operator || '—',
      cardExpected: cExp,
      cardActual: cAct,
      cardTakings: cTakings,
      vat,
      netTakings: net,
      diff,
      isMatch,
    };
  });

  const onlineRowsHtml = monthlyOnlineRows
    .map((d, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusHtml =
        d.cardTakings === 0 && d.vat === 0
          ? '<span style="color: #94a3b8;">No Orders</span>'
          : d.isMatch
          ? '<span style="color: #15803d; font-weight: bold;">MATCHED</span>'
          : `<span style="color: #b91c1c; font-weight: bold;">DIFF £${d.diff.toFixed(2)}</span>`;

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 800; font-family: monospace; font-size: 11px;">${formatToUKDate(d.date)}</td>
          <td style="padding: 6px 8px; font-size: 11px;">${d.operator}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.cardExpected)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.cardActual)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(d.cardTakings)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #e0f2fe; color: #0369a1;">${formatCurrency(d.vat)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.netTakings)}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px;">${statusHtml}</td>
        </tr>
      `;
    })
    .join('');

  const rowsHtml = records
    .map((rec, idx) => {
      const t = calculateGrandTotals(rec.rows, rec, allRecords.length > 0 ? allRecords : records);
      const varColor =
        t.totalVariance < -0.009 ? '#b91c1c' : t.totalVariance > 0.009 ? '#15803d' : '#000000';
      const varBg =
        t.totalVariance < -0.009 ? '#fef2f2' : t.totalVariance > 0.009 ? '#f0fdf4' : 'transparent';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 800; font-family: monospace; font-size: 11px;">${formatToUKDate(rec.date)}</td>
          <td style="padding: 6px 8px; font-size: 11px;">${rec.operator || '—'}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(t.totalCol1Cash)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(t.totalCol2Card)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(t.totalCol3Expected)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px;">${formatCurrency(t.totalCol4Banking)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(t.totalCol6Card)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(t.totalCol7Actual)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; font-size: 11px; color: ${varColor}; background-color: ${varBg};">
            ${formatCurrency(t.totalVariance, true)}
          </td>
          <td style="padding: 6px 8px; text-align: center; font-size: 9px; font-weight: bold;">
            ${rec.isSaved ? 'LOCKED' : 'OPEN'}
          </td>
        </tr>
      `;
    })
    .join('');

  const registersHtml = registerBreakdown
    .map((reg) => {
      const varColor =
        reg.variance < -0.009 ? '#b91c1c' : reg.variance > 0.009 ? '#15803d' : '#000000';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 800; font-size: 11px;">${reg.name}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(reg.col1ExpectedCash)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(reg.col2ExpectedCard)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(reg.col3ExpectedTotal)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px;">${formatCurrency(reg.col4BankingCash)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(reg.col6ActualCard)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(reg.col7ActualTotal)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; font-size: 11px; color: ${varColor};">
            ${formatCurrency(reg.variance, true)}
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box; background: #ffffff; color: #000000;">
      <!-- Header -->
      <div style="border-bottom: 3px solid #000000; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #475569;">
            Executive Financial & Till Audit
          </div>
          <div style="font-family: Georgia, serif; font-style: italic; font-size: 24px; font-weight: bold; color: #000000; margin: 3px 0;">
            Monthly Till Reconciliation Summary Report
          </div>
          <div style="font-size: 12px; font-family: monospace; color: #0f172a;">
            Period: <strong>${startUK}</strong> to <strong>${endUK}</strong> (${records.length} trading days) | Operator: <strong>${selectedOperator === 'all' ? 'All Staff' : selectedOperator}</strong>
          </div>
        </div>
        <div style="text-align: right; font-size: 10px; font-family: monospace; color: #475569;">
          <div><strong>Generated:</strong> ${printTimestamp}</div>
          <div><strong>System:</strong> Delta Till Audit v1.0</div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 14px;">
        <div style="border: 2px solid #000000; padding: 8px; background-color: #f8fafc;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569;">Total Expected</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(rangeTotals.expTotal)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px; background-color: #f8fafc;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569;">Total Cash Banked</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(rangeTotals.bankingCash)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px; background-color: #f8fafc;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569;">Card PDQ Takings</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(rangeTotals.actualCard)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px; background-color: #f8fafc;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569;">Actual Counted</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(rangeTotals.actualTotal)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 8px; background-color: ${rangeTotals.varianceTotal === 0 ? '#fef08a' : rangeTotals.varianceTotal > 0 ? '#dcfce7' : '#fee2e2'};">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #000000;">Net Over / Short</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px; color: ${rangeTotals.varianceTotal < 0 ? '#b91c1c' : rangeTotals.varianceTotal > 0 ? '#15803d' : '#000000'};">
            ${formatCurrency(rangeTotals.varianceTotal, true)}
          </div>
        </div>
        <div style="border: 2px solid #0284c7; padding: 8px; background-color: #f0f9ff;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0369a1;">Online Sales &amp; VAT</div>
          <div style="font-size: 18px; font-family: monospace; font-weight: 900; margin-top: 2px; color: #0c4a6e;">${formatCurrency(onlineCardTakings)}</div>
          <div style="font-size: 8.5px; font-family: monospace; color: #0369a1; margin-top: 2px;">
            VAT: <strong>${formatCurrency(onlineVatSum)}</strong> | Net: ${formatCurrency(onlineNetSum)}
          </div>
        </div>
      </div>

      ${
        registerBreakdown.length > 0
          ? `
        <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
          1. Aggregated Register Breakdown
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000000; margin-bottom: 14px; font-size: 11px;">
          <thead>
            <tr style="background-color: #000000; color: #ffffff;">
              <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900;">Register</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">(B) Sys Cash</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">(C) Sys Card</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">(D) Sys Total</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">(E) Banked</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">(G) Card PDQ</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">(H) Count Total</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">(I) Variance</th>
            </tr>
          </thead>
          <tbody>
            ${registersHtml}
          </tbody>
        </table>
      `
          : ''
      }

      <!-- Day by Day Ledger -->
      <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
        2. Daily Reconciliation Audit Ledger (${records.length} Days)
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #000000; margin-bottom: 14px; font-size: 11px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900;">Date</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900;">Operator</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Sys Cash</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Sys Card</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">Expected</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Banked</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Card PDQ</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">Actual Total</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Variance</th>
            <th style="padding: 6px 8px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 900;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 2.5px solid #000000;">
            <td style="padding: 8px; font-weight: 900; font-family: Georgia, serif; font-style: italic; font-size: 12px; color: #ffffff; background-color: #000000;">PERIOD TOTALS</td>
            <td style="padding: 8px; font-size: 10px; color: #ffffff; background-color: #000000;">${records.length} days</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(rangeTotals.expCash)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(rangeTotals.expCard)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #0f172a;">${formatCurrency(rangeTotals.expTotal)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(rangeTotals.bankingCash)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(rangeTotals.actualCard)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #0f172a;">${formatCurrency(rangeTotals.actualTotal)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(rangeTotals.varianceTotal, true)}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 900; color: #ffffff; background-color: #000000;">${rangeTotals.varianceTotal > 0.009 ? 'OVER' : rangeTotals.varianceTotal < -0.009 ? 'SHORT' : 'BALANCED'}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 3. Online Sales & VAT Audit -->
      <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
        3. Online Sales &amp; Output VAT Audit (Card Settlements)
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #000000; margin-bottom: 14px; font-size: 11px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900;">Date</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900;">Operator</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Sys Card (2)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Card PDQ (6)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">Online Takings</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900; background-color: #0369a1; color: #ffffff;">Online Output VAT</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; font-weight: 900;">Net Sales (Ex-VAT)</th>
            <th style="padding: 6px 8px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 900;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${onlineRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 2.5px solid #000000;">
            <td style="padding: 8px; font-weight: 900; font-family: Georgia, serif; font-style: italic; font-size: 12px; color: #ffffff; background-color: #000000;" colspan="2">ONLINE RANGE TOTALS</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(onlineCardExpected)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(onlineCardActual)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #fde047; background-color: #0f172a;">${formatCurrency(onlineCardTakings)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #fde047; background-color: #0369a1;">${formatCurrency(onlineVatSum)}</td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(onlineNetSum)}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 900; color: #4ade80; background-color: #000000;">${monthlyOnlineRows.every((r) => r.isMatch) ? 'RECONCILED' : 'MONITORED'}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Signatures -->
      <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; font-family: monospace;">
        <div style="border-top: 1.5px solid #000000; width: 200px; padding-top: 4px; text-align: center;">
          <strong>Prepared By (Store Staff)</strong>
        </div>
        <div style="border-top: 1.5px solid #000000; width: 200px; padding-top: 4px; text-align: center;">
          <strong>Manager Review & Approval</strong>
        </div>
        <div style="border-top: 1.5px solid #000000; width: 200px; padding-top: 4px; text-align: center;">
          <strong>Internal Audit Sign-off</strong>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;
    const margin = 8;
    const availableWidth = pdfWidth - margin * 2;
    const availableHeight = pdfHeight - margin * 2;

    const imgWidth = availableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= availableHeight) {
      const yPos = margin + (availableHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Split cleanly across pages
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= availableHeight;

      while (heightLeft > 0) {
        position -= availableHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= availableHeight;
      }
    }

    pdf.save(`Monthly_Till_Reconciliation_${startDate}_to_${endDate}.pdf`);
  } catch (error) {
    console.error('Monthly PDF export error:', error);
    throw error;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Generates and downloads a high-definition PDF of the Weekly Till Reconciliation Report.
 */
export async function exportWeeklyReportToPDF(options: {
  mondayStr: string;
  sundayStr: string;
  records: SheetRecord[];
  allRecords?: SheetRecord[];
  totals: {
    totalCol1Cash: number;
    totalCol2Card: number;
    totalCol3Expected: number;
    totalCol4Banking: number;
    totalCol6Card: number;
    totalCol7Actual: number;
    totalVariance: number;
  };
}): Promise<void> {
  const { mondayStr, sundayStr, records, allRecords = [], totals } = options;
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const container = document.createElement('div');
  container.id = 'jspdf-weekly-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '28px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.zIndex = '-1000';
  container.style.boxSizing = 'border-box';

  // Compute Weekly Online Sales & Output VAT
  let weeklyOnlineCardExpected = 0;
  let weeklyOnlineCardActual = 0;
  let weeklyOnlineTakings = 0;
  let weeklyOnlineVatSum = 0;
  let weeklyOnlineNetSum = 0;

  const weeklyOnlineRows = records.map((rec) => {
    const onlineRow = rec.rows.find(
      (r) =>
        r.isOnlineOrders ||
        r.id === 'online-orders' ||
        (r.name && (r.name.toLowerCase() === 'online orders' || r.name.toLowerCase() === 'online sales'))
    );
    const cExp = onlineRow ? onlineRow.col2ExpectedCard || 0 : 0;
    const cAct = onlineRow ? onlineRow.col6ActualCard || 0 : 0;
    const cTakings = cExp || cAct;
    const vat = onlineRow ? onlineRow.vat || 0 : 0;
    const net = Math.max(0, cTakings - vat);
    const diff = cAct - cExp;
    const isMatch = Math.abs(diff) < 0.005;

    weeklyOnlineCardExpected += cExp;
    weeklyOnlineCardActual += cAct;
    weeklyOnlineTakings += cTakings;
    weeklyOnlineVatSum += vat;
    weeklyOnlineNetSum += net;

    return {
      recordId: rec.id,
      date: rec.date,
      operator: rec.operator || '—',
      cardExpected: cExp,
      cardActual: cAct,
      cardTakings: cTakings,
      vat,
      netTakings: net,
      diff,
      isMatch,
    };
  });

  const weeklyOnlineRowsHtml = weeklyOnlineRows
    .map((d, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusHtml =
        d.cardTakings === 0 && d.vat === 0
          ? '<span style="color: #94a3b8;">No Orders</span>'
          : d.isMatch
          ? '<span style="color: #15803d; font-weight: bold;">MATCHED</span>'
          : `<span style="color: #b91c1c; font-weight: bold;">DIFF £${d.diff.toFixed(2)}</span>`;

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 800; font-family: monospace; font-size: 11px;">${formatToUKDate(d.date)}</td>
          <td style="padding: 6px 8px; font-size: 11px;">${d.operator}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.cardExpected)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.cardActual)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #f1f5f9;">${formatCurrency(d.cardTakings)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 11px; background-color: #e0f2fe; color: #0369a1;">${formatCurrency(d.vat)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px;">${formatCurrency(d.netTakings)}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px;">${statusHtml}</td>
        </tr>
      `;
    })
    .join('');

  const rowsHtml = records
    .map((rec, idx) => {
      const t = calculateGrandTotals(rec.rows, rec, allRecords.length > 0 ? allRecords : records);
      const varColor =
        t.totalVariance < -0.009 ? '#b91c1c' : t.totalVariance > 0.009 ? '#15803d' : '#000000';
      const varBg =
        t.totalVariance < -0.009 ? '#fef2f2' : t.totalVariance > 0.009 ? '#f0fdf4' : 'transparent';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1.5px solid #e2e8f0;">
          <td style="padding: 8px 10px; font-weight: 800; font-family: monospace; font-size: 12px;">${formatToUKDate(rec.date)}</td>
          <td style="padding: 8px 10px; font-size: 12px;">${rec.operator || '—'}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol1Cash)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol2Card)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 800; font-size: 12px; background-color: #f1f5f9;">${formatCurrency(t.totalCol3Expected)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 800; font-size: 12px;">${formatCurrency(t.totalCol4Banking)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12px;">${formatCurrency(t.totalCol6Card)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 800; font-size: 12px; background-color: #f1f5f9;">${formatCurrency(t.totalCol7Actual)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 900; font-size: 12px; color: ${varColor}; background-color: ${varBg};">
            ${formatCurrency(t.totalVariance, true)}
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box; background: #ffffff; color: #000000;">
      <!-- Header -->
      <div style="border-bottom: 3px solid #000000; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #475569;">
            Operational Audit & Reconciliation
          </div>
          <div style="font-family: Georgia, serif; font-style: italic; font-size: 24px; font-weight: bold; color: #000000; margin: 3px 0;">
            Weekly Till Reconciliation Summary Report
          </div>
          <div style="font-size: 12px; font-family: monospace; color: #0f172a;">
            Period: <strong>Mon ${mondayStr}</strong> to <strong>Sun ${sundayStr}</strong> (${records.length} trading days recorded)
          </div>
        </div>
        <div style="text-align: right; font-size: 10px; font-family: monospace; color: #475569;">
          <div><strong>Printed:</strong> ${printTimestamp}</div>
          <div><strong>System:</strong> Delta Till Audit v1.0</div>
        </div>
      </div>

      <!-- Key KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569;">Weekly Expected</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(totals.totalCol3Expected)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569;">Total Cash Banked</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(totals.totalCol4Banking)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569;">Total Card Takings</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 2px;">${formatCurrency(totals.totalCol6Card)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: ${totals.totalVariance === 0 ? '#fef08a' : totals.totalVariance > 0 ? '#dcfce7' : '#fee2e2'};">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #000000;">Net Weekly Variance</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 2px; color: ${totals.totalVariance < 0 ? '#b91c1c' : totals.totalVariance > 0 ? '#15803d' : '#000000'};">
            ${formatCurrency(totals.totalVariance, true)}
          </div>
        </div>
        <div style="border: 2px solid #0284c7; padding: 10px; background-color: #f0f9ff;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0369a1;">Online Sales &amp; VAT</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 2px; color: #0c4a6e;">${formatCurrency(weeklyOnlineTakings)}</div>
          <div style="font-size: 9.5px; font-family: monospace; color: #0369a1; margin-top: 2px;">
            VAT: <strong>${formatCurrency(weeklyOnlineVatSum)}</strong> | Net: ${formatCurrency(weeklyOnlineNetSum)}
          </div>
        </div>
      </div>

      <!-- Weekly Table -->
      <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000000; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900;">Date</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900;">Operator</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">(B) Sys Cash</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">(C) Sys Card</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">(D) Sys Total</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">(E) Banking</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">(G) Card PDQ</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">(H) Count Total</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">(I) Variance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 3px solid #000000;">
            <td style="padding: 10px; font-weight: 900; font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #ffffff; background-color: #000000;">WEEKLY TOTALS</td>
            <td style="padding: 10px; font-size: 11px; color: #ffffff; background-color: #000000;">${records.length} days</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol1Cash)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol2Card)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #0f172a;">${formatCurrency(totals.totalCol3Expected)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol4Banking)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol6Card)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #0f172a;">${formatCurrency(totals.totalCol7Actual)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalVariance, true)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Weekly Online Sales & Output VAT Audit -->
      <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
        Weekly Online Sales &amp; Output VAT Audit (Card Settlements)
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000000; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900;">Date</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900;">Operator</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">Sys Card (2)</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">Card PDQ (6)</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; background-color: #1e293b;">Online Takings</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; background-color: #0369a1; color: #ffffff;">Online Output VAT</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900;">Net Sales (Ex-VAT)</th>
            <th style="padding: 8px 10px; text-align: center; font-size: 11px; text-transform: uppercase; font-weight: 900;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyOnlineRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 3px solid #000000;">
            <td style="padding: 10px; font-weight: 900; font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #ffffff; background-color: #000000;" colspan="2">ONLINE TOTALS</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(weeklyOnlineCardExpected)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(weeklyOnlineCardActual)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #fde047; background-color: #0f172a;">${formatCurrency(weeklyOnlineTakings)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #fde047; background-color: #0369a1;">${formatCurrency(weeklyOnlineVatSum)}</td>
            <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(weeklyOnlineNetSum)}</td>
            <td style="padding: 10px; text-align: center; font-size: 11px; font-weight: 900; color: #4ade80; background-color: #000000;">${weeklyOnlineRows.every((r) => r.isMatch) ? 'RECONCILED' : 'MONITORED'}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Signatures -->
      <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; font-family: monospace;">
        <div style="border-top: 1.5px solid #000000; width: 220px; padding-top: 6px; text-align: center;">
          <strong>Duty Manager Sign-off</strong>
        </div>
        <div style="border-top: 1.5px solid #000000; width: 220px; padding-top: 6px; text-align: center;">
          <strong>Store Manager Review</strong>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;
    const margin = 8;
    const availableWidth = pdfWidth - margin * 2;
    const availableHeight = pdfHeight - margin * 2;

    const imgWidth = availableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const yPos = imgHeight < availableHeight ? margin + (availableHeight - imgHeight) / 2 : margin;

    pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, availableHeight), undefined, 'FAST');
    pdf.save(`Weekly_Till_Report_${mondayStr}_to_${sundayStr}.pdf`);
  } catch (error) {
    console.error('Weekly PDF export error:', error);
    throw error;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
