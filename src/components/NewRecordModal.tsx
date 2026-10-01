import React, { useState, useEffect } from 'react';
import { SheetRecord } from '../types';
import { 
  formatToUKDate, 
  getFinancialYear 
} from '../utils/calculations';
import { 
  Calendar, 
  X, 
  PlusCircle, 
  Clock, 
  User, 
  AlertCircle, 
  ArrowRight, 
  Check,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { FinancialYearFormat } from './FinancialYearSwitcher';

interface NewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRecord: (date: string, operator: string) => void;
  onOpenExistingRecord: (recordId: string) => void;
  existingRecords: SheetRecord[];
  operators: string[];
  financialYearFormat?: FinancialYearFormat;
}

export const NewRecordModal: React.FC<NewRecordModalProps> = ({
  isOpen,
  onClose,
  onCreateRecord,
  onOpenExistingRecord,
  existingRecords,
  operators,
  financialYearFormat = 'calendar',
}) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [selectedOperator, setSelectedOperator] = useState<string>(operators[0] || '');

  // Quick dates
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  // Compute next suggested calendar day after latest existing record
  const latestDateInRecords = React.useMemo(() => {
    if (!existingRecords || existingRecords.length === 0) return todayISO;
    const timestamps = existingRecords.map((r) => new Date(r.date).getTime()).filter((t) => !isNaN(t));
    if (timestamps.length === 0) return todayISO;
    const maxT = Math.max(...timestamps);
    const d = new Date(maxT);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [existingRecords, todayISO]);

  useEffect(() => {
    if (isOpen) {
      // Default to today if no record for today exists, else default to next date
      const existsToday = (existingRecords || []).some((r) => r.date === todayISO);
      if (existsToday) {
        setSelectedDate(latestDateInRecords);
      } else {
        setSelectedDate(todayISO);
      }
      if (operators && operators.length > 0 && !selectedOperator) {
        setSelectedOperator(operators[0]);
      }
    }
  }, [isOpen, existingRecords, todayISO, latestDateInRecords, operators]);

  if (!isOpen) return null;

  // Check if a sheet already exists for selectedDate
  const existingRecord = (existingRecords || []).find((r) => r.date === selectedDate);

  // Previous day float preview
  const sorted = [...(existingRecords || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const prevRec = sorted.find((r) => r.date < selectedDate) || sorted[0];
  const floatCarried = prevRec?.rows
    ? prevRec.rows
        .filter((r) => !r.isYard && !r.isOnlineOrders)
        .reduce((sum, r) => sum + (r.col5FloatCash || 0), 0)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    onCreateRecord(selectedDate, selectedOperator);
    onClose();
  };

  const getDayOfWeek = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-GB', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#f4f4f2] border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg flex flex-col overflow-hidden text-black">
        {/* Header */}
        <div className="bg-amber-400 border-b-2 border-black p-3.5 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-black text-amber-400 border border-black shadow-xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-lg sm:text-xl text-black leading-tight">
                Add New Daily Till Sheet
              </h2>
              <p className="text-[11px] font-mono text-zinc-800">
                Choose the date and cashier to cash up registers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-black hover:bg-black/10 border border-black/20 rounded-xs transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Date Selection Box */}
          <div className="bg-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Select Date for Till Sheet:</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-base font-mono font-bold text-black focus:outline-none focus:bg-amber-50 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold px-2 py-2 bg-zinc-200 border border-black shrink-0">
                {getFinancialYear(selectedDate, financialYearFormat)}
              </span>
            </div>

            {/* Quick date shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => setSelectedDate(todayISO)}
                className={`px-2 py-1 text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  selectedDate === todayISO
                    ? 'bg-black text-amber-400 border-black'
                    : 'bg-zinc-100 hover:bg-amber-100 text-black border-zinc-300'
                }`}
              >
                Today ({formatToUKDate(todayISO)})
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayISO)}
                className={`px-2 py-1 text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  selectedDate === yesterdayISO
                    ? 'bg-black text-amber-400 border-black'
                    : 'bg-zinc-100 hover:bg-amber-100 text-black border-zinc-300'
                }`}
              >
                Yesterday ({formatToUKDate(yesterdayISO)})
              </button>

              {latestDateInRecords !== todayISO && latestDateInRecords !== yesterdayISO && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(latestDateInRecords)}
                  className={`px-2 py-1 text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    selectedDate === latestDateInRecords
                      ? 'bg-black text-amber-400 border-black'
                      : 'bg-zinc-100 hover:bg-amber-100 text-black border-zinc-300'
                  }`}
                >
                  Next Day ({formatToUKDate(latestDateInRecords)})
                </button>
              )}
            </div>
          </div>

          {/* Operator / Staff Member Selector */}
          <div className="bg-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-600" />
              <span>Shift Cashier / Operator:</span>
            </label>

            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full bg-zinc-50 border-2 border-black px-3 py-2 text-sm font-bold text-black focus:outline-none focus:bg-amber-50 cursor-pointer"
            >
              <option value="">-- Unassigned / General --</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          {/* Existing Record Notice or Float Info */}
          {existingRecord ? (
            <div className="bg-amber-50 border-2 border-amber-500 p-3 rounded-xs text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950">
                    A till sheet for {formatToUKDate(selectedDate)} already exists!
                  </p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Operator: <strong>{existingRecord.operator || 'Unassigned'}</strong> • Status: <strong>{existingRecord.isSaved ? 'Locked & Saved' : 'Draft in progress'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpenExistingRecord(existingRecord.id);
                    onClose();
                  }}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs py-2 px-3 border border-black shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Open Existing Sheet</span>
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs py-2 px-3 border border-zinc-400 cursor-pointer transition-colors"
                >
                  Create New Duplicate
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 p-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Carrying over float from previous sheet ({prevRec ? formatToUKDate(prevRec.date) : 'Baseline'}):
                </span>
              </div>
              <strong className="font-mono font-black text-emerald-950 text-sm">
                £{floatCarried.toFixed(2)}
              </strong>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-200 border border-zinc-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-black hover:bg-zinc-800 text-amber-400 font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>Create &amp; Open Sheet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
