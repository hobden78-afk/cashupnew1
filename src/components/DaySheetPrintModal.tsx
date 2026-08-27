import React, { useEffect, useState } from "react";
import { SheetRecord } from "../types";
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
} from "../utils/calculations";
import { exportDaySheetToPDF } from "../utils/pdfExport";
import { generateRecordQrDataUrl } from "../utils/qrCode";
import {
  Printer,
  ExternalLink,
  Download,
  X,
  FileText,
  Loader2,
  QrCode,
  Receipt,
} from "lucide-react";
import { ThermalReceiptModal } from "./ThermalReceiptModal";

interface DaySheetPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SheetRecord;
  allRecords?: SheetRecord[];
}

export const DaySheetPrintModal: React.FC<DaySheetPrintModalProps> = ({
  isOpen,
  onClose,
  record,
  allRecords = [],
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);

  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const formattedDate = formatToUKDate(record.date);
  const printTimestamp = `${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportDaySheetToPDF(record, allRecords);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const generateHtml = (qrDataUrl: string = "") => {
    const rowsHtml = record.rows
      .map((row) => {
        const expTotal = getRowExpectedTotal(row);
        const actTotal = getRowActualTotal(row);
        const variance = getRowVariance(row, record, allRecords);

        const varStyle =
          variance < 0
            ? "color: #dc2626; font-weight: 800;"
            : variance > 0
              ? "color: #15803d; font-weight: 800;"
              : "color: #000; font-weight: 800;";

        const varLabel = variance < 0 ? "SHORT" : variance > 0 ? "OVER" : "OK";

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
      })
      .join("");

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Till Cashing Sheet - ${formattedDate}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm 10mm; }
      @media print {
        body { padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print, button, nav, header { display: none !important; visibility: hidden !important; height: 0 !important; }
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 16px 20px;
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
        background: #fbbf24;
        color: #000;
        border: 2px solid #000;
        font-weight: bold;
        padding: 10px 20px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
      }
      .header {
        border-bottom: 3px solid #000;
        padding-bottom: 10px;
        margin-bottom: 14px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .title-sub {
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #52525b;
      }
      h1 {
        font-family: Georgia, serif;
        font-style: italic;
        margin: 2px 0 4px 0;
        font-size: 24px;
        color: #000;
      }
      .meta {
        text-align: right;
        font-size: 11px;
        font-family: monospace;
        color: #52525b;
      }
      .stats {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
      }
      .card {
        flex: 1;
        border: 2px solid #000;
        padding: 8px 10px;
        background: #fafafa;
      }
      .card-title {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #000;
      }
      .card-val {
        font-size: 20px;
        font-family: monospace;
        font-weight: 800;
        margin-top: 2px;
        color: #000;
      }
      .card-variance {
        flex: 1.2;
        border: 3px double #000 !important;
        outline: 2px solid #000;
        background: #f4f4f5 !important;
        padding: 8px 12px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
        border: 2px solid #000;
      }
      th {
        background: #000;
        color: #fff;
        padding: 7px 6px;
        text-align: left;
        font-size: 10.5px;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }
      td {
        padding: 7px 6px;
        font-size: 12.5px;
        font-weight: 700;
        white-space: nowrap;
      }
      tfoot tr {
        background: #000000 !important;
        color: #ffffff !important;
        font-family: monospace;
        font-weight: 900 !important;
        font-size: 14px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tfoot td {
        padding: 9px 7px !important;
        font-weight: 900 !important;
        font-size: 14px !important;
        color: #ffffff !important;
        background-color: #000000 !important;
        border-top: 3px solid #000000 !important;
        border-bottom: 3px double #000000 !important;
      }
      tfoot td.variance-cell {
        border-left: 2px solid #ffffff !important;
        border-right: 2px solid #ffffff !important;
        background-color: #000000 !important;
        color: #ffffff !important;
        font-size: 15px !important;
        text-decoration: underline;
      }
      .sign-section {
        margin-top: 20px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: 10px;
        font-family: monospace;
      }
      .sign-box {
        border-top: 1.5px solid #000;
        width: 210px;
        padding-top: 4px;
        text-align: center;
      }
      .audit-stamp {
        border: 2px solid #000;
        background: #f4f4f5;
        padding: 6px 14px;
        text-align: center;
        font-weight: 900;
        font-family: monospace;
        font-size: 11px;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <strong style="font-size: 14px;">🖨️ Day Sheet Printable Document</strong>
      <button onclick="window.print()" class="print-btn">Click Here to Print / Save PDF</button>
    </div>

    <div class="header">
      <div>
        <div class="title-sub">Daily Till Cashing & Reconciliation</div>
        <h1>Day Cashing Sheet: ${formattedDate}</h1>
        <div style="font-size: 12px; font-family: monospace; margin-top: 2px;">
          Operator: <strong>${record.operator || "Not Specified"}</strong> | Status: <strong>${record.isSaved ? "Locked / Finalised" : "Draft"}</strong>
        </div>
      </div>
      <div class="meta">
        <div>Printed: ${printTimestamp}</div>
        <div>Date: ${formattedDate}</div>
      </div>
    </div>

    <div class="stats">
      <div class="card">
        <div class="card-title">System Expected (D)</div>
        <div class="card-val">${formatCurrency(totals.totalCol3Expected)}</div>
      </div>
      <div class="card">
        <div class="card-title">Cash Banked (E)</div>
        <div class="card-val">${formatCurrency(totals.totalCol4Banking)}</div>
      </div>
      <div class="card">
        <div class="card-title">Card Machine (G)</div>
        <div class="card-val">${formatCurrency(totals.totalCol6Card)}</div>
      </div>
      <div class="card">
        <div class="card-title">Actual Count (H)</div>
        <div class="card-val">${formatCurrency(totals.totalCol7Actual)}</div>
      </div>
      <div class="card card-variance">
        <div class="card-title" style="font-weight: 900;">Total Variance (I)</div>
        <div class="card-val" style="font-weight: 900; ${totals.totalVariance < 0 ? "color:#dc2626;" : totals.totalVariance > 0 ? "color:#15803d;" : "color:#000;"}">
          ${formatCurrency(totals.totalVariance, true)}
        </div>
        <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
          ${totals.totalVariance < 0 ? "SHORT (-)" : totals.totalVariance > 0 ? "OVER (+)" : "BALANCED (RECONCILED)"}
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
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #000000 !important; color: #ffffff !important;">
          <td style="color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">DAY TOTALS</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol1Cash)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol2Card)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol3Expected)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol4Banking)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol5Float)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol6Card)}</td>
          <td style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 14px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalCol7Actual)}</td>
          <td class="variance-cell" style="text-align: right; color: #ffffff !important; background: #000000 !important; font-weight: 900 !important; font-size: 15px !important; padding: 9px 7px !important;">${formatCurrency(totals.totalVariance, true)}</td>
        </tr>
      </tfoot>
    </table>

    ${
      record.notes
        ? `<div style="margin-top: 16px; padding: 10px; border: 1.5px solid #000; font-family: monospace; font-size: 11px; background: #fafafa;">
            <strong>Shift / Audit Notes:</strong> ${record.notes}
          </div>`
        : ""
    }

    <div class="sign-section">
      <div class="sign-box">
        Operator Signature
        <div style="font-size: 9px; color: #52525b; margin-top: 2px;">${record.operator || "Staff Member"}</div>
      </div>

      <!-- Center Audit & QR Code Digital Verification Block -->
      <div style="display: flex; align-items: center; gap: 10px; border: 2px solid #000; padding: 4px 10px; background: #f4f4f5; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
        ${
          qrDataUrl
            ? `<img src="${qrDataUrl}" alt="Digital Audit QR Code" style="width: 58px; height: 58px; display: block; border: 1px solid #000; background: #fff;" />`
            : ""
        }
        <div style="text-align: left; line-height: 1.3;">
          <div class="audit-stamp" style="border: none; padding: 0; background: transparent; text-align: left;">
            TOTAL VARIANCE: ${formatCurrency(totals.totalVariance, true)}
          </div>
          <div style="font-size: 8.5px; font-family: monospace; color: #3f3f46; margin-top: 2px;">
            ID: <strong>${record.id}</strong> | Status: <strong>${totals.totalVariance < 0 ? "SHORT" : totals.totalVariance > 0 ? "OVER" : "BALANCED"}</strong>
          </div>
          <div style="font-size: 7.5px; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">
            Scan QR for Digital Verification
          </div>
        </div>
      </div>

      <div class="sign-box">
        Manager / Auditor Approval
        <div style="font-size: 9px; color: #52525b; margin-top: 2px;">Date & Signature</div>
      </div>
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

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      generateRecordQrDataUrl(record, totals, 160).then((qrUrl) => {
        if (!isMounted) return;
        setQrCodeDataUrl(qrUrl);
        const html = generateHtml(qrUrl);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        try {
          window.print();
        } catch (e) {
          console.warn("Direct print blocked by sandbox:", e);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, record]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:hidden">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-black text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400 text-black border border-black font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif italic text-lg sm:text-xl font-bold text-white">
                Print Day Cashing Sheet
              </h3>
              <p className="text-xs font-mono text-zinc-400">
                Date: {formattedDate} | Operator:{" "}
                {record.operator || "Not Specified"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="bg-amber-100 p-4 border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-amber-950 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Print preview ready. Use the options below to print or download PDF:
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-center"
              title="Generate and download high-resolution PDF with jsPDF"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Export PDF (jsPDF)
                </>
              )}
            </button>

            {/* Print-Friendly Thermal Slip Button */}
            <button
              type="button"
              onClick={() => setIsThermalModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-center"
              title="Switch to clean thermal printer slip view (essential fields only)"
            >
              <Receipt className="w-4 h-4 text-black" />
              Print-Friendly Thermal Slip
            </button>

            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-center"
              >
                <ExternalLink className="w-4 h-4" />
                Open Printable Page
              </a>
            )}

            <button
              onClick={() => {
                try {
                  window.print();
                } catch (e) {
                  console.warn(e);
                }
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              Print (Ctrl+P)
            </button>

            {blobUrl && (
              <a
                href={blobUrl}
                download={`Till_Cashing_Sheet_${record.date}.html`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider px-3.5 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download HTML
              </a>
            )}
          </div>
        </div>

        {/* Live Visual Preview */}
        <div className="flex-1 p-4 bg-zinc-100 overflow-y-auto max-h-[60vh]">
          <div className="bg-white p-6 sm:p-8 border-2 border-black shadow-sm text-black space-y-6">
            <div className="border-b-2 border-black pb-4 flex justify-between items-end">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Daily Till Cashing & Reconciliation
                </div>
                <h2 className="text-xl font-serif italic font-bold">
                  Day Sheet: {formattedDate}
                </h2>
                <p className="text-xs font-mono text-zinc-600 mt-1">
                  Operator:{" "}
                  <span className="font-bold">
                    {record.operator || "Not Specified"}
                  </span>{" "}
                  | Status:{" "}
                  <span className="font-bold">
                    {record.isSaved ? "Locked / Finalised" : "Draft"}
                  </span>
                </p>
              </div>
              <div className="text-right text-xs font-mono text-zinc-500">
                <div>Printed: {printTimestamp}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="border-2 border-black p-2.5 bg-zinc-50">
                <div className="text-[9px] font-bold uppercase text-zinc-500">
                  (D) Expected
                </div>
                <div className="text-base font-mono font-bold">
                  {formatCurrency(totals.totalCol3Expected)}
                </div>
              </div>
              <div className="border-2 border-black p-2.5 bg-zinc-50">
                <div className="text-[9px] font-bold uppercase text-zinc-500">
                  (E) Banking
                </div>
                <div className="text-base font-mono font-bold">
                  {formatCurrency(totals.totalCol4Banking)}
                </div>
              </div>
              <div className="border-2 border-black p-2.5 bg-zinc-50">
                <div className="text-[9px] font-bold uppercase text-zinc-500">
                  (G) Card PDQ
                </div>
                <div className="text-base font-mono font-bold">
                  {formatCurrency(totals.totalCol6Card)}
                </div>
              </div>
              <div className="border-2 border-black p-2.5 bg-zinc-50">
                <div className="text-[9px] font-bold uppercase text-zinc-500">
                  (H) Count Total
                </div>
                <div className="text-base font-mono font-bold">
                  {formatCurrency(totals.totalCol7Actual)}
                </div>
              </div>
              <div className="border-2 border-black p-2.5 bg-amber-200">
                <div className="text-[9px] font-bold uppercase text-black">
                  (I) Variance
                </div>
                <div
                  className={`text-base font-mono font-bold ${totals.totalVariance < 0 ? "text-rose-700" : totals.totalVariance > 0 ? "text-emerald-800" : "text-black"}`}
                >
                  {formatCurrency(totals.totalVariance, true)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border-2 border-black">
              <table className="w-full text-xs text-left">
                <thead className="bg-black text-white text-xs uppercase font-extrabold">
                  <tr>
                    <th className="p-2.5">Register</th>
                    <th className="p-2.5 text-right">Sys Cash</th>
                    <th className="p-2.5 text-right">Sys Card</th>
                    <th className="p-2.5 text-right bg-zinc-800 text-white font-extrabold">
                      Sys Total
                    </th>
                    <th className="p-2.5 text-right">Banking</th>
                    <th className="p-2.5 text-right">Float</th>
                    <th className="p-2.5 text-right">Card PDQ</th>
                    <th className="p-2.5 text-right bg-zinc-800 text-white font-extrabold">
                      Count Total
                    </th>
                    <th className="p-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300 font-mono text-xs font-bold">
                  {record.rows.map((row, i) => {
                    const expTotal = getRowExpectedTotal(row);
                    const actTotal = getRowActualTotal(row);
                    const variance = getRowVariance(row, record, allRecords);
                    return (
                      <tr key={i}>
                        <td className="p-2.5 font-extrabold font-sans text-sm text-black">
                          {row.name}
                        </td>
                        <td className="p-2.5 text-right text-black">
                          {formatCurrency(row.col1ExpectedCash)}
                        </td>
                        <td className="p-2.5 text-right text-black">
                          {formatCurrency(row.col2ExpectedCard)}
                        </td>
                        <td className="p-2.5 text-right font-extrabold bg-zinc-100 text-black">
                          {formatCurrency(expTotal)}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-black">
                          {formatCurrency(row.col4BankingCash)}
                        </td>
                        <td className="p-2.5 text-right text-black">
                          {formatCurrency(row.col5FloatCash)}
                        </td>
                        <td className="p-2.5 text-right text-black">
                          {formatCurrency(row.col6ActualCard)}
                        </td>
                        <td className="p-2.5 text-right font-extrabold bg-zinc-100 text-black">
                          {formatCurrency(actTotal)}
                        </td>
                        <td
                          className={`p-2.5 text-right font-extrabold ${variance < 0 ? "text-rose-700" : variance > 0 ? "text-emerald-800" : "text-black"}`}
                        >
                          {formatCurrency(variance, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-black text-white font-mono font-black text-sm sm:text-base border-t-4 border-black">
                  <tr>
                    <td className="p-3 text-white font-serif italic font-black text-sm sm:text-base bg-black">
                      TOTALS
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol1Cash)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol2Card)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol3Expected)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol4Banking)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol5Float)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol6Card)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalCol7Actual)}
                    </td>
                    <td className="p-3 text-right text-white font-black text-sm sm:text-base bg-black">
                      {formatCurrency(totals.totalVariance, true)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {record.notes && (
              <div className="p-3 border-2 border-black bg-zinc-50 font-mono text-xs">
                <span className="font-bold uppercase tracking-wider block text-zinc-500 text-[10px] mb-1">
                  Audit Notes:
                </span>
                {record.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 p-3 border-t-2 border-black flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider border-2 border-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Print-Friendly Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={isThermalModalOpen}
        onClose={() => setIsThermalModalOpen(false)}
        record={record}
        allRecords={allRecords}
      />
    </div>
  );
};
