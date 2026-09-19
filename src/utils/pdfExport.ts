import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SheetRecord } from '../types';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
} from './calculations';
import { generateRecordQrDataUrl } from './qrCode';

/**
 * Generates an HTML element styled specifically to match print media query styles,
 * captures it with html2canvas, and exports a high-definition PDF using jsPDF.
 */
export async function exportDaySheetToPDF(
  record: SheetRecord,
  allRecords: SheetRecord[] = []
): Promise<void> {
  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const formattedDate = formatToUKDate(record.date);
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  // Generate QR Code data URL for digital audit verification
  const qrDataUrl = await generateRecordQrDataUrl(record, totals, 160);

  // Create an off-screen print container with exact print CSS
  const container = document.createElement('div');
  container.id = 'jspdf-day-sheet-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px'; // A4 Landscape optimal width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '32px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.zIndex = '-1000';
  container.style.boxSizing = 'border-box';

  const rowsHtml = record.rows
    .map((row, idx) => {
      const expTotal = getRowExpectedTotal(row);
      const actTotal = getRowActualTotal(row);
      const variance = getRowVariance(row, record, allRecords);

      const varColor =
        variance < 0 ? '#b91c1c' : variance > 0 ? '#15803d' : '#000000';
      const varBg =
        variance < 0 ? '#fef2f2' : variance > 0 ? '#f0fdf4' : 'transparent';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1.5px solid #d4d4d8;">
          <td style="padding: 8px 10px; font-weight: 800; font-size: 13px; color: #000000; border-right: 1.5px solid #e4e4e7;">${row.name}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000000;">${formatCurrency(row.col1ExpectedCash)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000000;">${formatCurrency(row.col2ExpectedCard)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; background-color: #f4f4f5; color: #000000;">${formatCurrency(expTotal)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: #000000;">${formatCurrency(row.col4BankingCash)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000000;">${formatCurrency(row.col5FloatCash)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; color: #000000;">${formatCurrency(row.col6ActualCard)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; background-color: #f4f4f5; color: #000000;">${formatCurrency(actTotal)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: ${varColor}; background-color: ${varBg};">
            ${formatCurrency(variance, true)}
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box; background: #ffffff; color: #000000;">
      <!-- Header Banner -->
      <div style="border-bottom: 3px solid #000000; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #52525b;">
            Daily Till Cashing & Reconciliation
          </div>
          <div style="font-family: Georgia, serif; font-style: italic; font-size: 26px; font-weight: bold; color: #000000; margin: 4px 0 2px 0;">
            Day Cashing Sheet: ${formattedDate}
          </div>
          <div style="font-size: 12px; font-family: monospace; margin-top: 3px; color: #18181b;">
            Operator: <strong style="color: #000000;">${record.operator || 'Not Specified'}</strong> | 
            Status: <strong style="color: #000000;">${record.isSaved ? 'Locked / Finalised' : 'Draft'}</strong>
          </div>
        </div>
        <div style="text-align: right; font-size: 11px; font-family: monospace; color: #52525b;">
          <div><strong>Printed:</strong> ${printTimestamp}</div>
          <div><strong>Audit Date:</strong> ${formattedDate}</div>
          <div><strong>Registers:</strong> ${record.rows.length} Active Tills</div>
        </div>
      </div>

      <!-- Key KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">(D) System Expected</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 3px; color: #000000;">${formatCurrency(totals.totalCol3Expected)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">(E) Cash Banked</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 3px; color: #000000;">${formatCurrency(totals.totalCol4Banking)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">(G) Card PDQ</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 3px; color: #000000;">${formatCurrency(totals.totalCol6Card)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">(H) Actual Count</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 3px; color: #000000;">${formatCurrency(totals.totalCol7Actual)}</div>
        </div>
        <div style="border: 2px solid #000000; padding: 10px; background-color: ${totals.totalVariance === 0 ? '#fef08a' : totals.totalVariance > 0 ? '#dcfce7' : '#fee2e2'};">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">(I) Day Variance</div>
          <div style="font-size: 20px; font-family: monospace; font-weight: 900; margin-top: 3px; color: ${totals.totalVariance < 0 ? '#b91c1c' : totals.totalVariance > 0 ? '#15803d' : '#000000'};">
            ${formatCurrency(totals.totalVariance, true)}
          </div>
        </div>
      </div>

      <!-- Main Ledger Table -->
      <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000000; font-size: 12.5px; margin-bottom: 16px;">
        <thead>
          <tr style="background-color: #000000; color: #ffffff;">
            <th style="padding: 9px 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">Register</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(B) Sys Cash</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(C) Sys Card</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; background-color: #27272a; color: #ffffff;">(D) Sys Total</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(E) Banking</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(F) Float Cash</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(G) Card PDQ</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; background-color: #27272a; color: #ffffff;">(H) Count Total</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; color: #ffffff;">(I) Variance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #000000; color: #ffffff; border-top: 3px solid #000000;">
            <td style="padding: 11px 10px; font-weight: 900; font-size: 14px; color: #ffffff; background-color: #000000; font-family: Georgia, serif; font-style: italic;">DAY TOTALS</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol1Cash)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol2Card)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #18181b;">${formatCurrency(totals.totalCol3Expected)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol4Banking)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol5Float)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalCol6Card)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #18181b;">${formatCurrency(totals.totalCol7Actual)}</td>
            <td style="padding: 11px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 900; color: #ffffff; background-color: #000000;">${formatCurrency(totals.totalVariance, true)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Audit Notes Section -->
      ${
        record.notes
          ? `<div style="margin-bottom: 16px; padding: 10px 14px; border: 2px solid #000000; font-family: monospace; font-size: 11.5px; background-color: #f8fafc;">
              <strong style="color: #000000; text-transform: uppercase; font-size: 10.5px; display: block; margin-bottom: 2px;">Shift / Audit Notes:</strong>
              ${record.notes}
            </div>`
          : ''
      }

      <!-- Signatures & QR Verification Footer -->
      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; font-family: monospace;">
        <div style="border-top: 1.5px solid #000000; width: 220px; padding-top: 6px; text-align: center;">
          <strong>Operator Signature</strong>
          <div style="font-size: 9.5px; color: #52525b; margin-top: 2px;">(${record.operator || 'Staff Member'})</div>
        </div>

        <!-- Center Audit & QR Code Block -->
        <div style="display: flex; align-items: center; gap: 12px; border: 2px solid #000000; padding: 6px 12px; background-color: #f8fafc;">
          ${
            qrDataUrl
              ? `<img src="${qrDataUrl}" alt="Audit QR Code" style="width: 64px; height: 64px; display: block; border: 1px solid #000000; background: #ffffff;" />`
              : ''
          }
          <div style="font-size: 9.5px; line-height: 1.35; text-align: left;">
            <div style="font-weight: 900; text-transform: uppercase; font-size: 10px; color: #000000;">
              Digital Audit Verification
            </div>
            <div style="color: #3f3f46;">ID: <strong style="color: #000000;">${record.id}</strong></div>
            <div style="color: #3f3f46;">
              Total Variance: <strong style="color: ${totals.totalVariance < 0 ? '#b91c1c' : totals.totalVariance > 0 ? '#15803d' : '#000000'}; font-size: 11px;">${formatCurrency(totals.totalVariance, true)}</strong>
            </div>
            <div style="font-size: 8.5px; color: #71717a; text-transform: uppercase;">
              Scan QR to verify record integrity
            </div>
          </div>
        </div>

        <div style="border-top: 1.5px solid #000000; width: 220px; padding-top: 6px; text-align: center;">
          <strong>Manager / Auditor Approval</strong>
          <div style="font-size: 9.5px; color: #52525b; margin-top: 2px;">Date: ____ / ____ / ________</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution
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

    // Center vertically if it fits nicely
    const yPos = imgHeight < availableHeight ? margin + (availableHeight - imgHeight) / 2 : margin;

    pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, availableHeight), undefined, 'FAST');

    const cleanDate = record.date.replace(/[^a-zA-Z0-9-]/g, '_');
    pdf.save(`Till_Cashing_Sheet_${cleanDate}.pdf`);
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
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px;">
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
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
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
