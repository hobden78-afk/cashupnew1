import React, { useRef } from 'react';
import { ActiveTab, SheetRecord, ViewMode } from '../types';
import { User } from 'firebase/auth';
import {
  Download,
  Upload,
  RefreshCw,
  Database,
  Cloud,
  Calendar,
  Smartphone,
  FileSpreadsheet,
  Printer,
  User as UserIcon,
  Users,
  Shield,
  Lock,
  LogIn,
  LogOut,
  BarChart3,
  TrendingUp,
  History,
  Calculator,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  LayoutGrid,
  ChevronRight,
  HardDrive,
  Share2,
} from 'lucide-react';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';

interface MenuViewProps {
  records: SheetRecord[];
  recordCount: number;
  auditCount?: number;
  operators?: string[];
  onBackToSheet: () => void;
  onChangeActiveTab: (tab: ActiveTab) => void;
  onBackupJSON: () => void;
  onRestoreJSON: (file: File) => void;
  onRecalculateAllData?: () => void;
  onResetSampleData: () => void;
  onForceCloudSync?: () => void;
  onOpenGoogleCalendar?: () => void;
  onOpenRangeReport?: () => void;
  onOpenBulkExport?: () => void;
  onOpenStaffModal?: () => void;
  onOpenShareModal: () => void;
  onOpenBackupModal: () => void;
  authUser?: User | null;
  onLogin?: () => void;
  onLogout?: () => void;
  cloudStatus?: 'connected' | 'connecting' | 'offline' | 'error';
  isSecurityProtected?: boolean;
  onOpenSecurityModal?: () => void;
  onLockAppNow?: () => void;
  selectedYear: string;
  onSelectYear: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  records,
  recordCount,
  auditCount = 0,
  operators = [],
  onBackToSheet,
  onChangeActiveTab,
  onBackupJSON,
  onRestoreJSON,
  onRecalculateAllData,
  onResetSampleData,
  onForceCloudSync,
  onOpenGoogleCalendar,
  onOpenRangeReport,
  onOpenBulkExport,
  onOpenStaffModal,
  onOpenShareModal,
  onOpenBackupModal,
  authUser,
  onLogin,
  onLogout,
  cloudStatus = 'connected',
  isSecurityProtected = false,
  onOpenSecurityModal,
  onLockAppNow,
  selectedYear,
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  viewMode,
  onChangeViewMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreJSON(file);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-white border-2 border-black p-4 sm:p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded bg-black text-amber-400 flex items-center justify-center font-serif font-bold text-2xl border-2 border-black shrink-0 shadow-xs">
            Δ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                System Administration & Operations
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  cloudStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : cloudStatus === 'connecting'
                    ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cloudStatus === 'connected'
                      ? 'bg-emerald-600'
                      : cloudStatus === 'connecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-600'
                  }`}
                />
                {cloudStatus === 'connected'
                  ? 'Cloud Synced'
                  : cloudStatus === 'connecting'
                  ? 'Syncing...'
                  : 'Offline Mode'}
              </span>
            </div>
            <h1 className="font-serif italic font-bold text-2xl sm:text-3xl text-zinc-900 tracking-tight">
              Application Menu
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Access data tools, backups, reports, staff management, cloud synchronization, and security settings.
            </p>
          </div>
        </div>

        <button
          onClick={onBackToSheet}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider bg-black hover:bg-zinc-800 text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Return to Cashing Up</span>
        </button>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Records Stored
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono font-black text-xl text-black">{recordCount}</span>
            <span className="text-xs text-zinc-500">Daily Sheets</span>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Audit Trail
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono font-black text-xl text-amber-600">{auditCount}</span>
            <span className="text-xs text-zinc-500">Logged Events</span>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            PIN Protection
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {isSecurityProtected ? (
              <>
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-emerald-700">Active</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-zinc-400" />
                <span className="font-medium text-xs text-zinc-500">Disabled</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Current User
          </span>
          <div className="flex items-center gap-1.5 mt-1 truncate">
            {authUser ? (
              <span className="font-mono font-bold text-xs text-black truncate">
                {authUser.displayName || authUser.email?.split('@')[0]}
              </span>
            ) : (
              <span className="text-xs text-zinc-500 italic">Not signed in</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Tools & Administration */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Card 1: Data Management & Backup */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  Data & Backup
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-200 text-emerald-900 border border-emerald-400 rounded-xs">
                JSON / Cloud
              </span>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-600">
                Safeguard all daily sheets, till float histories, staff rosters, and audit records with one-click JSON backup or cloud restores.
              </p>

              <div className="space-y-2 pt-1">
                {/* Instant Backup Button */}
                <button
                  onClick={onBackupJSON}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Backup Database Now</span>
                  </div>
                  <span className="text-[10px] bg-emerald-700 px-1.5 py-0.5 rounded font-mono">.JSON</span>
                </button>

                {/* Restore Backup Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-zinc-100 text-black font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-zinc-700" />
                    <span>Restore from File</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Upload</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Advanced Backup / Cloud Modal */}
                <button
                  onClick={onOpenBackupModal}
                  className="w-full flex items-center justify-between px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs border border-zinc-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Backup & Restore Manager</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 pt-0 border-t border-zinc-200 mt-2 space-y-2">
            {onRecalculateAllData && (
              <button
                onClick={onRecalculateAllData}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                title="Recalculate all records in database, cascade floats, and sync balances"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Recalculate All Float Balances</span>
              </button>
            )}

            <button
              onClick={onResetSampleData}
              className="w-full text-left text-[11px] font-semibold text-rose-700 hover:text-rose-900 hover:underline pt-1 cursor-pointer"
            >
              ↺ Reset to Sample Dataset (01/08/2026)
            </button>
          </div>
        </div>

        {/* Card 2: Reports, Exports & Printing */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  Reports & Exports
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-xs">
                Audit & Print
              </span>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-600">
                Generate consolidated financial reports, audit certificates, multi-day range summaries, or bulk export to CSV.
              </p>

              <div className="space-y-2 pt-1">
                {onOpenBulkExport && (
                  <button
                    onClick={onOpenBulkExport}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Bulk Export All to CSV</span>
                    </div>
                    <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono">Master Sheet</span>
                  </button>
                )}

                {onOpenRangeReport && (
                  <button
                    onClick={onOpenRangeReport}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-black" />
                      <span>Date Range Report</span>
                    </div>
                    <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-mono">Print Range</span>
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Quick View Shortcuts
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onChangeActiveTab('weekly')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xs text-left cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Weekly View</span>
                  </button>

                  <button
                    onClick={() => onChangeActiveTab('monthly')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xs text-left cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Monthly View</span>
                  </button>

                  <button
                    onClick={() => onChangeActiveTab('records')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xs text-left cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    <span>Archive ({recordCount})</span>
                  </button>

                  <button
                    onClick={() => onChangeActiveTab('audit')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xs text-left cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    <span>Audit Log ({auditCount})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Staff & Operators Management */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  Staff & Operators
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xs">
                {operators.length} Active
              </span>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-600">
                Manage your till operators and cashiers list. Changes synchronize across all devices and daily reconciliation sheets.
              </p>

              {onOpenStaffModal && (
                <button
                  onClick={onOpenStaffModal}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-amber-400" />
                    <span>Manage Staff Roster</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              )}

              <div className="pt-2 border-t border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Current Staff Roster
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-zinc-50 border border-zinc-200 rounded">
                  {operators.map((op) => (
                    <span
                      key={op}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-zinc-300 text-zinc-800 text-[11px] font-mono font-medium rounded-xs"
                    >
                      <UserIcon className="w-2.5 h-2.5 text-zinc-400" />
                      {op}
                    </span>
                  ))}
                  {operators.length === 0 && (
                    <span className="text-xs text-zinc-400 italic">No operators listed</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Cloud Sync & Integrations */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  Cloud & Integrations
                </h2>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border rounded-xs ${
                cloudStatus === 'connected' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {cloudStatus === 'connected' ? 'Real-Time' : 'Offline'}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-600">
                Sync live data with Google Firestore, integrate shift dates with Google Calendar, and open on mobile devices.
              </p>

              <div className="space-y-2 pt-1">
                {onForceCloudSync && (
                  <button
                    onClick={onForceCloudSync}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-zinc-50 text-zinc-900 font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                      <span>Force Cloud Sync</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Live DB</span>
                  </button>
                )}

                {onOpenGoogleCalendar && (
                  <button
                    onClick={onOpenGoogleCalendar}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-zinc-50 text-zinc-900 font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>Google Calendar</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Sync Shifts</span>
                  </button>
                )}

                <button
                  onClick={onOpenShareModal}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-black" />
                    <span>Android / Mobile App Link</span>
                  </div>
                  <Share2 className="w-3.5 h-3.5 text-zinc-700" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Security & Passcode Protection */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-800" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  App Security & PIN
                </h2>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border rounded-xs ${
                isSecurityProtected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-zinc-200 text-zinc-700 border-zinc-300'
              }`}>
                {isSecurityProtected ? 'PIN Configured' : 'Open Access'}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-600">
                Protect till takings, banking numbers, and staff records with a numerical PIN passcode and automatic inactivity lock.
              </p>

              <div className="space-y-2 pt-1">
                {isSecurityProtected && onLockAppNow && (
                  <button
                    onClick={onLockAppNow}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900 hover:bg-black text-amber-400 font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Lock Application Now</span>
                    </div>
                    <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-mono font-bold">Lock</span>
                  </button>
                )}

                {onOpenSecurityModal && (
                  <button
                    onClick={onOpenSecurityModal}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-zinc-50 text-zinc-900 font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>{isSecurityProtected ? 'Manage PIN / Timeout' : 'Set Up Security PIN'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                )}
              </div>

              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded text-[11px] text-zinc-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Passcode Protection:</span>
                  <span className="font-bold text-zinc-900">{isSecurityProtected ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cloud Stored:</span>
                  <span className="font-bold text-emerald-700">SHA-256 Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Settings, Financial Year & User Account */}
        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="bg-zinc-100 border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-zinc-800" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-black">
                  User & Preferences
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-xs">
                System
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* User Sign In / Out */}
              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Authentication
                  </span>
                  {authUser && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                      Connected
                    </span>
                  )}
                </div>

                {authUser ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      {authUser.photoURL ? (
                        <img
                          src={authUser.photoURL}
                          alt="User"
                          className="w-7 h-7 rounded-full border border-black shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-amber-400 text-black font-bold text-xs flex items-center justify-center shrink-0 border border-black">
                          {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="font-bold text-xs text-zinc-900 truncate">
                          {authUser.displayName || 'Authenticated Cashier'}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-500 truncate">
                          {authUser.email}
                        </div>
                      </div>
                    </div>

                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-700 rounded-xs transition-colors cursor-pointer shrink-0"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Log Out</span>
                      </button>
                    )}
                  </div>
                ) : (
                  onLogin && (
                    <button
                      onClick={onLogin}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider border border-emerald-700 rounded-xs transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In with Google</span>
                    </button>
                  )
                )}
              </div>

              {/* Financial Year Switcher */}
              <div className="pt-2 border-t border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Active Financial Year
                </span>
                <FinancialYearSwitcher
                  selectedYear={selectedYear}
                  onSelectYear={onSelectYear}
                  records={records}
                  format={financialYearFormat}
                  onChangeFormat={onChangeFinancialYearFormat}
                />
              </div>

              {/* View Layout Toggle */}
              <div className="pt-2 border-t border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Default Cashing Form Layout
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onChangeViewMode('classic')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 border-2 border-black text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      viewMode === 'classic'
                        ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Delta Classic</span>
                  </button>

                  <button
                    onClick={() => onChangeViewMode('modern')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 border-2 border-black text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      viewMode === 'modern'
                        ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Editorial Grid</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Action Strip */}
      <div className="bg-zinc-900 text-white p-4 border-2 border-black flex flex-wrap items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-zinc-300">
            Ready to record today's cash counts and card machine totals?
          </span>
        </div>
        <button
          onClick={onBackToSheet}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
        >
          <span>Open Cashing Sheet</span>
          <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-black" />
        </button>
      </div>
    </div>
  );
};
