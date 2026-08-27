import React, { useState, useMemo } from 'react';
import { SheetRecord } from '../types';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  downloadBulkRecordsCSV,
  generateBulkRecordsPdfHtml,
} from '../utils/bulkExport';
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
} from '../utils/calculations';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SheetRecord[];
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({
  isOpen,
  onClose,
  records,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<'csv' | 'both' | null>(null);

  // Compute overall summary stats
  const {
    sortedRecords,
    earliestDate,
    latestDate,
    totalExpected,
    totalActual,
    totalBanking,
    totalFloat,
    totalCard,
    totalVariance,
  } = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    let exp = 0;
    let act = 0;
    let bank = 0;
    let flt = 0;
    let crd = 0;
    let vr = 0;

    sorted.forEach((rec) => {
      const t = calculateGrandTotals(rec.rows, rec, sorted);
      exp += t.totalCol3Expected;
      act += t.totalCol7Actual;
      bank += t.totalCol4Banking;
      flt += t.totalCol5Float;
      crd += t.totalCol6Card;
      vr += t.totalVariance;
    });

    return {
      sortedRecords: sorted,
      earliestDate: sorted.length > 0 ? formatToUKDate(sorted[0].date) : '—',
      latestDate: sorted.length > 0 ? formatToUKDate(sorted[sorted.length - 1].date) : '—',
      totalExpected: exp,
      totalActual: act,
      totalBanking: bank,
      totalFloat: flt,
      totalCard: crd,
      totalVariance: vr,
    };
  }, [records]);

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    downloadBulkRecordsCSV(records);
    setDownloadSuccess('csv');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleOpenPdfPrint = () => {
    const html = generateBulkRecordsPdfHtml(records);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    try {
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        // If popup blocked, open modal preview
        setIsPreviewOpen(true);
      }
    } catch {
      setIsPreviewOpen(true);
    }
  };

  const handlePreviewPdfInModal = () => {
    const html = generateBulkRecordsPdfHtml(records);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setIsPreviewOpen(true);
  };

  const handleExportBoth = () => {
    downloadBulkRecordsCSV(records);
    handleOpenPdfPrint();
    setDownloadSuccess('both');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
      <div className="bg-white text-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-4xl max-h-[92vh] flex flex-col rounded-lg overflow-hidden">
        {/* Modal Header */}
        <div className="bg-black text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b-2 border-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-amber-400 text-black flex items-center justify-center font-bold shadow-xs border border-black shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Data Governance & Audit Archive
                </span>
                <span className="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700">
                  {records.length} {records.length === 1 ? 'Record' : 'Records'} in State
                </span>
              </div>
              <h2 className="font-serif italic font-bold text-lg sm:text-xl text-white">
                Bulk Export All Records
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-zinc-50">
          {/* Top Audit Banner */}
          <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Date Range:</span>
                <span className="font-mono bg-zinc-100 px-2 py-0.5 border border-zinc-300 text-black">
                  {earliestDate} — {latestDate}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-600">
                Audit Scope: <strong className="text-black">{records.length} Complete Daily Sheets</strong>
              </div>
            </div>

            {/* Quick KPI Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-zinc-50 p-2.5 border border-zinc-300">
                <div className="text-[10px] font-mono uppercase font-bold text-zinc-600">(D) Expected</div>
                <div className="font-mono font-black text-sm text-black mt-0.5">{formatCurrency(totalExpected)}</div>
              </div>
              <div className="bg-zinc-50 p-2.5 border border-zinc-300">
                <div className="text-[10px] font-mono uppercase font-bold text-zinc-600">(E) Cash Banked</div>
                <div className="font-mono font-black text-sm text-black mt-0.5">{formatCurrency(totalBanking)}</div>
              </div>
              <div className="bg-zinc-50 p-2.5 border border-zinc-300">
                <div className="text-[10px] font-mono uppercase font-bold text-zinc-600">(G) Card PDQ</div>
                <div className="font-mono font-black text-sm text-black mt-0.5">{formatCurrency(totalCard)}</div>
              </div>
              <div className="bg-zinc-50 p-2.5 border border-zinc-300">
                <div className="text-[10px] font-mono uppercase font-bold text-zinc-600">(H) Counted</div>
                <div className="font-mono font-black text-sm text-black mt-0.5">{formatCurrency(totalActual)}</div>
              </div>
              <div
                className={`col-span-2 sm:col-span-1 p-2.5 border-2 ${
                  totalVariance < 0
                    ? 'bg-rose-50 border-rose-600 text-rose-900'
                    : totalVariance > 0
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                    : 'bg-zinc-100 border-black text-black'
                }`}
              >
                <div className="text-[10px] font-mono uppercase font-bold">(I) Net Variance</div>
                <div className="font-mono font-black text-sm mt-0.5">
                  {formatCurrency(totalVariance, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Export Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Single Master CSV */}
            <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between hover:border-amber-500 transition-all">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-black uppercase tracking-tight">
                      Single CSV Master File
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Excel / Google Sheets / SQL Storage
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-700 leading-relaxed mb-4">
                  Generates a single, consolidated <code className="bg-zinc-100 px-1 py-0.5 border border-zinc-300 font-mono text-[11px]">.csv</code> file containing every saved daily sheet, all till register line items (Cols 1-8), daily sub-totals, and master audit ledger figures.
                </p>

                <ul className="text-[11px] text-zinc-600 space-y-1 mb-4">
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Includes all {records.length} days with full till breakdowns
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Columns for System Takings, Banked, Float, PDQ & Variance
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Ideal for accountants, HMRC audits & long-term archiving
                  </li>
                </ul>
              </div>

              <button
                onClick={handleDownloadCSV}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download All Records (.CSV)</span>
              </button>
            </div>

            {/* Option 2: PDF Audit Ledger Document */}
            <div className="bg-white border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between hover:border-amber-500 transition-all">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded bg-rose-600 text-white flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-black uppercase tracking-tight">
                      PDF Master Audit Report
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Printable A4 Landscape Document
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-700 leading-relaxed mb-4">
                  Creates an official printable audit report document with an Executive Master Summary page, key variance cards, followed by complete day-by-day till cashing sheets with signature authorization boxes.
                </p>

                <ul className="text-[11px] text-zinc-600 space-y-1 mb-4">
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Executive summary with KPI breakdown & master ledger
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Dedicated print CSS with page breaks for A4 printing
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Save as PDF via browser print or preview in-app
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleOpenPdfPrint}
                  className="w-full flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={handlePreviewPdfInModal}
                  className="w-full flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider py-2 px-3 border border-black active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                >
                  <span>Preview Report Document</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Dual Export & Feedback Banner */}
          <div className="bg-amber-50 border-2 border-black p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-400 text-black border border-black shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-xs uppercase font-extrabold text-black block">
                  1-Click Dual Bulk Export
                </strong>
                <span className="text-xs text-zinc-700">
                  Instantly trigger CSV file download and launch PDF printable report in one action.
                </span>
              </div>
            </div>

            <button
              onClick={handleExportBoth}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider px-4 py-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              <span>Export Both (CSV + PDF)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Success Banner */}
          {downloadSuccess && (
            <div className="bg-emerald-100 border-2 border-emerald-800 text-emerald-950 p-3 rounded font-mono font-bold text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" />
              {downloadSuccess === 'both'
                ? 'Bulk CSV download started and PDF Report window generated!'
                : 'Bulk CSV file downloaded successfully!'}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-zinc-100 px-4 sm:px-6 py-3 border-t-2 border-black flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> All {records.length} records will be compiled without data loss
          </div>
          <button
            onClick={onClose}
            className="bg-black hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer rounded-xs"
          >
            Done / Close
          </button>
        </div>
      </div>

      {/* PDF Embedded Document Preview Sub-Modal */}
      {isPreviewOpen && blobUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 flex flex-col p-2 sm:p-6 animate-in fade-in">
          <div className="bg-white border-2 border-black w-full h-full flex flex-col rounded-lg overflow-hidden shadow-2xl">
            <div className="bg-black text-white px-4 py-3 flex items-center justify-between border-b-2 border-black shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span className="font-serif italic font-bold text-base">
                  PDF Audit Report Preview ({records.length} Days)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const iframe = document.getElementById('bulk-pdf-preview-iframe') as HTMLIFrameElement;
                    if (iframe?.contentWindow) {
                      iframe.contentWindow.print();
                    } else {
                      window.open(blobUrl, '_blank');
                    }
                  }}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-3 py-1.5 border border-black shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-zinc-200">
              <iframe
                id="bulk-pdf-preview-iframe"
                src={blobUrl}
                title="Bulk PDF Report Preview"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
