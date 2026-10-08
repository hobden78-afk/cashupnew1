import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download, 
  RefreshCw, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { SheetRecord, AttachedPdfFile } from '../types';
import { 
  fileToDataUrl, 
  formatFileSize, 
  downloadPdfDataUrl, 
  savePdfToIndexedDb, 
  getPdfFromIndexedDb, 
  deletePdfFromIndexedDb,
  MAX_PDF_UPLOAD_SIZE,
  MAX_FIRESTORE_PDF_SIZE
} from '../utils/pdfStorage';
import { PdfPreviewModal } from './PdfPreviewModal';

interface PdfAttachmentHolderProps {
  record: SheetRecord;
  isLocked: boolean;
  onChangeRecord: (record: SheetRecord, immediate?: boolean) => void;
  className?: string;
  variant?: 'delta' | 'modern';
}

export const PdfAttachmentHolder: React.FC<PdfAttachmentHolderProps> = ({
  record,
  isLocked,
  onChangeRecord,
  className = '',
  variant = 'delta',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePdf, setActivePdf] = useState<AttachedPdfFile | null>(record.attachedPdf || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize state when record.attachedPdf changes or retrieve from IndexedDB if dataUrl is empty
  useEffect(() => {
    let isMounted = true;
    if (record.attachedPdf) {
      if (record.attachedPdf.dataUrl) {
        setActivePdf(record.attachedPdf);
      } else {
        // Retrieve full dataUrl from local IndexedDB
        getPdfFromIndexedDb(record.id).then((stored) => {
          if (isMounted && stored && stored.dataUrl) {
            setActivePdf(stored);
          } else if (isMounted) {
            setActivePdf(record.attachedPdf || null);
          }
        });
      }
    } else {
      setActivePdf(null);
    }
    return () => {
      isMounted = false;
    };
  }, [record.id, record.attachedPdf]);

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);

    // Validate MIME type or file extension
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrorMessage('Only PDF documents are supported (.pdf).');
      return;
    }

    if (file.size > MAX_PDF_UPLOAD_SIZE) {
      setErrorMessage(`File is too large (${formatFileSize(file.size)}). Max allowed is 15MB.`);
      return;
    }

    setIsProcessing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploadedAt = new Date().toISOString();

      const newPdf: AttachedPdfFile = {
        name: file.name,
        size: file.size,
        type: 'application/pdf',
        dataUrl,
        uploadedAt,
      };

      // Always save to local IndexedDB
      await savePdfToIndexedDb(record.id, newPdf);

      // If under Firestore max limit, store dataUrl directly in Firestore record
      // If larger, store metadata in Firestore record and keep dataUrl in IndexedDB
      const recordPdf: AttachedPdfFile = {
        name: file.name,
        size: file.size,
        type: 'application/pdf',
        dataUrl: file.size <= MAX_FIRESTORE_PDF_SIZE ? dataUrl : undefined,
        uploadedAt,
      };

      setActivePdf(newPdf);
      onChangeRecord({
        ...record,
        attachedPdf: recordPdf,
      });
    } catch (err: any) {
      console.error('Error processing PDF file:', err);
      setErrorMessage('Failed to read and process the PDF file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLocked) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLocked) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    setIsConfirmingDelete(false);
    try {
      await deletePdfFromIndexedDb(record.id);
      setActivePdf(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onChangeRecord(
        {
          ...record,
          attachedPdf: null,
        },
        true // Immediate cloud persistence
      );
    } catch (err: any) {
      console.error('Error removing PDF:', err);
      setErrorMessage('Failed to delete PDF file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!activePdf) return;
    let dataUrl = activePdf.dataUrl;

    if (!dataUrl) {
      const stored = await getPdfFromIndexedDb(record.id);
      if (stored?.dataUrl) {
        dataUrl = stored.dataUrl;
      }
    }

    if (dataUrl) {
      downloadPdfDataUrl(dataUrl, activePdf.name);
    } else {
      alert('Unable to retrieve PDF data for download.');
    }
  };

  const handleOpenPreview = async () => {
    if (!activePdf) return;
    if (!activePdf.dataUrl) {
      const stored = await getPdfFromIndexedDb(record.id);
      if (stored?.dataUrl) {
        setActivePdf(stored);
      }
    }
    setIsPreviewOpen(true);
  };

  const isDelta = variant === 'delta';

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={isLocked || isProcessing}
        onChange={handleFileInputChange}
      />

      {/* Header Label */}
      <div className="flex items-center justify-between mb-1.5">
        <label className={`block text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDelta ? 'text-slate-900' : 'text-zinc-700'}`}>
          <Paperclip className={`w-3.5 h-3.5 ${isDelta ? 'text-amber-600' : 'text-black'}`} />
          <span>Attached PDF File Holder:</span>
        </label>
        {activePdf && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-400 px-1.5 py-0.2 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            PDF Attached
          </span>
        )}
      </div>

      {/* Content: Has PDF vs Empty Slot */}
      {activePdf ? (
        <div 
          className={`border-2 rounded p-2.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDelta 
              ? 'bg-white border-slate-400 shadow-xs' 
              : 'bg-zinc-50 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          {/* File Metadata */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 bg-red-100 border-2 border-red-600 rounded flex flex-col items-center justify-center shrink-0 text-red-700 shadow-xs">
              <FileText className="w-5 h-5 text-red-600" />
              <span className="text-[7px] font-black tracking-tighter uppercase font-mono">PDF</span>
            </div>

            <div className="min-w-0 flex-1">
              <div 
                className="font-mono font-black text-xs text-slate-900 truncate"
                title={activePdf.name}
              >
                {activePdf.name}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                <span className="font-bold text-slate-700">{formatFileSize(activePdf.size)}</span>
                <span>•</span>
                <span>
                  {activePdf.uploadedAt 
                    ? new Date(activePdf.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Uploaded'}
                </span>
                {activePdf.size > MAX_FIRESTORE_PDF_SIZE && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded text-[9px] font-sans">
                    Local High-Res
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons with In-App Confirmation */}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5 bg-rose-50 border-2 border-rose-400 p-1.5 rounded animate-in fade-in shrink-0">
              <span className="text-xs font-black text-rose-950 pr-1">Delete this PDF?</span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-2.5 py-1 rounded border border-rose-800 shadow-xs cursor-pointer active:scale-95"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isProcessing}
                className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded border border-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              {/* View / Preview Button */}
              <button
                type="button"
                onClick={handleOpenPreview}
                className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs px-2.5 py-1.5 rounded border border-slate-900 shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Preview attached PDF document"
              >
                <Eye className="w-3.5 h-3.5 text-black" />
                <span>View</span>
              </button>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-2 py-1.5 rounded border border-slate-400 shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Download PDF to computer"
              >
                <Download className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden md:inline">Download</span>
              </button>

              {/* Replace Button */}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-1.5 text-slate-700 hover:text-black hover:bg-slate-200 rounded border border-slate-300 transition-colors cursor-pointer"
                  title="Replace with another PDF file"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* Remove / Delete Button */}
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isProcessing}
                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white px-2.5 py-1.5 rounded border border-rose-300 hover:border-rose-700 font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-95"
                title="Delete attached PDF document"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty File Holder / Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isLocked && !isProcessing) {
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded p-3 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
            isLocked
              ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed'
              : isDragging
                ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-400 cursor-pointer'
                : 'bg-white hover:bg-slate-50 border-slate-400 hover:border-slate-600 text-slate-700 cursor-pointer shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${isLocked ? 'bg-slate-200 text-slate-400' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-tight">
              {isLocked 
                ? 'No PDF File Attached (Sheet Locked)' 
                : isProcessing 
                  ? 'Processing PDF...' 
                  : 'Click or Drag & Drop PDF to Attach'}
            </span>
          </div>
          {!isLocked && !isProcessing && (
            <span className="text-[10px] text-slate-500 font-sans">
              Attach daily settlement report, bank pay-in slip, Z-reading, or audit documentation (.pdf up to 15MB)
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 p-1.5 rounded flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Fullscreen / Modal PDF Preview */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdf={activePdf}
        dateStr={record.date}
        onDelete={handleConfirmDelete}
      />
    </div>
  );
};
