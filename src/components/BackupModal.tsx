import React, { useRef } from 'react';
import { Download, Upload, RotateCcw, Database, Cloud, X, CheckCircle2, FileJson, AlertCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordCount: number;
  onBackupJSON: () => void;
  onRestoreJSON: (file: File) => void;
  onResetSampleData: () => void;
  onForceCloudSync?: () => void;
  onOpenBulkExport?: () => void;
  onRecalculateAllData?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  recordCount,
  onBackupJSON,
  onRestoreJSON,
  onResetSampleData,
  onForceCloudSync,
  onOpenBulkExport,
  onRecalculateAllData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreJSON(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white text-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-black text-white px-5 py-4 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-400 text-black flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-lg">Backup & Restore Data</h2>
              <p className="text-[11px] text-zinc-400">Export, import or reset your Till Cashing records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Cloud Sync Status */}
          <div className="bg-emerald-50 border-2 border-emerald-600 p-3.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Firebase Cloud Sync Active
                </div>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  {recordCount} daily till sheet record{recordCount === 1 ? '' : 's'} connected.
                </p>
              </div>
            </div>
            {onForceCloudSync && (
              <button
                onClick={onForceCloudSync}
                className="flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider px-3 py-2 rounded border border-emerald-900 shadow-xs cursor-pointer shrink-0"
              >
                <Cloud className="w-3.5 h-3.5" />
                Sync Cloud Now
              </button>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Option 1: Download Backup */}
          <div className="border-2 border-black p-4 rounded-lg bg-zinc-50 hover:bg-amber-50/50 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-sm text-black uppercase tracking-wider">
                  1. Download Backup File (.json)
                </h3>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mb-3 font-medium">
              Save a full copy of all your daily till sheets and records to your device. Recommended before making large changes or switching devices.
            </p>
            <button
              onClick={onBackupJSON}
              className="w-full flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Download Backup File (.JSON)
            </button>
          </div>

          {/* Option 2: Restore from File */}
          <div className="border-2 border-black p-4 rounded-lg bg-zinc-50 hover:bg-blue-50/50 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="font-bold text-sm text-black uppercase tracking-wider">
                  2. Restore Records from Backup
                </h3>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mb-3 font-medium">
              Upload a previously downloaded <code className="font-mono bg-zinc-200 px-1 py-0.5 rounded text-[11px]">.json</code> backup file to restore records into your Cloud database.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs uppercase tracking-wider py-2.5 px-4 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Select & Upload Backup File (.JSON)
            </button>
          </div>

          {/* Option 3: Bulk Export All (CSV & PDF) */}
          {onOpenBulkExport && (
            <div className="border-2 border-black p-4 rounded-lg bg-zinc-50 hover:bg-emerald-50/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h3 className="font-bold text-sm text-black uppercase tracking-wider">
                    3. Bulk Export All Records (CSV & PDF)
                  </h3>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mb-3 font-medium">
                Generate a single comprehensive CSV spreadsheet and master printable PDF audit report of all {recordCount} saved records in your state.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenBulkExport();
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Launch Bulk Export All Hub
              </button>
            </div>
          )}

          {/* Option 4: Recalculate All Data */}
          {onRecalculateAllData && (
            <div className="border-2 border-black p-4 rounded-lg bg-zinc-50 hover:bg-amber-50/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-600 shrink-0" />
                  <h3 className="font-bold text-sm text-black uppercase tracking-wider">
                    4. Global Data Recalculation
                  </h3>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mb-3 font-medium">
                Audit and sequentially recalculate all {recordCount} historical sheets, cascade previous day floats, sync Card PDQs, and verify all balances.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onRecalculateAllData();
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recalculate All Data Now
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 px-5 py-3 border-t-2 border-black flex justify-end">
          <button
            onClick={onClose}
            className="bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
