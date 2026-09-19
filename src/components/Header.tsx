import React from 'react';
import { ActiveTab, SheetRecord, ViewMode } from '../types';
import { User } from 'firebase/auth';
import {
  Calculator,
  LayoutGrid,
  Sparkles,
  History,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  ChevronUp,
  Lock,
  Menu,
  TrendingUp,
} from 'lucide-react';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';

interface HeaderProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  activeTab: ActiveTab;
  onChangeActiveTab: (tab: ActiveTab) => void;
  recordCount: number;
  records: SheetRecord[];
  auditCount?: number;
  selectedYear: string;
  onSelectYear: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  authUser?: User | null;
  cloudStatus?: 'connected' | 'connecting' | 'offline' | 'error';
  onHideHeader?: () => void;
  isSecurityProtected?: boolean;
  onLockAppNow?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onChangeViewMode,
  activeTab,
  onChangeActiveTab,
  recordCount,
  records,
  auditCount = 0,
  selectedYear,
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  authUser,
  cloudStatus = 'connected',
  onHideHeader,
  isSecurityProtected = false,
  onLockAppNow,
}) => {
  return (
    <header className="bg-black text-white border-b-2 border-black sticky top-0 z-40 shadow-md print:hidden">
      <div className="max-w-7xl ml-0 mr-auto px-3 sm:px-6 py-2.5 space-y-2">
        {/* Tier 1: Streamlined Brand Header & Direct Menu Access */}
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div 
              onClick={() => onChangeActiveTab('sheet')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-amber-400 text-black flex items-center justify-center font-serif font-bold text-lg sm:text-xl shadow-xs border border-black shrink-0 cursor-pointer hover:bg-amber-300 transition-colors"
              title="Return to Cashing Up Sheet"
            >
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
                  {cloudStatus === 'connected' ? 'Live Synced' : cloudStatus === 'connecting' ? 'Syncing...' : 'Offline'}
                </span>
              </div>
              <h1 className="font-serif italic font-bold text-base sm:text-xl tracking-tight text-white flex items-center gap-2">
                Daily Till Reconciliation
              </h1>
            </div>
          </div>

          {/* Right Header: Financial Year, Quick Lock, User & Prominent Menu Button */}
          <div className="flex items-center gap-2">
            {/* Quick Financial Year Switcher (Compact) */}
            <div className="hidden sm:block border-r border-zinc-800 pr-2">
              <FinancialYearSwitcher
                selectedYear={selectedYear}
                onSelectYear={onSelectYear}
                records={records}
                format={financialYearFormat}
                onChangeFormat={onChangeFinancialYearFormat}
                compact={true}
                showFormatToggle={false}
              />
            </div>

            {/* Quick Lock Button (Active only when PIN is enabled) */}
            {isSecurityProtected && onLockAppNow && (
              <button
                onClick={onLockAppNow}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/50 shadow-xs active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer rounded-xs"
                title="Lock Application with PIN"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Lock</span>
              </button>
            )}

            {/* User Avatar Badge (Compact) */}
            {authUser && (
              <div 
                onClick={() => onChangeActiveTab('menu')}
                className="hidden lg:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-xs cursor-pointer hover:bg-zinc-800 transition-colors"
                title={`Signed in as ${authUser.displayName || authUser.email} (Click to open Menu)`}
              >
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt="User"
                    className="w-4 h-4 rounded-full border border-amber-400"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-amber-400 text-black font-bold text-[9px] flex items-center justify-center">
                    {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-[11px] font-mono text-zinc-300 max-w-[80px] truncate">
                  {authUser.displayName || authUser.email?.split('@')[0]}
                </span>
              </div>
            )}

            {/* Separate Screen MENU Button */}
            <button
              onClick={() => onChangeActiveTab('menu')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === 'menu'
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.4)]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border-zinc-700 hover:border-amber-400 shadow-xs'
              }`}
              title="Open System Menu Screen"
            >
              <Menu className="w-4 h-4 text-amber-400" />
              <span>Menu</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Primary Navigation Tabs & View Mode Switcher */}
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Main Navigation Tabs */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-sm border border-zinc-800 gap-1 overflow-x-auto max-w-full">
            <button
              onClick={() => onChangeActiveTab('sheet')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeTab === 'weekly'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Weekly Report</span>
              <span className="sm:hidden">Weekly</span>
            </button>

            <button
              onClick={() => onChangeActiveTab('monthly')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeTab === 'monthly'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Monthly Reconciliation & Audit Report with Custom Date Range"
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Monthly Report</span>
              <span className="sm:hidden">Monthly</span>
            </button>

            <button
              onClick={() => onChangeActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-white text-black font-extrabold shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Chronological Audit History of All Record Revisions, Edits & Authorizations"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Audit Log</span>
              {auditCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                  activeTab === 'audit' ? 'bg-black text-white' : 'bg-zinc-800 text-amber-400'
                }`}>
                  {auditCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onChangeActiveTab('menu')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeTab === 'menu'
                  ? 'bg-amber-400 text-black font-black shadow-xs'
                  : 'text-amber-300 hover:text-white hover:bg-zinc-800'
              }`}
              title="System Menu: Backups, Reports, Staff, Cloud Sync & Security"
            >
              <Menu className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Menu</span>
            </button>
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
                  <span className="hidden sm:inline">Delta Form</span>
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
                  <span className="hidden sm:inline">Editorial Grid</span>
                </button>
              </div>

              {onHideHeader && (
                <button
                  onClick={onHideHeader}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs text-xs font-extrabold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/50 shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all ml-1"
                  title="Hide main header when editing/entering daily till records to maximize workspace"
                >
                  <ChevronUp className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="hidden sm:inline">Hide Header</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
