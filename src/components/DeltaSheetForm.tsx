import React, { useState } from "react";
import { SheetRecord, TillRowData } from "../types";
import {
  calculateGrandTotals,
  formatCurrency,
  formatToUKDate,
  getFinancialYear,
  getRowActualTotal,
  getRowExpectedTotal,
  getRowVariance,
  getYesterdayFloat,
  parseUKDateToISO,
} from "../utils/calculations";
import { exportDaySheetToPDF } from "../utils/pdfExport";
import { RecordAuditQrCode } from "./RecordAuditQrCode";
import {
  Calculator,
  Lock,
  Unlock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  User,
  Users,
  RefreshCw,
  Printer,
  Coins,
  FileText,
  Loader2,
  Calendar,
  Receipt,
  Undo2,
  Download,
} from "lucide-react";
import { CashCalculatorModal, TargetFieldType } from "./CashCalculatorModal";
import { OperatorModal } from "./OperatorModal";
import { DaySheetPrintModal } from "./DaySheetPrintModal";
import { ThermalReceiptModal } from "./ThermalReceiptModal";
import { DecimalInput } from "./DecimalInput";
import { GoToDateModal } from "./GoToDateModal";
import {
  FinancialYearSwitcher,
  FinancialYearFormat,
} from "./FinancialYearSwitcher";

interface DeltaSheetFormProps {
  record: SheetRecord;
  allRecords?: SheetRecord[];
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  onChangeRecord: (updated: SheetRecord) => void;
  onSaveRecord: () => void;
  onAddRecord: () => void;
  onDeleteRecord: () => void;
  onOpenWeeklyReport: () => void;
  onOpenMonthlyReport?: () => void;
  onExportExcel: () => void;
  onPrevRecord: () => void;
  onNextRecord: () => void;
  onOpenRecordsList: () => void;
  onGoToDate?: (date: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  operators: string[];
  onAddOperator: (name: string) => void;
  onDeleteOperator: (name: string) => void;
  onEditOperator?: (oldName: string, newName: string) => void;
  onRecalculatePageValues?: () => void;
  onBackupJSON?: () => void;
}

export const DeltaSheetForm: React.FC<DeltaSheetFormProps> = ({
  record,
  allRecords = [],
  selectedYear = "all",
  onSelectYear,
  financialYearFormat = "calendar",
  onChangeFinancialYearFormat,
  onChangeRecord,
  onSaveRecord,
  onAddRecord,
  onDeleteRecord,
  onOpenWeeklyReport,
  onOpenMonthlyReport,
  onExportExcel,
  onPrevRecord,
  onNextRecord,
  onOpenRecordsList,
  onGoToDate,
  onUndo,
  canUndo = false,
  operators = [],
  onAddOperator,
  onDeleteOperator,
  onEditOperator,
  onRecalculatePageValues,
  onBackupJSON,
}) => {
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [selectedTillIndex, setSelectedTillIndex] = useState<number | null>(
    null,
  );
  const [calcTargetField, setCalcTargetField] =
    useState<TargetFieldType>("col4BankingCash");
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">(
    "cards",
  );
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isGoToDateModalOpen, setIsGoToDateModalOpen] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportDaySheetToPDF(record, allRecords);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const isLocked = record.isSaved;

  const handleDateChange = (val: string) => {
    // If entered as DD/MM/YYYY or YYYY-MM-DD
    let iso = val;
    if (val.includes("/")) {
      iso = parseUKDateToISO(val);
    }
    onChangeRecord({
      ...record,
      date: iso,
    });
  };

  const handleRowValueChange = (
    index: number,
    field: keyof TillRowData,
    valStr: string,
  ) => {
    if (isLocked) return;
    const num = parseFloat(valStr);
    const val = isNaN(num) ? 0 : num;

    const updatedRows = [...record.rows];
    if (field === "col2ExpectedCard") {
      updatedRows[index] = {
        ...updatedRows[index],
        col2ExpectedCard: val,
        col6ActualCard: val, // Cell 6 automatically equals Cell 2
      };
    } else if (field === "col6ActualCard") {
      updatedRows[index] = {
        ...updatedRows[index],
        col6ActualCard: val,
        col2ExpectedCard: val, // Cell 2 automatically equals Cell 6
      };
    } else {
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: val,
      };
    }

    onChangeRecord({
      ...record,
      rows: updatedRows,
    });
  };

  const handleRowNumericChange = (
    index: number,
    field: keyof TillRowData,
    numVal: number,
  ) => {
    if (isLocked) return;
    const updatedRows = [...record.rows];
    if (field === "col2ExpectedCard") {
      updatedRows[index] = {
        ...updatedRows[index],
        col2ExpectedCard: numVal,
        col6ActualCard: numVal,
      };
    } else if (field === "col6ActualCard") {
      updatedRows[index] = {
        ...updatedRows[index],
        col6ActualCard: numVal,
        col2ExpectedCard: numVal,
      };
    } else {
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: numVal,
      };
    }

    onChangeRecord({
      ...record,
      rows: updatedRows,
    });
  };

  const handleOpenCalcForField = (
    index: number,
    field: TargetFieldType = "col4BankingCash",
  ) => {
    setSelectedTillIndex(index);
    setCalcTargetField(field);
    setCalcModalOpen(true);
  };

  const handleOpenCalcForTill = (index: number) => {
    handleOpenCalcForField(index, "col4BankingCash");
  };

  const handleApplyCalc = (amount: number, targetField: TargetFieldType) => {
    if (selectedTillIndex === null || isLocked) return;
    const updatedRows = [...record.rows];
    const roundedAmount = Number(amount.toFixed(2));

    if (targetField === "col1ExpectedCash") {
      updatedRows[selectedTillIndex].col1ExpectedCash = roundedAmount;
    } else if (targetField === "col2ExpectedCard") {
      updatedRows[selectedTillIndex].col2ExpectedCard = roundedAmount;
      updatedRows[selectedTillIndex].col6ActualCard = roundedAmount; // Col 6 syncs with Col 2
    } else if (targetField === "col4BankingCash") {
      updatedRows[selectedTillIndex].col4BankingCash = roundedAmount;
    } else if (targetField === "col5FloatCash") {
      updatedRows[selectedTillIndex].col5FloatCash = roundedAmount;
    }

    onChangeRecord({
      ...record,
      rows: updatedRows,
    });
  };

  const toggleLock = () => {
    onChangeRecord({
      ...record,
      isSaved: !record.isSaved,
    });
  };

  return (
    <div className="w-full bg-[#b4c5d8] min-h-[calc(100vh-4rem)] p-1 sm:p-3 lg:p-4 text-slate-800 font-sans flex flex-col items-stretch select-none shadow-inner">
      {/* Container simulating Delta Access Form */}
      <div className="w-full max-w-full bg-[#b4c5d8] rounded-md p-1 sm:p-2">
        {/* Automatic Print Summary Header */}
        <div className="hidden print:block print-summary-header">
          <div className="print-summary-header-top">
            <div>
              <div className="print-summary-brand">Retail Operations • Till Cashing &amp; Reconciliation</div>
              <h1 className="print-summary-title">Daily Till Cashing Sheet</h1>
              <div className="print-summary-subtitle">Official Daily Cash Register Audit, Float Verification &amp; Card Settlement</div>
            </div>
            <div className="print-summary-meta-box">
              <div className="print-summary-badge">Financial Year: {getFinancialYear(record.date, financialYearFormat)}</div>
              <div className="text-[7.5pt] font-mono text-zinc-700 mt-1">
                Record ID: <strong>{record.id}</strong> | Status: <strong>{record.isSaved ? "LOCKED AUDIT" : "ACTIVE"}</strong>
              </div>
            </div>
          </div>
          <div className="print-summary-details-grid">
            <div className="print-summary-detail-item">
              <span className="print-summary-detail-label">Trading Date</span>
              <span className="print-summary-detail-value">{formatToUKDate(record.date)}</span>
            </div>
            <div className="print-summary-detail-item">
              <span className="print-summary-detail-label">Cashier / Operator</span>
              <span className="print-summary-detail-value">{record.operator || "Unassigned Staff"}</span>
            </div>
            <div className="print-summary-detail-item">
              <span className="print-summary-detail-label">Registers / Tills</span>
              <span className="print-summary-detail-value">{record.rows.length} Tills Active</span>
            </div>
            <div className="print-summary-detail-item">
              <span className="print-summary-detail-label">Generated / Printed</span>
              <span className="print-summary-detail-value">{new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>

        {/* Compact Single-Row Date, Operator & Actions Toolbar */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 mb-2 sm:mb-3 bg-[#cbd7e6] p-1.5 sm:p-2 rounded-lg border border-slate-400">
          {/* Left Group: Date & Operator */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Date Input */}
            <div className="flex items-center gap-1.5">
              <span className="bg-slate-800 text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded font-black border border-slate-600 shadow-xs">
                A
              </span>
              <span className="text-[#334155] font-bold text-xs sm:text-sm">Date:</span>
              <div className="bg-[#eef5cd] border border-slate-400 px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                <input
                  type="date"
                  disabled={isLocked}
                  value={record.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-transparent font-bold text-[#4d7328] text-xs sm:text-sm focus:outline-none disabled:opacity-80 cursor-pointer"
                />
                <span
                  className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-slate-900 text-amber-300 rounded border border-slate-700 shadow-xs"
                  title="Financial Year for this record date"
                >
                  {getFinancialYear(record.date, financialYearFormat)}
                </span>
              </div>
            </div>

            {/* Operator Select & Staff Button */}
            <div className="flex items-center gap-1.5 bg-white/90 border border-slate-400 px-2 py-0.5 rounded shadow-xs">
              <User className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <span className="text-slate-800 font-bold text-xs whitespace-nowrap hidden sm:inline">
                Operator:
              </span>
              <select
                disabled={isLocked}
                value={record.operator || ""}
                onChange={(e) => {
                  if (e.target.value === "__MANAGE_OPERATORS__") {
                    setIsOperatorModalOpen(true);
                  } else {
                    onChangeRecord({ ...record, operator: e.target.value });
                  }
                }}
                className="bg-transparent font-bold text-slate-900 text-xs focus:outline-none cursor-pointer disabled:opacity-80 max-w-[130px] truncate"
              >
                <option value="">-- Operator --</option>
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
                <option
                  value="__MANAGE_OPERATORS__"
                  className="font-bold text-amber-900 bg-amber-100"
                >
                  ⚙️ Manage...
                </option>
              </select>

              <button
                type="button"
                onClick={() => setIsOperatorModalOpen(true)}
                className="flex items-center gap-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] px-1.5 py-0.5 rounded border border-slate-600 cursor-pointer transition-colors shrink-0"
                title="Edit staff roster and operators list"
              >
                <Users className="w-2.5 h-2.5 text-amber-400" />
                Staff
              </button>
            </div>
          </div>

          {/* Right Group: Action Buttons in a Tidy Unified Bar */}
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 ml-auto">
            {/* Recalculate Page Values */}
            {onRecalculatePageValues && (
              <button
                onClick={onRecalculatePageValues}
                className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-2 py-1 rounded border border-slate-800 shadow-xs cursor-pointer active:scale-95 transition-all"
                title="Recalculate all row totals and page variances"
              >
                <RefreshCw className="w-3 h-3 text-slate-950" />
                <span>Recalc</span>
              </button>
            )}

            {/* Desktop Calculator */}
            <button
              onClick={() => {
                setSelectedTillIndex(0);
                setCalcTargetField("col1ExpectedCash");
                setCalcModalOpen(true);
              }}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-2 py-1 rounded border border-slate-800 shadow-xs cursor-pointer active:scale-95 transition-all"
              title="Open Desktop Till Calculator"
            >
              <Calculator className="w-3 h-3 text-slate-950" />
              <span>Calc</span>
            </button>

            {/* Print & Export Segmented Group */}
            <div className="flex items-center bg-slate-900 rounded border border-slate-700 p-0.5 shadow-xs">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-amber-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Print full daily cashing sheet"
              >
                <Printer className="w-3 h-3 text-amber-400" />
                <span>Print</span>
              </button>
              <span className="w-px h-3.5 bg-slate-700" />
              <button
                type="button"
                onClick={() => setIsThermalModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-amber-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Print-friendly slip for thermal POS printer"
              >
                <Receipt className="w-3 h-3 text-amber-400" />
                <span>Slip</span>
              </button>
              <span className="w-px h-3.5 bg-slate-700" />
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Export current day sheet to PDF"
              >
                {isExportingPDF ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                ) : (
                  <FileText className="w-3 h-3 text-emerald-400" />
                )}
                <span>PDF</span>
              </button>
            </div>

            {/* Quick Backup Button */}
            {onBackupJSON && (
              <button
                type="button"
                onClick={onBackupJSON}
                className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-2 py-1 rounded border border-emerald-950 shadow-xs cursor-pointer active:scale-95 transition-all"
                title="Quick backup to JSON file"
              >
                <Download className="w-3 h-3 text-white shrink-0" />
                <span>Backup</span>
              </button>
            )}

            {/* Mobile Cards / Table Switcher (Visible on mobile screens) */}
            <div className="flex md:hidden items-center bg-slate-800 p-0.5 rounded border border-slate-700 text-xs">
              <button
                onClick={() => setMobileViewMode("cards")}
                className={`px-2 py-0.5 rounded font-bold uppercase transition-all cursor-pointer ${
                  mobileViewMode === "cards"
                    ? "bg-amber-400 text-black shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                📱 Cards
              </button>
              <button
                onClick={() => setMobileViewMode("table")}
                className={`px-2 py-0.5 rounded font-bold uppercase transition-all cursor-pointer ${
                  mobileViewMode === "table"
                    ? "bg-amber-400 text-black shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                📊 Table
              </button>
            </div>

            {/* Status indicator (Locked/Editable) */}
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded font-bold border ${
              isLocked 
                ? "bg-amber-100/95 border-amber-400 text-amber-900" 
                : "bg-white/90 border-slate-300 text-slate-700"
            }`}>
              {isLocked ? (
                <>
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 text-emerald-600" />
                  <span>Editable</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MOBILE CARDS VIEW (Visible when mobileViewMode === 'cards' on small screens) */}
        {/* ========================================================= */}
        <div
          className={`${mobileViewMode === "cards" ? "block md:hidden" : "hidden"} space-y-4 mb-6`}
        >
          {record.rows.map((row, idx) => {
            if (row.isYard) {
              const yardVar = row.customVariance || 0;
              return (
                <div
                  key={row.id || idx}
                  className="bg-slate-800 text-white p-3.5 rounded-lg border-2 border-slate-900 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-400 text-slate-950 font-mono text-xs px-2 py-0.5 rounded font-black border border-amber-500 shadow-xs">
                        K
                      </span>
                      <h3 className="font-black text-lg text-amber-300 tracking-wide">
                        {row.name}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded border border-slate-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Variance (Difference):
                    </span>
                    <div className="bg-white text-slate-900 rounded border border-slate-400 px-3 py-1 text-right font-bold text-base min-w-[120px]">
                      {isLocked ? (
                        formatCurrency(yardVar)
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          value={yardVar === 0 ? "" : yardVar}
                          onChange={(e) =>
                            handleRowValueChange(
                              idx,
                              "customVariance",
                              e.target.value,
                            )
                          }
                          placeholder="0.00"
                          className="w-full text-right font-mono font-bold bg-transparent text-slate-900 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const expTotal = getRowExpectedTotal(row);
            const actTotal = getRowActualTotal(row);
            const variance = getRowVariance(row, record, allRecords);

            return (
              <div
                key={row.id || idx}
                className="bg-slate-800 text-white p-3.5 rounded-lg border-2 border-slate-900 shadow-md space-y-3"
              >
                {/* Register Card Header */}
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 font-mono text-xs px-2 py-0.5 rounded font-black border border-amber-500 shadow-xs">
                      K
                    </span>
                    <h3 className="font-black text-lg text-amber-300 tracking-wide">
                      {row.name}
                    </h3>
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => handleOpenCalcForTill(idx)}
                      className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-2.5 py-1 rounded shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      Cash Calc
                    </button>
                  )}
                </div>

                {/* System Expected Sales Section */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-700 space-y-2">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    <span>1. System Expected Totals</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Col 1 B: Sys Cash */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-300 font-bold">
                          <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded mr-1">
                            B
                          </span>
                          Sys Cash (1)
                        </label>
                        <span
                          className="text-[9px] font-mono font-bold text-amber-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded select-none pointer-events-none"
                          title="Protected field: Yesterday's Float"
                        >
                          Yest: £
                          {getYesterdayFloat(row, record, allRecords).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="bg-white text-slate-900 rounded border border-slate-400 px-2 py-1.5 flex items-center font-bold flex-1 shadow-inner">
                          <span className="text-slate-500 mr-1 text-xs">£</span>
                          <DecimalInput
                            disabled={isLocked}
                            value={row.col1ExpectedCash}
                            onChange={(val) =>
                              handleRowNumericChange(
                                idx,
                                "col1ExpectedCash",
                                val,
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono font-bold text-base focus:outline-none disabled:bg-transparent"
                          />
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col1ExpectedCash")
                            }
                            title="Open Calculator for Sys Cash (1)"
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-2 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Col 2 C: Sys Card */}
                    <div>
                      <label className="text-[11px] text-slate-300 font-bold block mb-1">
                        <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded mr-1">
                          C
                        </span>
                        Sys Card (2)
                      </label>
                      <div className="flex items-center gap-1">
                        <div className="bg-white text-slate-900 rounded border border-slate-400 px-2 py-1.5 flex items-center font-bold flex-1 shadow-inner">
                          <span className="text-slate-500 mr-1 text-xs">£</span>
                          <DecimalInput
                            disabled={isLocked}
                            value={row.col2ExpectedCard}
                            onChange={(val) =>
                              handleRowNumericChange(
                                idx,
                                "col2ExpectedCard",
                                val,
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono font-bold text-base focus:outline-none disabled:bg-transparent"
                          />
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col2ExpectedCard")
                            }
                            title="Open Slips Adder / Calculator for Sys Card (2)"
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-2 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Col 3 D: Sys Total */}
                  <div className="bg-amber-400/10 border border-amber-500/40 p-2 rounded flex items-center justify-between text-xs font-bold text-amber-300">
                    <span className="flex items-center gap-1">
                      <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded font-black">
                        D
                      </span>
                      Sys Total (3):
                    </span>
                    <span className="font-mono text-base font-black text-amber-400">
                      {formatCurrency(expTotal)}
                    </span>
                  </div>
                </div>

                {/* Counted Actual Cashing Up Section */}
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-700 space-y-2">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <span>2. Physical Counted Cashing</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Col 4 E: Banking */}
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 truncate">
                        <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded mr-1">
                          E
                        </span>
                        Banking (4)
                      </label>
                      <div className="flex items-center gap-1">
                        <div className="bg-white text-slate-900 rounded border border-slate-400 px-1.5 py-1.5 flex items-center font-bold flex-1 shadow-inner">
                          <span className="text-slate-500 text-xs">£</span>
                          <DecimalInput
                            disabled={isLocked}
                            value={row.col4BankingCash}
                            onChange={(val) =>
                              handleRowNumericChange(
                                idx,
                                "col4BankingCash",
                                val,
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono font-bold text-sm focus:outline-none disabled:bg-transparent"
                          />
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col4BankingCash")
                            }
                            title="Count Cash for Banking (4)"
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-1.5 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Col 5 F: Float */}
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 truncate">
                        <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded mr-1">
                          F
                        </span>
                        Float (5)
                      </label>
                      <div className="flex items-center gap-1">
                        <div className="bg-white text-slate-900 rounded border border-slate-400 px-1.5 py-1.5 flex items-center font-bold flex-1 shadow-inner">
                          <span className="text-slate-500 text-xs">£</span>
                          <DecimalInput
                            disabled={isLocked}
                            value={row.col5FloatCash}
                            onChange={(val) =>
                              handleRowNumericChange(idx, "col5FloatCash", val)
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono font-bold text-sm focus:outline-none disabled:bg-transparent"
                          />
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col5FloatCash")
                            }
                            title="Count Cash for Float (5)"
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-1.5 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Col 6 G: Card PDQ */}
                    <div>
                      <label className="text-[10px] text-slate-300 font-bold block mb-1 truncate">
                        <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded mr-1">
                          G
                        </span>
                        Card PDQ (6)
                      </label>
                      <div className="bg-slate-200 text-slate-900 rounded border border-slate-400 px-1.5 py-1.5 flex items-center font-bold">
                        <span className="text-slate-500 text-xs">£</span>
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col6ActualCard}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col6ActualCard", val)
                          }
                          placeholder="0.00"
                          className="w-full text-right font-mono font-bold text-sm focus:outline-none disabled:bg-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Col 7 H: Count Total */}
                  <div className="bg-emerald-500/10 border border-emerald-500/40 p-2 rounded flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span className="flex items-center gap-1">
                      <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1 py-0.5 rounded font-black">
                        H
                      </span>
                      Counted Total (7):
                    </span>
                    <span className="font-mono text-base font-black text-emerald-400">
                      {formatCurrency(actTotal)}
                    </span>
                  </div>
                </div>

                {/* Variance Section */}
                <div
                  className={`p-2.5 rounded border-2 flex items-center justify-between ${
                    variance < 0
                      ? "bg-rose-950/80 border-rose-600 text-rose-200"
                      : variance > 0
                        ? "bg-emerald-950/80 border-emerald-600 text-emerald-200"
                        : "bg-slate-900 border-slate-700 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="bg-amber-400 text-slate-950 font-mono text-[10px] px-1.5 py-0.5 rounded font-black">
                      I
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Variance (8):
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${
                        variance < 0
                          ? "bg-rose-600"
                          : variance > 0
                            ? "bg-emerald-600"
                            : "bg-slate-700"
                      }`}
                    >
                      {variance < 0 ? (
                        <>
                          <TrendingDown className="w-3 h-3" /> Short
                        </>
                      ) : variance > 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3" /> Over
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Balanced
                        </>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-lg font-black">
                    {formatCurrency(variance, true)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* DESKTOP/TABLE VIEW GRID (Full width responsive layout) */}
        {/* ========================================================= */}
        <div
          className={`${mobileViewMode === "table" ? "block" : "hidden md:block"} w-full overflow-x-auto pb-3`}
        >
          <div className="w-fit min-w-full">
            {/* Column Reference Header Bar with Letter Identifiers [B] to [I] */}
            <div className="flex items-center gap-1.5 lg:gap-2 mb-2 text-slate-800 font-bold text-xs">
              <div className="w-20 shrink-0 text-slate-700 font-black tracking-wider uppercase text-[11px] px-1">
                Register
              </div>

              {/* Col 1 */}
              <div className="w-32 sm:w-36 md:w-40 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  B
                </span>
                <span className="truncate font-black text-[11px]">
                  Sys Cash (1)
                </span>
              </div>
              {/* Col 2 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  C
                </span>
                <span className="truncate font-black text-[11px]">
                  Sys Card (2)
                </span>
              </div>
              {/* Col 3 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-900 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-500">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  D
                </span>
                <span className="truncate font-black text-xs">
                  Sys Total (3)
                </span>
              </div>

              {/* Separator Divider */}
              <div className="w-1 mx-0.5 shrink-0" />

              {/* Col 4 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  E
                </span>
                <span className="truncate font-black text-xs">Banking (4)</span>
              </div>
              {/* Col 5 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  F
                </span>
                <span className="truncate font-black text-xs">
                  Float Cash (5)
                </span>
              </div>
              {/* Col 6 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  G
                </span>
                <span className="truncate font-black text-xs">
                  Card PDQ (6)
                </span>
              </div>
              {/* Col 7 */}
              <div className="w-28 sm:w-32 shrink-0 text-center bg-slate-900 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-500">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  H
                </span>
                <span className="truncate font-black text-xs">
                  Count Total (7)
                </span>
              </div>
              {/* Col 8 */}
              <div className="w-28 sm:w-32 md:w-36 shrink-0 text-center bg-slate-800 text-white rounded py-1 px-1 flex items-center justify-center gap-1 shadow-xs border border-slate-600">
                <span className="bg-amber-400 text-slate-950 font-mono font-black text-[10px] px-1 rounded shrink-0">
                  I
                </span>
                <span className="truncate font-black text-[11px] sm:text-xs">
                  Variance (8)
                </span>
              </div>
            </div>

            {/* Tills Table Area */}
            <div className="space-y-3 mb-6">
              {record.rows.map((row, idx) => {
                if (row.isYard) {
                  // YARD Special Row
                  return (
                    <div
                      key={row.id || idx}
                      className="flex items-center justify-between py-1.5"
                    >
                      <div className="w-24 flex items-center gap-1.5">
                        <span className="bg-slate-800 text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded font-black border border-slate-600 shadow-xs">
                          K
                        </span>
                        <span className="text-white font-black text-xl tracking-wider drop-shadow-xs">
                          {row.name}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Normal Till Rows (Till 1, Till 2, Till 3, Till 4, Till 5)
                const expTotal = getRowExpectedTotal(row);
                const actTotal = getRowActualTotal(row);
                const variance = getRowVariance(row, record, allRecords);

                return (
                  <div
                    key={row.id || idx}
                    className="flex items-center gap-1.5 lg:gap-2 py-1"
                  >
                    {/* Till Title */}
                    <div className="w-20 shrink-0 flex items-center justify-between">
                      <span className="text-white font-black text-xl sm:text-2xl drop-shadow-xs tracking-tight">
                        {row.name}
                      </span>
                    </div>

                    {/* Col 1: System Cash */}
                    <div className="w-32 sm:w-36 md:w-40 shrink-0 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <div className="bg-white border-2 border-slate-400 rounded px-1.5 sm:px-2 py-0.5 shadow-inner flex items-center flex-1 min-w-0">
                          <span className="text-slate-500 font-bold mr-0.5 text-xs sm:text-sm">
                            £
                          </span>
                          <DecimalInput
                            disabled={isLocked}
                            value={row.col1ExpectedCash}
                            onChange={(val) =>
                              handleRowNumericChange(
                                idx,
                                "col1ExpectedCash",
                                val,
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-black text-[#1e293b] text-sm sm:text-base lg:text-lg focus:outline-none disabled:bg-transparent min-w-0"
                          />
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col1ExpectedCash")
                            }
                            title="Open Calculator for Sys Cash (1)"
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-1 sm:p-1.5 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Small protected Yesterday's Float badge */}
                      <div
                        className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-center font-mono text-[9px] shadow-xs select-none pointer-events-none truncate"
                        title="Protected field: Yesterday's Float (5)"
                      >
                        <span className="text-[8px] text-slate-400 font-sans font-extrabold uppercase mr-1">
                          Yest Float:
                        </span>
                        <span className="font-bold text-amber-300">
                          £
                          {getYesterdayFloat(row, record, allRecords).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Col 2: System Card */}
                    <div className="flex items-center gap-1 w-28 sm:w-32 shrink-0">
                      <div className="bg-white border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 flex-1 min-w-0 shadow-inner flex items-center">
                        <span className="text-slate-500 font-bold mr-0.5 text-xs sm:text-sm">
                          £
                        </span>
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col2ExpectedCard}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col2ExpectedCard", val)
                          }
                          placeholder="0.00"
                          className="w-full text-right font-black text-[#1e293b] text-sm sm:text-base lg:text-lg focus:outline-none disabled:bg-transparent min-w-0"
                        />
                      </div>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col2ExpectedCard")
                          }
                          title="Open Slips Adder / Calculator for Sys Card (2)"
                          className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-0.5 sm:p-1 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                        >
                          <Calculator className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Col 3: System Total (Calculated) */}
                    <div className="bg-[#dcdcdc] border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 w-28 sm:w-32 shrink-0 shadow-xs text-right font-black text-slate-800 text-sm sm:text-base lg:text-lg truncate">
                      {formatCurrency(expTotal)}
                    </div>

                    {/* Vertical Separator Divider */}
                    <div className="h-10 w-1 bg-black mx-0.5 rounded-full shrink-0 shadow-xs" />

                    {/* Col 4: Banking Cash */}
                    <div className="flex items-center gap-1 w-28 sm:w-32 shrink-0">
                      <div className="bg-white border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 flex-1 min-w-0 shadow-inner flex items-center">
                        <span className="text-slate-500 font-bold mr-0.5 text-xs sm:text-sm">
                          £
                        </span>
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col4BankingCash}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col4BankingCash", val)
                          }
                          placeholder="0.00"
                          className="w-full text-right font-black text-[#1e293b] text-sm sm:text-base lg:text-lg focus:outline-none disabled:bg-transparent min-w-0"
                        />
                      </div>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col4BankingCash")
                          }
                          title="Count Cash for Banking (4)"
                          className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-0.5 sm:p-1 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                        >
                          <Calculator className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Col 5: Float Cash */}
                    <div className="flex items-center gap-1 w-28 sm:w-32 shrink-0">
                      <div className="bg-white border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 flex-1 min-w-0 shadow-inner flex items-center">
                        <span className="text-slate-500 font-bold mr-0.5 text-xs sm:text-sm">
                          £
                        </span>
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col5FloatCash}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col5FloatCash", val)
                          }
                          placeholder="0.00"
                          className="w-full text-right font-black text-[#1e293b] text-sm sm:text-base lg:text-lg focus:outline-none disabled:bg-transparent min-w-0"
                        />
                      </div>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col5FloatCash")
                          }
                          title="Count Cash for Float (5)"
                          className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-0.5 sm:p-1 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                        >
                          <Calculator className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Col 6: Actual Card */}
                    <div className="bg-[#dcdcdc] border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 w-28 sm:w-32 shrink-0 shadow-inner flex items-center">
                      <span className="text-slate-500 font-bold mr-0.5 text-xs sm:text-sm">
                        £
                      </span>
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col6ActualCard}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col6ActualCard", val)
                        }
                        placeholder="0.00"
                        className="w-full text-right font-black text-[#1e293b] text-sm sm:text-base lg:text-lg focus:outline-none disabled:bg-transparent min-w-0"
                      />
                    </div>

                    {/* Col 7: Actual Total (Calculated) */}
                    <div className="bg-[#dcdcdc] border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 w-28 sm:w-32 shrink-0 shadow-xs text-right font-black text-slate-800 text-sm sm:text-base lg:text-lg truncate">
                      {formatCurrency(actTotal)}
                    </div>

                    {/* Col 8: Variance Difference */}
                    <div
                      className={`border-2 border-slate-400 rounded px-1.5 sm:px-2 py-1 w-28 sm:w-32 md:w-36 shrink-0 shadow-xs text-right font-black text-xs sm:text-sm flex items-center justify-between gap-1 ${
                        variance < 0
                          ? "bg-[#eef5cd] text-red-600"
                          : variance > 0
                            ? "bg-[#eef5cd] text-slate-900"
                            : "bg-white text-slate-900"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-tight text-white shrink-0 ${
                          variance < 0
                            ? "bg-red-600"
                            : variance > 0
                              ? "bg-emerald-600"
                              : "bg-slate-600"
                        }`}
                      >
                        {variance < 0 ? (
                          <>
                            <TrendingDown className="w-2.5 h-2.5 shrink-0" />{" "}
                            Short
                          </>
                        ) : variance > 0 ? (
                          <>
                            <TrendingUp className="w-2.5 h-2.5 shrink-0" /> Over
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> Ok
                          </>
                        )}
                      </span>
                      <span className="font-mono font-black text-xs sm:text-sm lg:text-base whitespace-nowrap overflow-visible tabular-nums shrink-0 text-right">
                        {formatCurrency(variance, true)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Column Totals Row */}
            <div className="pt-3 border-t-4 border-slate-900 mb-8">
              <div className="flex items-center gap-1.5 lg:gap-2">
                <div className="w-20 shrink-0 bg-black text-amber-300 font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 border-black rounded py-1.5 shadow-sm text-center flex items-center justify-center">
                  DAY TOTALS
                </div>

                {/* Left Totals */}
                <div className="bg-white border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-32 sm:w-36 md:w-40 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol1Cash)}
                </div>
                <div className="bg-white border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol2Card)}
                </div>
                <div className="bg-amber-100 border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol3Expected)}
                </div>

                {/* Gap for divider */}
                <div className="w-1 mx-0.5 shrink-0" />

                {/* Right Totals */}
                <div className="bg-white border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol4Banking)}
                </div>
                <div className="bg-white border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol5Float)}
                </div>
                <div className="bg-white border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol6Card)}
                </div>
                <div className="bg-amber-100 border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 shrink-0 text-right font-black text-slate-900 text-xs sm:text-sm lg:text-base font-mono shadow-xs truncate">
                  {formatCurrency(totals.totalCol7Actual)}
                </div>
                {/* Col 8 Variance Total Box */}
                <div
                  data-total-variance="true"
                  className={`border-2 border-slate-900 rounded px-1.5 sm:px-2 py-1.5 w-28 sm:w-32 md:w-36 shrink-0 text-right font-black text-xs sm:text-sm flex items-center justify-between gap-1 shadow-xs total-variance-highlight ${
                    totals.totalVariance < 0
                      ? "bg-rose-100 text-rose-950 border-rose-900"
                      : totals.totalVariance > 0
                        ? "bg-emerald-100 text-emerald-950 border-emerald-900"
                        : "bg-white text-slate-900 border-slate-900"
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-tight text-white shrink-0 ${
                      totals.totalVariance < 0
                        ? "bg-rose-700"
                        : totals.totalVariance > 0
                          ? "bg-emerald-700"
                          : "bg-slate-700"
                    }`}
                  >
                    {totals.totalVariance < 0 ? (
                      <>
                        <TrendingDown className="w-2.5 h-2.5 shrink-0" /> Short
                      </>
                    ) : totals.totalVariance > 0 ? (
                      <>
                        <TrendingUp className="w-2.5 h-2.5 shrink-0" /> Over
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />{" "}
                        Balanced
                      </>
                    )}
                  </span>
                  <span className="font-mono font-black text-xs sm:text-sm lg:text-base whitespace-nowrap overflow-visible tabular-nums shrink-0 text-right">
                    {formatCurrency(totals.totalVariance, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* End-of-Day Notes & Shift Handover */}
        <div className="mt-4 bg-[#e6e6e6] border-2 border-slate-400 p-3.5 rounded-md shadow-inner flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5 flex items-center gap-1.5">
              End-of-Day Notes & Shift Handover Comments:
            </label>
            <textarea
              disabled={isLocked}
              value={record.notes || ""}
              onChange={(e) =>
                onChangeRecord({ ...record, notes: e.target.value })
              }
              placeholder="Enter shift notes, handover comments, staff on duty, or explanations for variances..."
              className="w-full h-20 p-2.5 bg-white border-2 border-slate-400 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 disabled:bg-slate-200 disabled:text-slate-600"
            />
          </div>
          <div className="shrink-0 flex flex-col items-center justify-center p-2 bg-white border-2 border-slate-400 rounded">
            <RecordAuditQrCode
              record={record}
              totals={totals}
              size={68}
              showCaption={true}
              className="border-none shadow-none bg-transparent"
            />
          </div>
        </div>

        {/* Action Controls & Till Difference Summary */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mt-4">
          {/* Action Buttons Stack */}
          <div
            className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 print:hidden"
            data-print-hide="true"
          >
            {/* Recalculate Page Values Button */}
            {onRecalculatePageValues && (
              <button
                onClick={onRecalculatePageValues}
                className="col-span-2 sm:col-span-1 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm px-4 py-2.5 rounded-md border-2 border-slate-900 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Recalculate all formulas and totals on this sheet"
              >
                <RefreshCw className="w-4 h-4 text-black" />
                Recalculate Sheet Values
              </button>
            )}

            {/* Save Sheet Button */}
            <button
              onClick={onSaveRecord}
              className="col-span-2 sm:col-span-1 bg-gradient-to-b from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-black text-sm px-4 py-2.5 rounded-md border-2 border-red-900 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              Save Sheet
            </button>

            {/* Undo Changes Button */}
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`col-span-2 sm:col-span-1 font-black text-xs sm:text-sm px-3.5 py-2.5 rounded-md border-2 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                canUndo
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-500"
                  : "bg-slate-100 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed"
              }`}
              title={
                canUndo
                  ? "Undo recent changes on this sheet (Ctrl+Z)"
                  : "No changes to undo"
              }
            >
              <Undo2 className="w-4 h-4 text-slate-800 shrink-0" />
              <span>Undo Changes</span>
            </button>

            {/* Lock / Unlock Toggle Button */}
            <button
              type="button"
              onClick={toggleLock}
              className={`col-span-2 sm:col-span-1 font-black text-xs sm:text-sm px-3.5 py-2.5 rounded-md border-2 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isLocked
                  ? "bg-amber-400 hover:bg-amber-300 text-black border-slate-900"
                  : "bg-white hover:bg-emerald-50 text-slate-900 border-slate-400"
              }`}
              title={
                isLocked
                  ? "Sheet is Locked. Click to Unlock for edits."
                  : "Sheet is Unlocked. Click to Lock and prevent edits."
              }
            >
              {isLocked ? (
                <>
                  <Lock className="w-4 h-4 text-black shrink-0" />
                  <span>Locked (Unlock)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlocked (Lock)</span>
                </>
              )}
            </button>

            {/* Date Goto Button */}
            <button
              type="button"
              onClick={() => setIsGoToDateModalOpen(true)}
              className="col-span-2 sm:col-span-1 bg-black hover:bg-zinc-800 text-amber-400 font-black text-xs sm:text-sm px-3.5 py-2.5 rounded-md border-2 border-amber-400 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Jump directly to any date sheet or select from calendar"
            >
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Go to Date</span>
            </button>

            {/* Add Record Button */}
            <button
              onClick={onAddRecord}
              className="bg-gradient-to-b from-pink-100 to-pink-200 hover:bg-pink-300 text-slate-900 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-md border-2 border-pink-300 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Add Record
            </button>

            {/* Delete Record */}
            <button
              onClick={onDeleteRecord}
              className="bg-[#9cd4f8] hover:bg-[#82c8f6] text-slate-900 font-bold text-xs px-3 py-2 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Delete Record
            </button>

            {/* Close Form / View Records */}
            <button
              onClick={onOpenRecordsList}
              className="bg-[#80d0ff] hover:bg-[#68c5ff] text-slate-900 font-bold text-xs px-3 py-2 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Close Form
            </button>

            {/* Weekly Report */}
            <button
              onClick={onOpenWeeklyReport}
              className="bg-[#9cd4f8] hover:bg-[#82c8f6] text-slate-900 font-bold text-xs px-3 py-2 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Weekly Report
            </button>

            {/* Monthly Report with Date Range */}
            {onOpenMonthlyReport && (
              <button
                onClick={onOpenMonthlyReport}
                className="bg-[#80d0ff] hover:bg-[#68c5ff] text-slate-900 font-extrabold text-xs px-3 py-2 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
                title="Open Monthly Report with Custom Date Range"
              >
                Monthly Report
              </button>
            )}

            {/* Print Day Page */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="bg-black hover:bg-zinc-800 text-amber-400 font-extrabold text-xs px-3 py-2 rounded border-2 border-amber-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Day Page
            </button>

            {/* Print-Friendly Thermal View */}
            <button
              type="button"
              onClick={() => setIsThermalModalOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-3 py-2 rounded border-2 border-slate-900 shadow-xs active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1"
              title="Print-Friendly View for thermal POS slip output"
            >
              <Receipt className="w-3.5 h-3.5" />
              Print-Friendly View
            </button>

            {/* Weekly Excel Sheets */}
            <button
              onClick={onExportExcel}
              className="col-span-2 sm:col-span-1 bg-[#b3f2b3] hover:bg-[#9ee89e] text-slate-900 font-bold text-xs px-3 py-2 rounded border border-green-500 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Export CSV
            </button>

            {/* Backup Button (Green) */}
            {onBackupJSON && (
              <button
                type="button"
                onClick={onBackupJSON}
                className="col-span-2 sm:col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3 py-2 rounded border-2 border-emerald-950 shadow-xs active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                title="Backup all daily records & staff data immediately to JSON file"
              >
                <Download className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Backup Data</span>
              </button>
            )}

            {/* Navigation Arrows */}
            <div className="flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1">
              <button
                onClick={onPrevRecord}
                title="Previous Day Sheet"
                className="flex-1 sm:flex-none bg-[#80d0ff] hover:bg-[#68c5ff] text-slate-900 font-bold px-3 py-1.5 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
              >
                ← Prev
              </button>
              <button
                onClick={onNextRecord}
                title="Next Day Sheet"
                className="flex-1 sm:flex-none bg-[#80d0ff] hover:bg-[#68c5ff] text-slate-900 font-bold px-3 py-1.5 rounded border border-blue-400 shadow-xs active:scale-95 transition-all cursor-pointer text-center"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Till Difference Box */}
          <div
            data-total-variance="true"
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto total-variance-highlight"
          >
            <div className="bg-[#e2e8f0] border border-slate-400 px-3.5 py-1.5 rounded shadow-xs font-bold text-slate-800 text-base sm:text-xl flex items-center justify-center gap-2">
              <span className="bg-slate-800 text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded font-black border border-slate-600 shadow-xs">
                J
              </span>
              Till Differance
            </div>
            <div
              className={`flex items-center justify-between sm:justify-end gap-2.5 border-2 px-3.5 py-1.5 rounded shadow-xs text-right font-black text-xl sm:text-3xl min-w-[200px] ${
                totals.totalVariance < 0
                  ? "bg-rose-50 border-rose-500 text-rose-700"
                  : totals.totalVariance > 0
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                    : "bg-white border-slate-400 text-slate-900"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded text-white total-variance-badge ${
                  totals.totalVariance < 0
                    ? "bg-red-600"
                    : totals.totalVariance > 0
                      ? "bg-emerald-600"
                      : "bg-slate-700"
                }`}
              >
                {totals.totalVariance < 0 ? (
                  <>
                    <TrendingDown className="w-4 h-4" /> SHORT
                  </>
                ) : totals.totalVariance > 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4" /> OVER
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> BALANCED
                  </>
                )}
              </span>
              <span className="font-mono">
                {formatCurrency(totals.totalVariance, true)}
              </span>
            </div>
          </div>
        </div>

        {/* Physical Filing Verification & Approval Footer (Print Only) */}
        <div className="hidden print:flex print-signature-block">
          <div className="print-signature-grid">
            {/* Operator Signature Box */}
            <div className="print-signature-box">
              <div className="print-signature-box-header">
                <span>1. Cashier / Operator</span>
                <span>Till Count Certification</span>
              </div>
              <div className="text-[7pt] text-slate-500 mb-3">
                I certify that all cash drawer counts, safe takings, and card terminal batch records are accurate.
              </div>
              <div className="print-sign-line">
                <div>Signature: ___________________________</div>
                <div className="print-sign-meta">Name: {record.operator || "Staff Member"} | Date: {formatToUKDate(record.date)}</div>
              </div>
            </div>

            {/* Shift Supervisor Box */}
            <div className="print-signature-box">
              <div className="print-signature-box-header">
                <span>2. Shift Supervisor</span>
                <span>Safe Drop &amp; Float Witness</span>
              </div>
              <div className="text-[7pt] text-slate-500 mb-3">
                Physical floats, opening balance consistency, and cash banking envelopes witnessed and verified.
              </div>
              <div className="print-sign-line">
                <div>Signature: ___________________________</div>
                <div className="print-sign-meta">Witness Name: _________________ | Date: ___/___/______</div>
              </div>
            </div>

            {/* Store Manager / Auditor Box */}
            <div className="print-signature-box">
              <div className="print-signature-box-header">
                <span>3. Manager / Auditor</span>
                <span>Reconciliation Sign-Off</span>
              </div>
              <div className="text-[7pt] text-slate-500 mb-3">
                Financial audit complete. Daily register balance variance of {formatCurrency(totals.totalVariance, true)} reviewed and posted.
              </div>
              <div className="print-sign-line">
                <div>Signature: ___________________________</div>
                <div className="print-sign-meta">Manager Name: _________________ | Date: ___/___/______</div>
              </div>
            </div>

            {/* Audit Stamp & QR Code Card */}
            <div className="print-audit-stamp-card">
              <RecordAuditQrCode
                record={record}
                totals={totals}
                size={56}
                showCaption={false}
                className="border-none shadow-none p-0 bg-transparent"
              />
              <div className="print-audit-stamp border-none p-0 bg-transparent text-left" data-total-variance="true">
                <div className="text-[6.5pt] font-mono text-slate-500 uppercase tracking-wider">Net Day Variance</div>
                <div className="font-mono text-sm font-black text-black">
                  {formatCurrency(totals.totalVariance, true)}
                </div>
                <div className="text-[7pt] font-mono text-slate-700 mt-0.5">
                  ID: <strong>{record.id}</strong>
                </div>
                <div className="inline-block mt-1 px-1.5 py-0.5 bg-black text-white text-[7pt] font-mono font-black uppercase">
                  {totals.totalVariance < 0 ? "SHORT" : totals.totalVariance > 0 ? "OVER" : "BALANCED"}
                </div>
              </div>
            </div>
          </div>

          <div className="print-compliance-statement">
            Official Till Cashing &amp; Reconciliation Record • Retain for Statutory Audit &amp; Accounting Compliance
          </div>
        </div>

        {/* Caution Warning Banner */}
        <div className="mt-6 print:hidden" data-print-hide="true">
          <div className="bg-[#ffff00] border border-amber-400 px-4 py-1 rounded inline-block shadow-xs">
            <p className="font-bold text-black text-xs sm:text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-900 shrink-0" />
              Caution you will not be able to edit after you have saved This
              Sheet!!!!
            </p>
          </div>
        </div>
      </div>

      {/* Cash Calculator Modal */}
      {selectedTillIndex !== null && (
        <CashCalculatorModal
          isOpen={calcModalOpen}
          onClose={() => {
            setCalcModalOpen(false);
            setSelectedTillIndex(null);
          }}
          tillName={record.rows[selectedTillIndex]?.name || "Till"}
          initialTargetField={calcTargetField}
          onApply={handleApplyCalc}
        />
      )}

      {/* Operator Database Modal */}
      <OperatorModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        operators={operators}
        onAddOperator={onAddOperator}
        onDeleteOperator={onDeleteOperator}
        onEditOperator={onEditOperator}
        selectedOperator={record.operator}
        onSelectOperator={(name) => {
          onChangeRecord({ ...record, operator: name });
        }}
      />

      {/* Day Sheet Print Modal */}
      <DaySheetPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        record={record}
        allRecords={allRecords}
      />

      {/* Print-Friendly Thermal Slip Modal */}
      <ThermalReceiptModal
        isOpen={isThermalModalOpen}
        onClose={() => setIsThermalModalOpen(false)}
        record={record}
        allRecords={allRecords}
        financialYearFormat={financialYearFormat}
      />

      {/* Date Go To Jump Modal */}
      <GoToDateModal
        isOpen={isGoToDateModalOpen}
        onClose={() => setIsGoToDateModalOpen(false)}
        currentDate={record.date}
        records={allRecords}
        onSelectDate={(targetDate) => {
          if (onGoToDate) {
            onGoToDate(targetDate);
          } else {
            handleDateChange(targetDate);
          }
        }}
        financialYearFormat={financialYearFormat}
      />
    </div>
  );
};
