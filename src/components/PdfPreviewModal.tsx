import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Loader2,
  AlertCircle,
  Maximize2,
  Trash2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  downloadPdfDataUrl, 
  formatFileSize, 
  dataUrlToBlob, 
  openPdfInNewTab 
} from '../utils/pdfStorage';
import { AttachedPdfFile } from '../types';

// Configure PDF.js worker using Vite's static worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdf: AttachedPdfFile | null;
  dateStr?: string;
  onDelete?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  pdf,
  dateStr,
  onDelete,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load PDF Document when modal opens or pdf changes
  useEffect(() => {
    if (!isOpen || !pdf || !pdf.dataUrl) {
      setNumPages(0);
      setCurrentPage(1);
      setIsLoading(false);
      setRenderError(null);
      pdfDocRef.current = null;
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setRenderError(null);
    setCurrentPage(1);
    setRotation(0);

    const loadDocument = async () => {
      try {
        // Convert base64 dataUrl into binary array for PDF.js
        const base64Data = pdf.dataUrl!.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid PDF data format.');
        }
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;

        if (isCancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('PDF.js loading error:', err);
        setRenderError(err?.message || 'Failed to load PDF document.');
        setIsLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [isOpen, pdf?.dataUrl]);

  // Render current page onto canvas
  useEffect(() => {
    if (!isOpen || !pdfDocRef.current || numPages === 0) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Account for high-DPI screens
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF.js page render warning:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [isOpen, numPages, currentPage, scale, rotation]);

  if (!isOpen || !pdf || !pdf.dataUrl) return null;

  const handleDownload = () => {
    if (pdf.dataUrl) {
      downloadPdfDataUrl(pdf.dataUrl, pdf.name);
    }
  };

  const handleOpenNewTab = () => {
    if (pdf.dataUrl) {
      openPdfInNewTab(pdf.dataUrl);
    }
  };

  const handlePrint = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${pdf.name}</title>
              <style>
                body { margin: 0; padding: 20px; text-align: center; font-family: sans-serif; background: #fff; }
                img { max-width: 100%; height: auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                @media print {
                  body { padding: 0; }
                  img { width: 100%; }
                }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" onload="window.print();" />
            </body>
          </html>
        `);
        win.document.close();
      }
    } else {
      handleOpenNewTab();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-zinc-900 border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col w-full max-w-5xl h-[92vh] max-h-[900px] overflow-hidden rounded-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2.5 bg-black text-white border-b-2 border-zinc-700 shrink-0 gap-2">
          {/* File Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-red-600 border border-white text-white rounded shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-md">
                  {pdf.name}
                </span>
                <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700 shrink-0">
                  {formatFileSize(pdf.size)}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                {dateStr && <span>Date: {dateStr}</span>}
                {numPages > 0 && <span>• {numPages} {numPages === 1 ? 'Page' : 'Pages'}</span>}
              </div>
            </div>
          </div>

          {/* Interactive Navigation & Zoom Controls */}
          {numPages > 0 && !renderError && (
            <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-xs">
              {/* Page Navigator */}
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs px-1 text-zinc-200">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="w-px h-3.5 bg-zinc-700 mx-1" />

              {/* Zoom Controls */}
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="font-mono text-[10px] text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-zinc-700 cursor-pointer"
                title="Reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-3.5 bg-zinc-700 mx-1" />

              {/* Rotate Button */}
              <button
                type="button"
                onClick={handleRotate}
                className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded cursor-pointer"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Buttons: Print, Download, Open, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded border border-transparent hover:border-zinc-700 transition-colors cursor-pointer"
              title="Print document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-2.5 py-1 border border-black shadow-xs cursor-pointer active:scale-95 transition-all"
              title="Download PDF file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded border border-transparent hover:border-zinc-700 transition-colors cursor-pointer"
              title="Open full PDF in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-700 rounded border border-transparent hover:border-rose-600 transition-colors cursor-pointer"
                title="Delete this PDF attachment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-red-600 rounded transition-colors cursor-pointer ml-1"
              title="Close viewer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Banner inside Modal */}
        {showConfirmDelete && (
          <div className="bg-rose-950 text-white px-4 py-2.5 flex items-center justify-between border-b-2 border-rose-600 shrink-0 gap-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to permanently delete this attached PDF?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDelete(false);
                  onDelete?.();
                  onClose();
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3 py-1 rounded border border-rose-400 cursor-pointer shadow-xs active:scale-95"
              >
                Yes, Delete PDF
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-2.5 py-1 rounded border border-zinc-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full bg-zinc-800 overflow-auto flex items-center justify-center p-4 relative min-h-0 select-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                Rendering PDF Document...
              </span>
            </div>
          ) : renderError ? (
            /* Fallback if Canvas Rendering encounters an issue */
            <div className="max-w-md bg-zinc-900 border-2 border-red-500 p-6 rounded text-center text-white shadow-xl">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-sm font-black uppercase font-mono tracking-wider mb-2 text-red-200">
                Notice Loading Document
              </h3>
              <p className="text-xs text-zinc-400 font-mono mb-4 leading-relaxed">
                {renderError}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-3.5 py-2 rounded border border-black cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3.5 py-2 rounded border border-zinc-600 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Browser</span>
                </button>
              </div>
            </div>
          ) : (
            /* Real Canvas PDF Page Render */
            <div className="max-w-full max-h-full flex items-center justify-center shadow-2xl bg-white border border-black transition-all">
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black border-t-2 border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-2 text-[11px] truncate">
            <span className="text-amber-400 font-bold">●</span>
            <span className="truncate">Attached to Daily Cashing Sheet: {pdf.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-600 rounded-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
