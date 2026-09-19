import React, { useState } from 'react';
import { SheetRecord } from '../types';
import { 
  formatToUKDate, 
  calculateGrandTotals, 
  formatCurrency, 
  getFinancialYear 
} from '../utils/calculations';
import { 
  Calendar, 
  X, 
  Search, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp,
  PlusCircle,
  CalendarDays
} from 'lucide-react';
import { FinancialYearFormat } from './FinancialYearSwitcher';

interface GoToDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  records: SheetRecord[];
  onSelectDate: (date: string) => void;
  financialYearFormat?: FinancialYearFormat;
}

export const GoToDateModal: React.FC<GoToDateModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  records,
  onSelectDate,
  financialYearFormat = 'calendar',
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(currentDate || new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Check if chosen date already has a record
  const existingRecordForSelected = records.find((r) => r.date === selectedDate);

  // Filter existing records by search query
  const filteredRecords = records.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const ukDate = formatToUKDate(rec.date).toLowerCase();
    const isoDate = rec.date.toLowerCase();
    const op = (rec.operator || '').toLowerCase();
    const id = (rec.id || '').toLowerCase();
    return ukDate.includes(query) || isoDate.includes(query) || op.includes(query) || id.includes(query);
  });

  const handleApplyDate = (targetDate: string) => {
    if (!targetDate) return;
    onSelectDate(targetDate);
    onClose();
  };

  const getDayOfWeek = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { weekday: 'short' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#f4f4f2] border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-amber-400 border-b-2 border-black p-3.5 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-black text-amber-400 border border-black shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-lg sm:text-xl text-black leading-tight">
                Go to Date Sheet
              </h2>
              <p className="text-[11px] font-mono text-zinc-800">
                Jump directly to any daily cashing sheet or create a new date
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-black hover:bg-black/10 border border-black/20 rounded-xs transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-black">
          {/* Main Date Picker Row */}
          <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700">
              Select Target Date:
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-base font-mono font-bold text-black focus:outline-none focus:bg-amber-50 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => handleApplyDate(selectedDate)}
                className="flex items-center justify-center gap-2 bg-black hover:bg-zinc-800 text-amber-400 font-extrabold text-sm px-5 py-2.5 border-2 border-black shadow-xs active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>Go to Sheet</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Status preview for selected date */}
            <div className="pt-2 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-mono text-zinc-700">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Target: <strong>{formatToUKDate(selectedDate)}</strong> ({getDayOfWeek(selectedDate)})</span>
                <span className="text-[10px] bg-zinc-200 text-zinc-800 font-bold px-1.5 py-0.5 border border-zinc-400">
                  {getFinancialYear(selectedDate, financialYearFormat)}
                </span>
              </div>

              {existingRecordForSelected ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved Record Found
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 border border-blue-300">
                  <PlusCircle className="w-3.5 h-3.5" />
                  Will Create New Sheet
                </span>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Quick Jump Shortcuts:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(todayStr);
                  handleApplyDate(todayStr);
                }}
                className="bg-white hover:bg-amber-100 text-black border border-black px-2.5 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                Today ({formatToUKDate(todayStr)})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDate(yesterdayStr);
                  handleApplyDate(yesterdayStr);
                }}
                className="bg-white hover:bg-amber-100 text-black border border-black px-2.5 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-zinc-600" />
                Yesterday ({formatToUKDate(yesterdayStr)})
              </button>

              {records.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const latest = records[0].date;
                      setSelectedDate(latest);
                      handleApplyDate(latest);
                    }}
                    className="bg-white hover:bg-amber-100 text-black border border-black px-2.5 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    Latest Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const oldest = records[records.length - 1].date;
                      setSelectedDate(oldest);
                      handleApplyDate(oldest);
                    }}
                    className="bg-white hover:bg-amber-100 text-black border border-black px-2.5 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    Oldest Sheet
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Saved Sheets Directory */}
          <div className="bg-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <span>Saved Sheets ({records.length})</span>
              </div>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter dates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 bg-zinc-50 border border-black text-xs font-mono focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-100">
              {filteredRecords.length === 0 ? (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  No matching sheets found.
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  const isCurrent = rec.date === currentDate;
                  const totals = calculateGrandTotals(rec.rows, rec, records);
                  const isBalanced = Math.abs(totals.totalVariance) < 0.005;
                  const isShort = totals.totalVariance < -0.005;

                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => handleApplyDate(rec.date)}
                      className={`w-full text-left p-2 transition-all flex items-center justify-between gap-2 border cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-100 border-black font-black'
                          : 'bg-zinc-50 hover:bg-amber-50/70 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-black">
                          {formatToUKDate(rec.date)}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-600">
                          ({getDayOfWeek(rec.date)})
                        </span>
                        {rec.operator && (
                          <span className="text-[10px] bg-zinc-200 px-1.5 py-0.2 border border-zinc-300 font-medium text-zinc-800 truncate max-w-[100px]">
                            {rec.operator}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[9px] font-mono font-black uppercase bg-black text-amber-400 px-1 py-0.2">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                            isShort
                              ? 'bg-rose-100 border-rose-400 text-rose-800'
                              : !isBalanced
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                              : 'bg-zinc-100 border-zinc-300 text-zinc-700'
                          }`}
                        >
                          {isShort ? (
                            <span className="inline-flex items-center gap-0.5">
                              <TrendingDown className="w-3 h-3 text-rose-600" />
                              {formatCurrency(totals.totalVariance, true)}
                            </span>
                          ) : !isBalanced ? (
                            <span className="inline-flex items-center gap-0.5">
                              <TrendingUp className="w-3 h-3 text-emerald-700" />
                              {formatCurrency(totals.totalVariance, true)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-zinc-600" />
                              BALANCED
                            </span>
                          )}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 border-t-2 border-black p-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-zinc-200 border-2 border-black font-mono font-bold text-xs active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
