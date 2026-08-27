import React, { useState, useEffect, useRef } from 'react';
import { SheetRecord } from '../types';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
  getFinancialYear,
} from '../utils/calculations';
import { generateRecordQrDataUrl } from '../utils/qrCode';
import {
  Printer,
  X,
  Copy,
  Check,
  Receipt,
  FileText,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SheetRecord;
  allRecords?: SheetRecord[];
  financialYearFormat?: 'calendar' | 'uk_tax';
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  record,
  allRecords = [],
  financialYearFormat = 'calendar',
}) => {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm' | 'full'>('80mm');
  const [showTillBreakdown, setShowTillBreakdown] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const formattedDate = formatToUKDate(record.date);
  const fyString = getFinancialYear(record.date, financialYearFormat);
  const printTimestamp = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;

  // Get day of week (e.g. Thursday)
  const dayOfWeek = (() => {
    try {
      const parts = record.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { weekday: 'long' });
      }
    } catch {
      // fallback
    }
    return '';
  })();

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      generateRecordQrDataUrl(record, totals, 120).then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, record, totals]);

  if (!isOpen) return null;

  // Generate plain text version for copying or serial printers
  const generatePlainTextSlip = () => {
    const divider = '==========================================';
    const subDivider = '------------------------------------------';

    let text = `DAILY TILL CASHING & RECONCILIATION\n`;
    text += `DELTA CASHING UP SYSTEM\n`;
    text += `${divider}\n`;
    text += `Date:       ${formattedDate} (${dayOfWeek || 'Day Sheet'})\n`;
    text += `Fin Year:   ${fyString}\n`;
    text += `Operator:   ${record.operator || 'Not Specified'}\n`;
    text += `Status:     ${record.isSaved ? 'LOCKED / FINALISED' : 'DRAFT'}\n`;
    text += `Printed:    ${printTimestamp}\n`;
    text += `Record ID:  ${record.id}\n`;
    text += `${divider}\n`;

    if (showTillBreakdown) {
      text += `ESSENTIAL TILL BREAKDOWN:\n`;
      text += `${subDivider}\n`;
      record.rows.forEach((row) => {
        if (row.isYard) {
          const yVar = row.customVariance || 0;
          text += `[ ${row.name.toUpperCase()} ]\n`;
          text += `  Variance: ${formatCurrency(yVar, true)} (${yVar < 0 ? 'SHORT' : yVar > 0 ? 'OVER' : 'OK'})\n`;
        } else {
          const expTotal = getRowExpectedTotal(row);
          const actTotal = getRowActualTotal(row);
          const variance = getRowVariance(row, record, allRecords);
          const varLabel = variance < 0 ? 'SHORT' : variance > 0 ? 'OVER' : 'OK';

          text += `[ ${row.name.toUpperCase()} ]\n`;
          text += `  Sys Takings:  ${formatCurrency(expTotal)} (Cash: ${formatCurrency(row.col1ExpectedCash)}, Card: ${formatCurrency(row.col2ExpectedCard)})\n`;
          text += `  Counted:      ${formatCurrency(actTotal)} (Bank: ${formatCurrency(row.col4BankingCash)}, Flt: ${formatCurrency(row.col5FloatCash)}, PDQ: ${formatCurrency(row.col6ActualCard)})\n`;
          text += `  Variance:     ${formatCurrency(variance, true)} [${varLabel}]\n`;
        }
        text += `\n`;
      });
      text += `${divider}\n`;
    }

    text += `DAY TOTALS & RECONCILIATION SUMMARY:\n`;
    text += `${subDivider}\n`;
    text += `Total System Cash:       ${formatCurrency(totals.totalCol1Cash).padStart(12)}\n`;
    text += `Total System Card:       ${formatCurrency(totals.totalCol2Card).padStart(12)}\n`;
    text += `TOTAL EXPECTED TAKINGS:  ${formatCurrency(totals.totalCol3Expected).padStart(12)}\n`;
    text += `${subDivider}\n`;
    text += `Total Cash Banked:       ${formatCurrency(totals.totalCol4Banking).padStart(12)}\n`;
    text += `Total Float Retained:    ${formatCurrency(totals.totalCol5Float).padStart(12)}\n`;
    text += `Total Card PDQ:          ${formatCurrency(totals.totalCol6Card).padStart(12)}\n`;
    text += `TOTAL ACTUAL COUNTED:    ${formatCurrency(totals.totalCol7Actual).padStart(12)}\n`;
    text += `${divider}\n`;

    const netStatus =
      totals.totalVariance < 0
        ? 'NET SHORT (-)'
        : totals.totalVariance > 0
        ? 'NET OVER (+)'
        : 'BALANCED / RECONCILED';
    text += `*** TOTAL NET VARIANCE ***\n`;
    text += `  ${formatCurrency(totals.totalVariance, true)} [${netStatus}]\n`;
    text += `${divider}\n`;

    if (record.notes) {
      text += `SHIFT NOTES:\n`;
      text += `${record.notes}\n`;
      text += `${divider}\n`;
    }

    if (showSignatures) {
      text += `\n`;
      text += `Cashier Signature: _______________________\n`;
      text += `                   ${record.operator || 'Staff Member'}\n\n`;
      text += `Manager Approval:  _______________________\n`;
      text += `Date & Time:       _______________________\n`;
      text += `${divider}\n`;
    }

    text += `*** END OF THERMAL AUDIT SLIP ***\n`;
    return text;
  };

  const handleCopySlip = async () => {
    try {
      const text = generatePlainTextSlip();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy receipt:', err);
    }
  };

  // Generate self-contained HTML for thermal printing with precise CSS media rules
  const generateThermalPrintHtml = () => {
    const widthCss =
      paperWidth === '58mm' ? '58mm' : paperWidth === '80mm' ? '80mm' : '100%';
    const fontSizeCss = paperWidth === '58mm' ? '10px' : '11.5px';

    const rowsHtml = record.rows
      .map((row) => {
        if (row.isYard) {
          const yVar = row.customVariance || 0;
          return `
            <div class="till-block">
              <div class="till-name">${row.name.toUpperCase()}</div>
              <div class="row-flex">
                <span>Variance:</span>
                <span class="bold ${yVar < 0 ? 'short' : yVar > 0 ? 'over' : ''}">${formatCurrency(yVar, true)} (${yVar < 0 ? 'SHORT' : yVar > 0 ? 'OVER' : 'OK'})</span>
              </div>
            </div>
          `;
        }

        const expTotal = getRowExpectedTotal(row);
        const actTotal = getRowActualTotal(row);
        const variance = getRowVariance(row, record, allRecords);
        const varClass = variance < 0 ? 'short' : variance > 0 ? 'over' : '';
        const varLabel = variance < 0 ? 'SHORT' : variance > 0 ? 'OVER' : 'OK';

        return `
          <div class="till-block">
            <div class="till-name">${row.name.toUpperCase()}</div>
            <div class="row-flex text-muted">
              <span>Sys Takings:</span>
              <span class="bold">${formatCurrency(expTotal)}</span>
            </div>
            <div class="row-sub">
              <span>(Cash: ${formatCurrency(row.col1ExpectedCash)} | Card: ${formatCurrency(row.col2ExpectedCard)})</span>
            </div>
            <div class="row-flex text-muted" style="margin-top:2px;">
              <span>Counted Total:</span>
              <span class="bold">${formatCurrency(actTotal)}</span>
            </div>
            <div class="row-sub">
              <span>(Bank: ${formatCurrency(row.col4BankingCash)} | Flt: ${formatCurrency(row.col5FloatCash)} | PDQ: ${formatCurrency(row.col6ActualCard)})</span>
            </div>
            <div class="row-flex var-line" style="margin-top:3px;">
              <span>Variance:</span>
              <span class="bold ${varClass}">${formatCurrency(variance, true)} [${varLabel}]</span>
            </div>
          </div>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Thermal Slip - ${formattedDate}</title>
    <style>
      @page {
        size: ${widthCss} auto;
        margin: 0mm !important;
      }
      @media print {
        html, body {
          width: ${widthCss} !important;
          margin: 0 !important;
          padding: 3mm 2.5mm !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print { display: none !important; }
      }
      body {
        font-family: 'Courier New', Courier, monospace, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: ${fontSizeCss};
        line-height: 1.25;
        color: #000000;
        background: #ffffff;
        margin: 0;
        padding: 6px;
        width: 100%;
        box-sizing: border-box;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .text-muted { color: #222; }
      .title {
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 2px;
      }
      .subtitle {
        font-size: 9.5px;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .divider {
        border-top: 1px dashed #000;
        margin: 5px 0;
      }
      .double-divider {
        border-top: 2px solid #000;
        margin: 6px 0;
      }
      .row-flex {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-family: monospace;
      }
      .row-sub {
        font-size: 8.5px;
        color: #333;
        font-family: monospace;
        padding-left: 4px;
      }
      .till-block {
        padding: 4px 0;
        border-bottom: 1px dotted #555;
      }
      .till-block:last-child {
        border-bottom: none;
      }
      .till-name {
        font-weight: 900;
        font-size: 11px;
        text-transform: uppercase;
        margin-bottom: 1px;
      }
      .var-line {
        font-size: 10.5px;
      }
      .var-highlight {
        border: 1.5px solid #000;
        padding: 4px;
        margin: 6px 0;
        text-align: center;
        font-weight: 900;
      }
      .var-big {
        font-size: 14px;
        font-weight: 900;
        margin-top: 2px;
      }
      .short { color: #000; font-weight: 900; }
      .over { color: #000; font-weight: 900; }
      .signatures {
        margin-top: 10px;
        font-size: 9px;
      }
      .sign-line {
        margin-top: 14px;
        border-top: 1px solid #000;
        padding-top: 2px;
        text-align: center;
      }
      .qr-block {
        margin: 6px 0;
        text-align: center;
      }
      .qr-img {
        width: 70px;
        height: 70px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="title">DAILY TILL CASHING</div>
      <div class="subtitle">DELTA CASHING UP SYSTEM</div>
    </div>
    
    <div class="divider"></div>

    <div class="row-flex">
      <span>Date:</span>
      <span class="bold">${formattedDate} (${dayOfWeek.slice(0, 3)})</span>
    </div>
    <div class="row-flex">
      <span>Fin Year:</span>
      <span class="bold">${fyString}</span>
    </div>
    <div class="row-flex">
      <span>Operator:</span>
      <span class="bold">${record.operator || 'Not Specified'}</span>
    </div>
    <div class="row-flex">
      <span>Status:</span>
      <span class="bold">${record.isSaved ? 'LOCKED' : 'DRAFT'}</span>
    </div>
    <div class="row-flex">
      <span>Time:</span>
      <span>${printTimestamp.split(' ')[1] || ''}</span>
    </div>

    <div class="double-divider"></div>

    ${
      showTillBreakdown
        ? `
      <div class="center bold" style="font-size: 10px; text-transform: uppercase; margin-bottom: 3px;">
        -- ESSENTIAL TILL BREAKDOWN --
      </div>
      ${rowsHtml}
      <div class="double-divider"></div>
    `
        : ''
    }

    <div class="center bold" style="font-size: 10px; text-transform: uppercase; margin-bottom: 4px;">
      -- RECONCILIATION SUMMARY --
    </div>

    <div class="row-flex">
      <span>System Cash:</span>
      <span class="bold">${formatCurrency(totals.totalCol1Cash)}</span>
    </div>
    <div class="row-flex">
      <span>System Card:</span>
      <span class="bold">${formatCurrency(totals.totalCol2Card)}</span>
    </div>
    <div class="row-flex bold" style="border-top: 1px dotted #666; padding-top: 2px; margin-top: 2px;">
      <span>TOTAL EXPECTED:</span>
      <span>${formatCurrency(totals.totalCol3Expected)}</span>
    </div>

    <div class="divider"></div>

    <div class="row-flex">
      <span>Cash Banked (4):</span>
      <span class="bold">${formatCurrency(totals.totalCol4Banking)}</span>
    </div>
    <div class="row-flex">
      <span>Float Retained (5):</span>
      <span class="bold">${formatCurrency(totals.totalCol5Float)}</span>
    </div>
    <div class="row-flex">
      <span>Card Machine PDQ (6):</span>
      <span class="bold">${formatCurrency(totals.totalCol6Card)}</span>
    </div>
    <div class="row-flex bold" style="border-top: 1px dotted #666; padding-top: 2px; margin-top: 2px;">
      <span>TOTAL COUNTED:</span>
      <span>${formatCurrency(totals.totalCol7Actual)}</span>
    </div>

    <div class="double-divider"></div>

    <div class="var-highlight">
      <div style="font-size: 9px; text-transform: uppercase;">*** TOTAL NET VARIANCE ***</div>
      <div class="var-big">${formatCurrency(totals.totalVariance, true)}</div>
      <div style="font-size: 8.5px; text-transform: uppercase; margin-top: 1px;">
        ${
          totals.totalVariance < 0
            ? '>> SHORT <<'
            : totals.totalVariance > 0
            ? '>> OVER <<'
            : '>> BALANCED (OK) <<'
        }
      </div>
    </div>

    ${
      record.notes
        ? `
      <div class="divider"></div>
      <div style="font-size: 8.5px;">
        <strong>NOTES:</strong> ${record.notes}
      </div>
    `
        : ''
    }

    ${
      showQrCode && qrCodeDataUrl
        ? `
      <div class="qr-block">
        <img src="${qrCodeDataUrl}" class="qr-img" alt="QR" />
        <div style="font-size: 7.5px; text-transform: uppercase;">Scan for Digital Audit</div>
      </div>
    `
        : ''
    }

    ${
      showSignatures
        ? `
      <div class="signatures">
        <div class="sign-line">
          Cashier Sign: ${record.operator || 'Staff'}
        </div>
        <div class="sign-line">
          Manager / Audit Approval
        </div>
      </div>
    `
        : ''
    }

    <div class="divider" style="margin-top: 8px;"></div>
    <div class="center" style="font-size: 7.5px; color: #555;">
      *** END OF SLIP ***
    </div>

    <script>
      window.onload = function() {
        setTimeout(function() {
          try { window.print(); } catch(e){}
        }, 200);
      };
    </script>
  </body>
</html>`;
  };

  const handlePrintThermal = () => {
    const html = generateThermalPrintHtml();
    const iframe = printIframeRef.current;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        w.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden animate-in fade-in">
      <div className="bg-zinc-900 border-2 border-amber-400 shadow-[8px_8px_0px_0px_rgba(251,191,36,0.8)] max-w-2xl w-full max-h-[92vh] flex flex-col rounded-none overflow-hidden">
        {/* Top Title Bar */}
        <div className="bg-black text-white p-3 sm:p-4 flex items-center justify-between border-b-2 border-amber-400">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-400 text-black border border-black font-black">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-black text-sm sm:text-base text-amber-300 uppercase tracking-wider">
                  Print-Friendly Thermal View
                </h3>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                  POS / Slip Ready
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Essential fields only for 58mm / 80mm POS receipt printers & quick audit slips
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-700 cursor-pointer"
            title="Close thermal view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="bg-zinc-950 px-3 sm:px-4 py-2.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Paper Width Selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-zinc-400 text-[11px]">Paper Width:</span>
            <div className="inline-flex rounded border border-zinc-700 p-0.5 bg-zinc-900">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                  paperWidth === '80mm'
                    ? 'bg-amber-400 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                80mm (POS)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                  paperWidth === '58mm'
                    ? 'bg-amber-400 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                58mm (Mini)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('full')}
                className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                  paperWidth === 'full'
                    ? 'bg-amber-400 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Full Slip
              </button>
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-300">
            <label className="flex items-center gap-1 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showTillBreakdown}
                onChange={(e) => setShowTillBreakdown(e.target.checked)}
                className="rounded text-amber-400 focus:ring-0 cursor-pointer"
              />
              <span>Tills</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-amber-400 focus:ring-0 cursor-pointer"
              />
              <span>Signatures</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={(e) => setShowQrCode(e.target.checked)}
                className="rounded text-amber-400 focus:ring-0 cursor-pointer"
              />
              <span>QR</span>
            </label>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopySlip}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 px-2.5 py-1.5 text-xs font-mono font-bold rounded cursor-pointer active:scale-95 transition-all shadow-xs"
              title="Copy plain text thermal receipt to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintThermal}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-3.5 py-1.5 text-xs font-mono font-black uppercase rounded cursor-pointer active:scale-95 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Send to Thermal Receipt Printer"
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Print Slip</span>
            </button>
          </div>
        </div>

        {/* Live Thermal Paper Visual Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex justify-center items-start">
          <div
            className={`bg-white text-black font-mono shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-zinc-300 p-4 sm:p-5 transition-all select-text ${
              paperWidth === '58mm'
                ? 'w-[260px] text-[11px]'
                : paperWidth === '80mm'
                ? 'w-[360px] text-xs'
                : 'w-full max-w-lg text-sm'
            }`}
            style={{
              backgroundImage: 'repeating-linear-gradient(#fbfbfb, #fbfbfb 24px, #ffffff 24px, #ffffff 48px)',
            }}
          >
            {/* Serrated receipt top edge visual */}
            <div className="text-center pb-2 border-b border-dashed border-zinc-900">
              <div className="font-black text-sm uppercase tracking-wider text-black">
                DAILY TILL CASHING
              </div>
              <div className="text-[10px] font-bold uppercase text-zinc-600">
                Delta Cashing Up Sheet
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-zinc-900 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-zinc-600">Date:</span>
                <span className="font-bold">{formattedDate} ({dayOfWeek.slice(0, 3)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Financial Year:</span>
                <span className="font-bold">{fyString}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Operator:</span>
                <span className="font-bold">{record.operator || 'Not Specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Status:</span>
                <span className="font-bold">{record.isSaved ? 'LOCKED / FINALISED' : 'DRAFT'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Printed:</span>
                <span className="text-[10px]">{printTimestamp}</span>
              </div>
            </div>

            {/* Essential Till Breakdown */}
            {showTillBreakdown && (
              <div className="py-2.5 border-b-2 border-zinc-900">
                <div className="text-center font-bold text-[10px] uppercase tracking-wider text-zinc-800 mb-2 bg-zinc-100 py-0.5 border border-zinc-300">
                  Essential Till Breakdown
                </div>
                <div className="space-y-3">
                  {record.rows.map((row, idx) => {
                    if (row.isYard) {
                      const yVar = row.customVariance || 0;
                      return (
                        <div key={row.id || idx} className="border-b border-dotted border-zinc-400 pb-1.5">
                          <div className="font-black text-xs uppercase">{row.name}</div>
                          <div className="flex justify-between items-center text-[11px] mt-0.5">
                            <span className="text-zinc-600">Variance:</span>
                            <span className={`font-black ${yVar < 0 ? 'text-red-600' : yVar > 0 ? 'text-emerald-700' : 'text-black'}`}>
                              {formatCurrency(yVar, true)} ({yVar < 0 ? 'SHORT' : yVar > 0 ? 'OVER' : 'OK'})
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const expTotal = getRowExpectedTotal(row);
                    const actTotal = getRowActualTotal(row);
                    const variance = getRowVariance(row, record, allRecords);

                    return (
                      <div key={row.id || idx} className="border-b border-dotted border-zinc-400 pb-1.5 last:border-b-0">
                        <div className="flex justify-between items-baseline font-black text-xs uppercase">
                          <span>{row.name}</span>
                          <span
                            className={`font-mono text-[11px] ${
                              variance < 0
                                ? 'text-red-600 font-black'
                                : variance > 0
                                ? 'text-emerald-700 font-black'
                                : 'text-black font-bold'
                            }`}
                          >
                            Var: {formatCurrency(variance, true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5">
                          <span>Sys Expected:</span>
                          <span className="font-bold">{formatCurrency(expTotal)}</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 pl-2">
                          (Cash: {formatCurrency(row.col1ExpectedCash)} + Card: {formatCurrency(row.col2ExpectedCard)})
                        </div>

                        <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5">
                          <span>Counted Total:</span>
                          <span className="font-bold">{formatCurrency(actTotal)}</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 pl-2">
                          (Bank: {formatCurrency(row.col4BankingCash)} + Flt: {formatCurrency(row.col5FloatCash)} + Card: {formatCurrency(row.col6ActualCard)})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Essential Day Summary */}
            <div className="py-2.5 border-b-2 border-zinc-900 space-y-1 text-xs">
              <div className="text-center font-bold text-[10px] uppercase tracking-wider text-zinc-800 mb-1 bg-zinc-100 py-0.5 border border-zinc-300">
                Reconciliation Summary
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-600">Total System Cash (B):</span>
                <span className="font-mono font-bold">{formatCurrency(totals.totalCol1Cash)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-600">Total System Card (C):</span>
                <span className="font-mono font-bold">{formatCurrency(totals.totalCol2Card)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-dotted border-zinc-400 pt-1">
                <span>TOTAL EXPECTED (D):</span>
                <span className="font-mono">{formatCurrency(totals.totalCol3Expected)}</span>
              </div>

              <div className="pt-1.5 border-t border-zinc-900 mt-1.5 space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-600">Cash Banked (E):</span>
                  <span className="font-mono font-bold">{formatCurrency(totals.totalCol4Banking)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-600">Float Retained (F):</span>
                  <span className="font-mono font-bold">{formatCurrency(totals.totalCol5Float)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-600">Card PDQ Total (G):</span>
                  <span className="font-mono font-bold">{formatCurrency(totals.totalCol6Card)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dotted border-zinc-400 pt-1">
                  <span>TOTAL COUNTED (H):</span>
                  <span className="font-mono">{formatCurrency(totals.totalCol7Actual)}</span>
                </div>
              </div>
            </div>

            {/* Total Variance Highlight Box */}
            <div
              className={`my-3 p-2 text-center border-2 border-black ${
                totals.totalVariance < 0
                  ? 'bg-red-50 border-red-900 text-red-950'
                  : totals.totalVariance > 0
                  ? 'bg-emerald-50 border-emerald-900 text-emerald-950'
                  : 'bg-zinc-100 border-black text-black'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider">
                *** NET SHIFT VARIANCE (I) ***
              </div>
              <div className="text-lg font-black font-mono tracking-tight my-0.5">
                {formatCurrency(totals.totalVariance, true)}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                {totals.totalVariance < 0 ? (
                  <>
                    <TrendingDown className="w-3 h-3 text-red-700" />
                    <span>SHORTAGE ON SHIFT</span>
                  </>
                ) : totals.totalVariance > 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-emerald-700" />
                    <span>OVERAGE ON SHIFT</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-black" />
                    <span>BALANCED & RECONCILED</span>
                  </>
                )}
              </div>
            </div>

            {/* Notes if any */}
            {record.notes && (
              <div className="py-2 border-b border-dashed border-zinc-900 text-[10px]">
                <span className="font-bold">Notes:</span> {record.notes}
              </div>
            )}

            {/* QR Code */}
            {showQrCode && qrCodeDataUrl && (
              <div className="py-2 text-center border-b border-dashed border-zinc-900">
                <img src={qrCodeDataUrl} alt="Audit QR" className="w-16 h-16 mx-auto border border-black p-0.5" />
                <div className="text-[8px] uppercase tracking-wider text-zinc-600 mt-1 font-mono">
                  Scan for Digital Audit Verification
                </div>
              </div>
            )}

            {/* Signatures */}
            {showSignatures && (
              <div className="pt-3 space-y-4 text-[10px]">
                <div>
                  <div className="border-b border-black w-full pb-3" />
                  <div className="flex justify-between text-zinc-600 mt-1">
                    <span>Cashier Signature</span>
                    <span>{record.operator || 'Staff Member'}</span>
                  </div>
                </div>
                <div>
                  <div className="border-b border-black w-full pb-3" />
                  <div className="flex justify-between text-zinc-600 mt-1">
                    <span>Manager / Auditor Approval</span>
                    <span>Date & Time</span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-[8px] uppercase text-zinc-500 pt-4 tracking-widest">
              *** END OF THERMAL SLIP ***
            </div>
          </div>
        </div>

        {/* Bottom Footer Info & Action */}
        <div className="bg-black text-zinc-400 px-4 py-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white font-bold">Optimised for standard 80mm & 58mm POS thermal printers</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintThermal}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black border border-black px-4 py-1.5 font-bold uppercase rounded cursor-pointer active:scale-95 transition-all shadow-xs"
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Print Now</span>
            </button>
          </div>
        </div>

        {/* Hidden printing iframe for seamless direct thermal printing */}
        <iframe ref={printIframeRef} title="Thermal Print Frame" className="hidden" />
      </div>
    </div>
  );
};
