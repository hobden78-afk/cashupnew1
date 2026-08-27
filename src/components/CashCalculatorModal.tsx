import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calculator,
  X,
  Check,
  RefreshCw,
  Coins,
  Receipt,
  Plus,
  Trash2,
  Copy,
  CheckCheck,
  History,
  Delete,
  CornerDownLeft,
  Divide,
  Percent,
  PlusCircle,
} from 'lucide-react';
import { DenominationCounts } from '../types';
import { formatCurrency } from '../utils/calculations';

export type TargetFieldType = 'col1ExpectedCash' | 'col2ExpectedCard' | 'col4BankingCash' | 'col5FloatCash';

interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}

interface CashCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tillName: string;
  initialTargetField?: TargetFieldType;
  onApply: (totalAmount: number, targetField: TargetFieldType) => void;
}

const DENOMINATIONS = [
  { key: 'fiftyPounds', label: '£50 Note', value: 50 },
  { key: 'twentyPounds', label: '£20 Note', value: 20 },
  { key: 'tenPounds', label: '£10 Note', value: 10 },
  { key: 'fivePounds', label: '£5 Note', value: 5 },
  { key: 'twoPounds', label: '£2 Coin', value: 2 },
  { key: 'onePound', label: '£1 Coin', value: 1 },
  { key: 'fiftyPence', label: '50p Coin', value: 0.5 },
  { key: 'twentyPence', label: '20p Coin', value: 0.2 },
  { key: 'tenPence', label: '10p Coin', value: 0.1 },
  { key: 'fivePence', label: '5p Coin', value: 0.05 },
  { key: 'twoPence', label: '2p Coin', value: 0.02 },
  { key: 'onePence', label: '1p Coin', value: 0.01 },
] as const;

export const CashCalculatorModal: React.FC<CashCalculatorModalProps> = ({
  isOpen,
  onClose,
  tillName,
  initialTargetField = 'col4BankingCash',
  onApply,
}) => {
  // Tabs: 'standard' (Desktop Calculator), 'denominations' (Cash count), 'tape' (Slips tape)
  const [activeTab, setActiveTab] = useState<'standard' | 'denominations' | 'tape'>('standard');
  const [selectedTarget, setSelectedTarget] = useState<TargetFieldType>(initialTargetField);

  // --- DESKTOP CALCULATOR STATE ---
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [equationString, setEquationString] = useState<string>('');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [memoryValue, setMemoryValue] = useState<number>(0);
  const [hasMemory, setHasMemory] = useState<boolean>(false);
  const [calcHistory, setCalcHistory] = useState<CalculationHistoryItem[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // --- DENOMINATIONS STATE ---
  const [counts, setCounts] = useState<DenominationCounts>({
    fiftyPounds: 0,
    twentyPounds: 0,
    tenPounds: 0,
    fivePounds: 0,
    twoPounds: 0,
    onePound: 0,
    fiftyPence: 0,
    twentyPence: 0,
    tenPence: 0,
    fivePence: 0,
    twoPence: 0,
    onePence: 0,
  });

  // --- TAPE STATE ---
  const [tapeEntries, setTapeEntries] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [tapeInput, setTapeInput] = useState<string>('');
  const [tapeLabelInput, setTapeLabelInput] = useState<string>('');

  // Synchronize on open
  useEffect(() => {
    if (isOpen) {
      setSelectedTarget(initialTargetField);
      // Default to standard desktop calculator
      setActiveTab('standard');
    }
  }, [isOpen, initialTargetField]);

  // Rounding helper
  const roundToDecimals = (num: number, dec: number = 4): number => {
    return Math.round((num + Number.EPSILON) * Math.pow(10, dec)) / Math.pow(10, dec);
  };

  // Perform calculation
  const executeOperation = useCallback(
    (prev: number, current: number, op: string): number => {
      switch (op) {
        case '+':
          return roundToDecimals(prev + current);
        case '-':
          return roundToDecimals(prev - current);
        case '×':
        case '*':
          return roundToDecimals(prev * current);
        case '÷':
        case '/':
          if (current === 0) return 0;
          return roundToDecimals(prev / current);
        default:
          return current;
      }
    },
    []
  );

  // Digit input
  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplayValue(digit);
        setWaitingForOperand(false);
      } else {
        setDisplayValue((prev) => (prev === '0' ? digit : prev + digit));
      }
    },
    [waitingForOperand]
  );

  // Decimal point
  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplayValue('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!displayValue.includes('.')) {
      setDisplayValue((prev) => prev + '.');
    }
  }, [waitingForOperand, displayValue]);

  // Double Zero
  const inputDoubleZero = useCallback(() => {
    if (waitingForOperand) {
      setDisplayValue('0');
      setWaitingForOperand(false);
      return;
    }
    if (displayValue !== '0') {
      setDisplayValue((prev) => prev + '00');
    }
  }, [waitingForOperand, displayValue]);

  // Operator input (+, -, *, /)
  const performOperator = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(displayValue) || 0;

      if (previousValue === null) {
        setPreviousValue(inputValue);
        setEquationString(`${inputValue} ${nextOperator}`);
      } else if (currentOperator && !waitingForOperand) {
        const result = executeOperation(previousValue, inputValue, currentOperator);
        setPreviousValue(result);
        setDisplayValue(String(result));
        setEquationString(`${result} ${nextOperator}`);
      } else {
        setEquationString(`${previousValue} ${nextOperator}`);
      }

      setWaitingForOperand(true);
      setCurrentOperator(nextOperator);
    },
    [displayValue, previousValue, currentOperator, waitingForOperand, executeOperation]
  );

  // Equals
  const handleEquals = useCallback(() => {
    const inputValue = parseFloat(displayValue) || 0;

    if (previousValue !== null && currentOperator) {
      const result = executeOperation(previousValue, inputValue, currentOperator);
      const fullExpression = `${previousValue} ${currentOperator} ${inputValue} =`;

      setEquationString(fullExpression);
      setDisplayValue(String(result));
      setPreviousValue(null);
      setCurrentOperator(null);
      setWaitingForOperand(true);

      // Add to history
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCalcHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          expression: `${previousValue} ${currentOperator} ${inputValue}`,
          result,
          timestamp: timeStr,
        },
        ...prev.slice(0, 29), // Keep latest 30
      ]);
    }
  }, [displayValue, previousValue, currentOperator, executeOperation]);

  // Clear All
  const handleClearAll = useCallback(() => {
    setDisplayValue('0');
    setEquationString('');
    setPreviousValue(null);
    setCurrentOperator(null);
    setWaitingForOperand(false);
  }, []);

  // Clear Entry
  const handleClearEntry = useCallback(() => {
    setDisplayValue('0');
  }, []);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplayValue((prev) => {
      if (prev.length <= 1 || prev === '0' || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [waitingForOperand]);

  // Negate (+/-)
  const handleToggleSign = useCallback(() => {
    const num = parseFloat(displayValue) || 0;
    setDisplayValue(String(-num));
  }, [displayValue]);

  // Percentage (%)
  const handlePercentage = useCallback(() => {
    const current = parseFloat(displayValue) || 0;
    if (previousValue !== null && (currentOperator === '+' || currentOperator === '-')) {
      const percentVal = (previousValue * current) / 100;
      setDisplayValue(String(percentVal));
    } else {
      setDisplayValue(String(current / 100));
    }
  }, [displayValue, previousValue, currentOperator]);

  // Square Root (√)
  const handleSquareRoot = useCallback(() => {
    const current = parseFloat(displayValue) || 0;
    if (current < 0) return;
    const res = roundToDecimals(Math.sqrt(current));
    setDisplayValue(String(res));
    setEquationString(`√(${current})`);
    setWaitingForOperand(true);
  }, [displayValue]);

  // Square (x²)
  const handleSquare = useCallback(() => {
    const current = parseFloat(displayValue) || 0;
    const res = roundToDecimals(current * current);
    setDisplayValue(String(res));
    setEquationString(`sqr(${current})`);
    setWaitingForOperand(true);
  }, [displayValue]);

  // Reciprocal (1/x)
  const handleReciprocal = useCallback(() => {
    const current = parseFloat(displayValue) || 0;
    if (current === 0) return;
    const res = roundToDecimals(1 / current);
    setDisplayValue(String(res));
    setEquationString(`1/(${current})`);
    setWaitingForOperand(true);
  }, [displayValue]);

  // Memory Functions
  const handleMemoryClear = () => {
    setMemoryValue(0);
    setHasMemory(false);
  };

  const handleMemoryRecall = () => {
    if (!hasMemory) return;
    setDisplayValue(String(memoryValue));
    setWaitingForOperand(false);
  };

  const handleMemoryAdd = () => {
    const current = parseFloat(displayValue) || 0;
    setMemoryValue((prev) => prev + current);
    setHasMemory(true);
  };

  const handleMemorySubtract = () => {
    const current = parseFloat(displayValue) || 0;
    setMemoryValue((prev) => prev - current);
    setHasMemory(true);
  };

  const handleMemoryStore = () => {
    const current = parseFloat(displayValue) || 0;
    setMemoryValue(current);
    setHasMemory(true);
  };

  // Copy result to clipboard
  const handleCopyResult = () => {
    navigator.clipboard.writeText(displayValue);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Keyboard Listener for Standard Desktop Calculator
  useEffect(() => {
    if (!isOpen || activeTab !== 'standard') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing inside an actual input element
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        inputDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        inputDecimal();
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        performOperator(e.key);
      } else if (e.key === '*') {
        e.preventDefault();
        performOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        performOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === '%') {
        e.preventDefault();
        handlePercentage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    activeTab,
    inputDigit,
    inputDecimal,
    performOperator,
    handleEquals,
    handleBackspace,
    handleClearAll,
    handlePercentage,
  ]);

  // Denominations Handlers
  const handleCountChange = (key: keyof DenominationCounts, val: string) => {
    const num = parseInt(val, 10);
    setCounts((prev) => ({
      ...prev,
      [key]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const handleAdjustCount = (key: keyof DenominationCounts, delta: number) => {
    setCounts((prev) => {
      const current = prev[key] || 0;
      const updated = Math.max(0, current + delta);
      return {
        ...prev,
        [key]: updated,
      };
    });
  };

  const handleResetCounts = () => {
    setCounts({
      fiftyPounds: 0,
      twentyPounds: 0,
      tenPounds: 0,
      fivePounds: 0,
      twoPounds: 0,
      onePound: 0,
      fiftyPence: 0,
      twentyPence: 0,
      tenPence: 0,
      fivePence: 0,
      twoPence: 0,
      onePence: 0,
    });
  };

  const totalDenominations = DENOMINATIONS.reduce((sum, item) => {
    return sum + (counts[item.key as keyof DenominationCounts] || 0) * item.value;
  }, 0);

  // Tape Handlers
  const handleAddTapeEntry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanStr = tapeInput.trim();
    if (!cleanStr) return;

    let numeric = 0;
    try {
      if (/^[0-9+\-*/.()\s]+$/.test(cleanStr)) {
        numeric = Function(`'use strict'; return (${cleanStr})`)();
      } else {
        numeric = parseFloat(cleanStr);
      }
    } catch {
      numeric = parseFloat(cleanStr);
    }

    if (isNaN(numeric) || numeric === 0) return;

    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      label: tapeLabelInput.trim() || `Slip #${tapeEntries.length + 1}`,
      amount: Number(numeric.toFixed(2)),
    };

    setTapeEntries((prev) => [...prev, newEntry]);
    setTapeInput('');
    setTapeLabelInput('');
  };

  const handleRemoveTapeEntry = (id: string) => {
    setTapeEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearTape = () => {
    setTapeEntries([]);
    setTapeInput('');
    setTapeLabelInput('');
  };

  const totalTape = tapeEntries.reduce((sum, item) => sum + item.amount, 0);

  // Active Value for Apply Action
  const currentStandardValue = parseFloat(displayValue) || 0;
  const activeTotal =
    activeTab === 'standard'
      ? currentStandardValue
      : activeTab === 'denominations'
      ? totalDenominations
      : totalTape;

  const getTargetTitle = (field: TargetFieldType) => {
    switch (field) {
      case 'col1ExpectedCash':
        return 'Sys Cash (1)';
      case 'col2ExpectedCard':
        return 'Sys Card (2)';
      case 'col4BankingCash':
        return 'Banking Cash (4)';
      case 'col5FloatCash':
        return 'Float Cash (5)';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[95vh] rounded-md">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b-2 border-black shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-400 text-slate-950 rounded font-black">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight flex items-center gap-2">
                Desktop Calculator
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-400 text-black rounded font-black">
                  {tillName}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 font-sans">
                Target Field: <span className="font-bold text-amber-400">{getTargetTitle(selectedTarget)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 transition-colors cursor-pointer rounded hover:bg-slate-800"
            title="Close calculator (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Field Selector Row */}
        <div className="bg-slate-100 px-3 sm:px-4 py-2 border-b-2 border-slate-300 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
            Apply to:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: 'col1ExpectedCash', label: '1. Sys Cash', code: 'B' },
                { key: 'col2ExpectedCard', label: '2. Sys Card', code: 'C' },
                { key: 'col4BankingCash', label: '4. Banking', code: 'E' },
                { key: 'col5FloatCash', label: '5. Float', code: 'F' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedTarget(item.key)}
                className={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all cursor-pointer border ${
                  selectedTarget === item.key
                    ? 'bg-slate-900 text-white border-black shadow-xs ring-2 ring-amber-400'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`font-mono text-[9px] px-1 py-0.2 rounded font-black ${
                    selectedTarget === item.key ? 'bg-amber-400 text-black' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {item.code}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Function Mode Tabs */}
        <div className="flex border-b-2 border-slate-300 bg-slate-200 text-xs font-bold uppercase tracking-wider shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 border-r border-slate-300 transition-colors cursor-pointer ${
              activeTab === 'standard'
                ? 'bg-white text-slate-950 border-b-2 border-b-white font-black shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-amber-600" />
            Desktop Calc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('denominations')}
            className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 border-r border-slate-300 transition-colors cursor-pointer ${
              activeTab === 'denominations'
                ? 'bg-white text-slate-950 border-b-2 border-b-white font-black shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            Cash Notes/Coins
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tape')}
            className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'tape'
                ? 'bg-white text-slate-950 border-b-2 border-b-white font-black shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-blue-500" />
            Slips & Tape
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 bg-slate-100">
          {activeTab === 'standard' ? (
            /* TAB 1: AUTHENTIC DESKTOP CALCULATOR */
            <div className="space-y-3">
              {/* LCD Display Screen */}
              <div className="bg-[#1e293b] text-white p-3.5 rounded-lg border-2 border-slate-950 shadow-inner flex flex-col justify-between min-h-[90px] relative">
                {/* Equation & Status Line */}
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    {hasMemory && (
                      <span className="bg-amber-400 text-black text-[9px] font-black px-1 rounded">
                        M
                      </span>
                    )}
                    <span className="truncate max-w-[260px]">{equationString || 'Ready'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        showHistoryPanel
                          ? 'bg-amber-400 text-black border-amber-400 font-bold'
                          : 'text-slate-400 border-slate-600 hover:text-white hover:border-slate-400'
                      }`}
                      title="Toggle calculation history tape"
                    >
                      <History className="w-3 h-3" />
                      History ({calcHistory.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyResult}
                      className="text-slate-400 hover:text-amber-300 p-0.5 transition-colors cursor-pointer"
                      title="Copy result to clipboard"
                    >
                      {copiedNotification ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Large Result Display */}
                <div className="text-right font-mono font-black text-2xl sm:text-3xl tracking-tight text-amber-300 overflow-x-auto whitespace-nowrap mt-1">
                  {displayValue}
                </div>
              </div>

              {/* History Drawer (if open) */}
              {showHistoryPanel && (
                <div className="bg-white border-2 border-slate-800 rounded-lg p-2.5 shadow-sm space-y-1.5 animate-in slide-in-from-top duration-150 max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-600 border-b pb-1">
                    <span>Calculation History</span>
                    {calcHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCalcHistory([])}
                        className="text-rose-600 hover:text-rose-800 text-[10px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  {calcHistory.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-400 italic">
                      No calculations recorded yet.
                    </div>
                  ) : (
                    calcHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDisplayValue(String(item.result));
                          setWaitingForOperand(true);
                        }}
                        className="w-full flex items-center justify-between text-xs py-1 px-1.5 hover:bg-amber-50 rounded font-mono text-left cursor-pointer border-b border-slate-100 last:border-none"
                      >
                        <span className="text-slate-500 truncate max-w-[180px]">{item.expression} =</span>
                        <span className="font-bold text-slate-900 ml-2">{item.result}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Memory Row */}
              <div className="grid grid-cols-5 gap-1 text-xs">
                <button
                  type="button"
                  onClick={handleMemoryClear}
                  disabled={!hasMemory}
                  className="py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 font-bold rounded border border-slate-300 cursor-pointer active:scale-95 transition-all text-[11px]"
                >
                  MC
                </button>
                <button
                  type="button"
                  onClick={handleMemoryRecall}
                  disabled={!hasMemory}
                  className="py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 font-bold rounded border border-slate-300 cursor-pointer active:scale-95 transition-all text-[11px]"
                >
                  MR
                </button>
                <button
                  type="button"
                  onClick={handleMemoryAdd}
                  className="py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded border border-slate-300 cursor-pointer active:scale-95 transition-all text-[11px]"
                >
                  M+
                </button>
                <button
                  type="button"
                  onClick={handleMemorySubtract}
                  className="py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded border border-slate-300 cursor-pointer active:scale-95 transition-all text-[11px]"
                >
                  M-
                </button>
                <button
                  type="button"
                  onClick={handleMemoryStore}
                  className="py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded border border-slate-300 cursor-pointer active:scale-95 transition-all text-[11px]"
                >
                  MS
                </button>
              </div>

              {/* Desktop Keypad Grid */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {/* Row 1: Function Controls */}
                <button
                  type="button"
                  onClick={handleClearEntry}
                  className="py-2.5 bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold rounded border border-slate-400 cursor-pointer active:scale-95 transition-all text-xs"
                >
                  CE
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black rounded border border-rose-300 cursor-pointer active:scale-95 transition-all text-xs"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-2.5 bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold rounded border border-slate-400 flex items-center justify-center cursor-pointer active:scale-95 transition-all text-xs"
                  title="Backspace"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => performOperator('÷')}
                  className={`py-2.5 rounded font-black text-sm border cursor-pointer active:scale-95 transition-all ${
                    currentOperator === '÷'
                      ? 'bg-amber-400 text-black border-black ring-2 ring-amber-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-900'
                  }`}
                >
                  ÷
                </button>

                {/* Row 2: 7, 8, 9, × */}
                <button
                  type="button"
                  onClick={() => inputDigit('7')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('8')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('9')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => performOperator('×')}
                  className={`py-3 rounded font-black text-sm border cursor-pointer active:scale-95 transition-all ${
                    currentOperator === '×'
                      ? 'bg-amber-400 text-black border-black ring-2 ring-amber-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-900'
                  }`}
                >
                  ×
                </button>

                {/* Row 3: 4, 5, 6, - */}
                <button
                  type="button"
                  onClick={() => inputDigit('4')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('5')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('6')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => performOperator('-')}
                  className={`py-3 rounded font-black text-base border cursor-pointer active:scale-95 transition-all ${
                    currentOperator === '-'
                      ? 'bg-amber-400 text-black border-black ring-2 ring-amber-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-900'
                  }`}
                >
                  -
                </button>

                {/* Row 4: 1, 2, 3, + */}
                <button
                  type="button"
                  onClick={() => inputDigit('1')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('2')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('3')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => performOperator('+')}
                  className={`py-3 rounded font-black text-base border cursor-pointer active:scale-95 transition-all ${
                    currentOperator === '+'
                      ? 'bg-amber-400 text-black border-black ring-2 ring-amber-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-900'
                  }`}
                >
                  +
                </button>

                {/* Row 5: ±, 0, ., = */}
                <button
                  type="button"
                  onClick={handleToggleSign}
                  className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-md border border-slate-300 cursor-pointer active:scale-95 transition-all text-sm font-mono"
                >
                  ±
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('0')}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={inputDecimal}
                  className="py-3 bg-white hover:bg-slate-50 text-slate-950 font-black rounded-md border-2 border-slate-300 shadow-xs cursor-pointer active:scale-95 transition-all text-lg font-mono"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleEquals}
                  className="py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-md border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all text-xl font-mono"
                >
                  =
                </button>
              </div>

              {/* Keyboard Help Tips */}
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>⌨️ Keyboard input supported (Numbers, +, -, *, /, Enter, Esc)</span>
              </div>
            </div>
          ) : activeTab === 'denominations' ? (
            /* TAB 2: DENOMINATIONS (COINS & NOTES) */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DENOMINATIONS.map((item) => {
                  const qty = counts[item.key as keyof DenominationCounts];
                  const subtotal = qty * item.value;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-white p-2 border border-slate-300 rounded shadow-xs"
                    >
                      <div className="min-w-[80px]">
                        <span className="text-xs font-bold text-slate-900 block">
                          {item.label}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-700">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustCount(item.key as keyof DenominationCounts, -1)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-400 rounded font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95"
                          title="Decrease by 1"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty === 0 ? '' : qty}
                          onChange={(e) => handleCountChange(item.key as keyof DenominationCounts, e.target.value)}
                          placeholder="0"
                          className="w-12 h-7 text-center font-mono font-bold text-slate-900 bg-slate-50 border border-slate-400 rounded focus:outline-none focus:bg-amber-50 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjustCount(item.key as keyof DenominationCounts, 1)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-400 rounded font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95"
                          title="Increase by 1"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustCount(item.key as keyof DenominationCounts, 5)}
                          className="w-7 h-7 bg-amber-100 hover:bg-amber-200 text-slate-900 border border-amber-400 rounded font-bold text-[10px] flex items-center justify-center cursor-pointer active:scale-95"
                          title="Add 5"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAB 3: TAPE & CARD SLIPS ADDER */
            <div className="space-y-3">
              <form onSubmit={handleAddTapeEntry} className="bg-white p-3 border border-slate-300 rounded shadow-xs space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Add Item or Slip Amount:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={tapeLabelInput}
                    onChange={(e) => setTapeLabelInput(e.target.value)}
                    placeholder="Label (e.g. Card Slip, Voucher)"
                    className="sm:col-span-1 border border-slate-400 rounded px-2.5 py-1 text-xs focus:outline-none focus:bg-amber-50"
                  />
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <div className="flex-1 relative flex items-center">
                      <span className="absolute left-2.5 text-slate-400 font-bold">£</span>
                      <input
                        type="text"
                        value={tapeInput}
                        onChange={(e) => setTapeInput(e.target.value)}
                        placeholder="0.00 (or type 45.20+12)"
                        className="w-full border border-slate-400 rounded pl-6 pr-2 py-1 text-sm font-mono font-bold focus:outline-none focus:bg-amber-50"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase px-3 py-1.5 rounded flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      Add
                    </button>
                  </div>
                </div>
              </form>

              {/* Tape List */}
              <div className="bg-white border border-slate-300 rounded p-2.5 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between border-b pb-1 text-xs font-bold text-slate-600">
                  <span>Slips Tape ({tapeEntries.length} items)</span>
                  {tapeEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearTape}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                {tapeEntries.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs italic">
                    No amounts added yet.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                    {tapeEntries.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between py-1 px-1 text-xs">
                        <span className="text-slate-800 font-medium truncate max-w-[200px]">
                          #{idx + 1} {item.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTapeEntry(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer & Direct Apply Button */}
        <div className="bg-white p-3 sm:p-4 border-t-2 border-slate-300 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between bg-slate-900 text-white px-3.5 py-2.5 rounded-lg border-2 border-slate-950">
            <div>
              <span className="text-xs text-slate-300 block">
                Calculated Value:
              </span>
              <span className="text-[11px] text-amber-400 font-bold">
                {tillName} &bull; {getTargetTitle(selectedTarget)}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-mono font-black text-amber-300">
              {formatCurrency(activeTotal)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={
                activeTab === 'standard'
                  ? handleClearAll
                  : activeTab === 'denominations'
                  ? handleResetCounts
                  : handleClearTape
              }
              className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:bg-slate-100 px-3 py-1.5 border border-slate-300 rounded cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset {activeTab === 'standard' ? 'Calc' : activeTab === 'denominations' ? 'Counts' : 'Tape'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  onApply(activeTotal, selectedTarget);
                  onClose();
                }}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-2 border-2 border-slate-950 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 text-black stroke-[3]" />
                Apply to {getTargetTitle(selectedTarget)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
