import React, { useState } from 'react';
import { Calendar, ChevronDown, Check, Sparkles, Filter } from 'lucide-react';
import { SheetRecord } from '../types';
import { getFinancialYear, getAvailableFinancialYears } from '../utils/calculations';

export type FinancialYearFormat = 'calendar' | 'uk_tax';

interface FinancialYearSwitcherProps {
  selectedYear: string; // 'all' or '2025', '2026', 'FY 2024/25', etc.
  onSelectYear: (year: string) => void;
  records: SheetRecord[];
  format?: FinancialYearFormat;
  onChangeFormat?: (format: FinancialYearFormat) => void;
  compact?: boolean;
  showFormatToggle?: boolean;
}

export const FinancialYearSwitcher: React.FC<FinancialYearSwitcherProps> = ({
  selectedYear,
  onSelectYear,
  records,
  format = 'calendar',
  onChangeFormat,
  compact = false,
  showFormatToggle = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableYears = getAvailableFinancialYears(records, format);

  // Count records for each year
  const getRecordCountForYear = (yr: string) => {
    if (yr === 'all') return records.length;
    return records.filter((r) => {
      if (!r.date) return false;
      const fy = getFinancialYear(r.date, format);
      return fy === yr || r.date.startsWith(yr);
    }).length;
  };

  const getDisplayLabel = (yr: string) => {
    if (yr === 'all' || !yr) return 'All Financial Years';
    if (format === 'calendar') return `Year ${yr}`;
    return yr;
  };

  if (compact) {
    return (
      <div className="relative inline-block text-left">
        <div className="flex items-center bg-slate-900 border-2 border-amber-400 rounded shadow-xs overflow-hidden">
          <div className="px-2 py-1 bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-950" />
            <span>FY:</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-black text-white hover:text-amber-300 transition-colors cursor-pointer"
          >
            <span className="font-mono">{selectedYear === 'all' ? 'All Years' : selectedYear}</span>
            <span className="text-[10px] text-slate-400 font-mono">({getRecordCountForYear(selectedYear)})</span>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400 ml-0.5" />
          </button>
        </div>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-1 w-56 rounded-md bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
              {/* Mode Toggle inside dropdown */}
              {showFormatToggle && onChangeFormat && (
                <div className="p-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-600">
                  <span>Format:</span>
                  <div className="flex bg-slate-200 p-0.5 rounded">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeFormat('calendar');
                      }}
                      className={`px-1.5 py-0.5 rounded ${
                        format === 'calendar' ? 'bg-amber-400 text-black font-black' : 'text-slate-700'
                      }`}
                    >
                      Calendar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeFormat('uk_tax');
                      }}
                      className={`px-1.5 py-0.5 rounded ${
                        format === 'uk_tax' ? 'bg-amber-400 text-black font-black' : 'text-slate-700'
                      }`}
                    >
                      UK Tax (Apr-Mar)
                    </button>
                  </div>
                </div>
              )}

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectYear('all');
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    selectedYear === 'all'
                      ? 'bg-amber-100 text-slate-950 font-black'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {selectedYear === 'all' && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                    All Financial Years
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                    {records.length}
                  </span>
                </button>

                {availableYears.map((yr) => {
                  const count = getRecordCountForYear(yr);
                  const isSelected = selectedYear === yr;

                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        onSelectYear(yr);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-100 text-slate-950 font-black'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                        {getDisplayLabel(yr)}
                      </span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-black ${
                          count > 0 ? 'bg-amber-200 text-amber-950' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {count} records
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full-width / Bar mode (e.g., in Records List or Dashboard)
  return (
    <div className="bg-white border-2 border-slate-900 rounded-md p-2.5 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-400 text-black rounded font-black">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block leading-none">
              Active Financial Period
            </span>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
              {selectedYear === 'all' ? 'All Financial Records' : getDisplayLabel(selectedYear)}
            </h4>
          </div>
        </div>

        {/* Format Selector (Calendar vs UK Tax Year) */}
        {showFormatToggle && onChangeFormat && (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500 font-bold hidden sm:inline">Mode:</span>
            <div className="flex bg-slate-100 p-0.5 rounded border border-slate-300">
              <button
                type="button"
                onClick={() => onChangeFormat('calendar')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  format === 'calendar'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                Calendar (2025, 2026)
              </button>
              <button
                type="button"
                onClick={() => onChangeFormat('uk_tax')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  format === 'uk_tax'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                UK Tax (Apr-Mar)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Year Selection Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onSelectYear('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedYear === 'all'
              ? 'bg-slate-900 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-2 ring-amber-400'
              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>All Years</span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-black ${
              selectedYear === 'all' ? 'bg-amber-400 text-black' : 'bg-white text-slate-700'
            }`}
          >
            {records.length}
          </span>
        </button>

        {availableYears.map((yr) => {
          const count = getRecordCountForYear(yr);
          const isSelected = selectedYear === yr;

          return (
            <button
              key={yr}
              type="button"
              onClick={() => onSelectYear(yr)}
              className={`px-3 py-1.5 text-xs font-bold rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 font-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-2 ring-slate-950'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-amber-50 hover:border-amber-400'
              }`}
            >
              <span>{yr}</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-black ${
                  isSelected ? 'bg-black text-amber-400' : count > 0 ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
