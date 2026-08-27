import React, { useState } from 'react';
import { ActiveTab, SheetRecord, ViewMode } from '../types';
import { User } from 'firebase/auth';
import {
  Calculator,
  LayoutGrid,
  Sparkles,
  History,
  BarChart3,
  RotateCcw,
  Download,
  Upload,
  Smartphone,
  Database,
  RefreshCw,
  Printer,
  Calendar,
  Cloud,
  LogIn,
  LogOut,
  User as UserIcon,
  FileSpreadsheet,
  ChevronUp,
} from 'lucide-react';
import { ShareAppModal } from './ShareAppModal';
import { BackupModal } from './BackupModal';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';

interface HeaderProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  activeTab: ActiveTab;
  onChangeActiveTab: (tab: ActiveTab) => void;
  recordCount: number;
  records: SheetRecord[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  onResetSampleData: () => void;
  onBackupJSON: () => void;
  onRestoreJSON: (file: File) => void;
  onRecalculatePageValues?: () => void;
  onRecalculateAllData?: () => void;
  onOpenGoogleCalendar?: () => void;
  onForceCloudSync?: () => void;
  onOpenRangeReport?: () => void;
  onOpenBulkExport?: () => void;
  onOpenStaffModal?: () => void;
  authUser?: User | null;
  onLogin?: () => void;
  onLogout?: () => void;
  cloudStatus?: 'connected' | 'connecting' | 'offline' | 'error';
  onHideHeader?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onChangeViewMode,
  activeTab,
  onChangeActiveTab,
  recordCount,
  records,
  selectedYear,
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  onResetSampleData,
  onBackupJSON,
  onRestoreJSON,
  onRecalculatePageValues,
  onRecalculateAllData,
  onOpenGoogleCalendar,
  onForceCloudSync,
  onOpenRangeReport,
  onOpenBulkExport,
  onOpenStaffModal,
  authUser,
  onLogin,
  onLogout,
  cloudStatus = 'connected',
  onHideHeader,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreJSON(file);
    }
  };

  return (
    <header className="bg-black text-white border-b-2 border-black sticky top-0 z-40 shadow-md print:hidden">
      <div className="max-w-7xl ml-0 mr-auto px-3 sm:px-6 py-2.5 space-y-2.5">
        {/* Tier 1: Brand Header & Utility Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo, Title & Financial Year Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-amber-400 text-black flex items-center justify-center font-serif font-bold text-lg sm:text-xl shadow-xs border border-black shrink-0">
              Δ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400 block -mb-0.5">
                  Operational Audit
                </span>
                <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                  cloudStatus === 'connected'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-600/60'
                    : cloudStatus === 'connecting'
                    ? 'bg-amber-950 text-amber-300 border-amber-600/60 animate-pulse'
                    : 'bg-rose-950 text-rose-300 border-rose-600/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    cloudStatus === 'connected' ? 'bg-emerald-400' : cloudStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  {cloudStatus === 'connected' ? 'Live Synced' : cloudStatus === 'connecting' ? 'Syncing...' : 'Offline Mode'}
                </span>
              </div>
              <h1 className="font-serif italic font-bold text-base sm:text-xl tracking-tight text-white flex items-center gap-2">
                Daily Till Reconciliation
              </h1>
            </div>

            {/* Financial Year Switcher in Top Bar */}
            <div className="pl-1 sm:pl-2 border-l border-zinc-800">
              <FinancialYearSwitcher
                selectedYear={selectedYear}
                onSelectYear={onSelectYear}
                records={records}
                format={financialYearFormat}
                onChangeFormat={onChangeFinancialYearFormat}
                compact={true}
              />
            </div>
          </div>

          {/* Utility Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {onRecalculateAllData && (
              <button
                onClick={onRecalculateAllData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Recalculate all records in database, cascade floats, and sync balances"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Recalculate All</span>
              </button>
            )}

            {onOpenGoogleCalendar && (
              <button
                onClick={onOpenGoogleCalendar}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wider bg-white hover:bg-zinc-200 text-black border border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Google Calendar Integration"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Calendar</span>
              </button>
            )}

            {onForceCloudSync && (
              <button
                onClick={onForceCloudSync}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-500/50 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Force push/pull sync with Cloud database across devices"
              >
                <Cloud className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Sync Cloud</span>
              </button>
            )}

            {onOpenBulkExport && (
              <button
                onClick={onOpenBulkExport}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Bulk Export All Records to single CSV file & Master PDF Audit Report"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>Bulk Export All</span>
              </button>
            )}

            {onOpenStaffModal && (
              <button
                onClick={onOpenStaffModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Manage & Edit Staff Roster and Till Operators"
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Edit Staff</span>
              </button>
            )}

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
              title="Backup & Restore Options"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Backup & Restore</span>
              <span className="sm:hidden">Backup</span>
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
              title="Get Android / Mobile App Link"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>App Link</span>
            </button>

            {/* Main Screen Authentication & Logout Section */}
            {authUser ? (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 pl-2 pr-1 py-1 rounded-xs shadow-inner">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'User'}
                    className="w-5 h-5 rounded-full border border-amber-400 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-amber-400 text-black font-bold text-[10px] flex items-center justify-center shrink-0">
                    {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-mono font-medium text-zinc-200 truncate max-w-[100px] sm:max-w-[150px]">
                  {authUser.displayName || authUser.email?.split('@')[0]}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs shadow-xs"
                    title="Log out of account on this device"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            ) : (
              onLogin && (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                  title="Sign in with Google / Firebase"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span>Log In</span>
                </button>
              )
            )}

            {/* Icon quick buttons */}
            <div className="flex items-center border-l border-zinc-800 pl-2 gap-1">
              <button
                onClick={onBackupJSON}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                title="Quick Backup JSON"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                title="Quick Restore JSON"
              >
                <Upload className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Tier 2: Primary Navigation Tabs & View Mode Switcher */}
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Main Navigation Tabs */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-sm border border-zinc-800 gap-1">
            <button
              onClick={() => onChangeActiveTab('sheet')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'sheet'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span>Cashing Up</span>
            </button>

            <button
              onClick={() => onChangeActiveTab('records')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>Archive</span>
              {recordCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                  activeTab === 'records' ? 'bg-black text-white' : 'bg-zinc-800 text-amber-400'
                }`}>
                  {recordCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onChangeActiveTab('weekly')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Weekly Report</span>
            </button>

            {onOpenRangeReport && (
              <button
                onClick={onOpenRangeReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs ml-1"
                title="Print Day Page Report on a Range of Dates"
              >
                <Printer className="w-3.5 h-3.5 shrink-0 text-black" />
                <span>Date Range Report</span>
              </button>
            )}
          </div>

          {/* View Mode Toggle & Hide Header (Delta Form vs Editorial Grid) */}
          {activeTab === 'sheet' && (
            <div className="flex items-center bg-zinc-900 p-1 rounded-sm border border-zinc-800 gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangeViewMode('classic')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    viewMode === 'classic'
                      ? 'bg-amber-400 text-black font-extrabold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Delta Classic Form Layout"
                >
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                  <span>Delta Form</span>
                </button>

                <button
                  onClick={() => onChangeViewMode('modern')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    viewMode === 'modern'
                      ? 'bg-amber-400 text-black font-extrabold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Editorial Grid View"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Editorial Grid</span>
                </button>
              </div>

              {onHideHeader && (
                <button
                  onClick={onHideHeader}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs text-xs font-extrabold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/50 shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all ml-1"
                  title="Hide main header when editing/entering daily till records to maximize workspace"
                >
                  <ChevronUp className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Hide Header</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Android App Link Modal */}
      <ShareAppModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Backup & Restore Dialog Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        recordCount={recordCount}
        onBackupJSON={onBackupJSON}
        onRestoreJSON={onRestoreJSON}
        onResetSampleData={onResetSampleData}
        onForceCloudSync={onForceCloudSync}
        onOpenBulkExport={onOpenBulkExport}
        onRecalculateAllData={onRecalculateAllData}
      />
    </header>
  );
};
