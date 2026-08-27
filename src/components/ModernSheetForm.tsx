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
} from "../utils/calculations";
import { exportDaySheetToPDF } from "../utils/pdfExport";
import { RecordAuditQrCode } from "./RecordAuditQrCode";
import {
  Calculator,
  Lock,
  Unlock,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  BarChart3,
  List,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
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
} from "lucide-react";
import { DecimalInput } from "./DecimalInput";
import { CashCalculatorModal, TargetFieldType } from "./CashCalculatorModal";
import { OperatorModal } from "./OperatorModal";
import { DaySheetPrintModal } from "./DaySheetPrintModal";
import { ThermalReceiptModal } from "./ThermalReceiptModal";
import { FinancialYearFormat } from "./FinancialYearSwitcher";

interface ModernSheetFormProps {
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
  onExportExcel: () => void;
  onPrevRecord: () => void;
  onNextRecord: () => void;
  onOpenRecordsList: () => void;
  operators: string[];
  onAddOperator: (name: string) => void;
  onDeleteOperator: (name: string) => void;
  onEditOperator?: (oldName: string, newName: string) => void;
  onRecalculatePageValues?: () => void;
}

export const ModernSheetForm: React.FC<ModernSheetFormProps> = ({
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
  onExportExcel,
  onPrevRecord,
  onNextRecord,
  onOpenRecordsList,
  operators = [],
  onAddOperator,
  onDeleteOperator,
  onEditOperator,
  onRecalculatePageValues,
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

  const handleOpenCalc = (index: number) => {
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
      updatedRows[selectedTillIndex].col6ActualCard = roundedAmount;
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

  return (
    <div className="w-full max-w-full ml-0 mr-auto p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Editorial Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black pb-4 gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
            Financial Control & Audit
          </div>
          <h2 className="font-serif italic text-3xl sm:text-4xl font-bold text-black tracking-tight">
            Daily Till Reconciliation
          </h2>
          <p className="text-xs text-zinc-600 mt-1 font-medium">
            Delta Database Cashing Up Sheet — Audit Date:{" "}
            <span className="font-mono font-bold text-black">
              {formatToUKDate(record.date)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded font-mono text-xs font-bold border border-black shadow-xs">
            A
          </span>
          <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1">
            <input
              type="date"
              disabled={isLocked}
              value={record.date}
              onChange={(e) =>
                onChangeRecord({ ...record, date: e.target.value })
              }
              className="font-mono font-bold text-xs bg-transparent text-black focus:outline-none focus:bg-amber-50"
            />
            <span className="text-[10px] font-mono font-black px-1.5 py-0.2 bg-black text-amber-400 rounded">
              {getFinancialYear(record.date, financialYearFormat)}
            </span>
          </div>

          {/* Operator Database Field */}
          <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1">
            <User className="w-3.5 h-3.5 text-black shrink-0" />
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
              className="font-mono font-bold text-xs bg-transparent text-black focus:outline-none cursor-pointer disabled:bg-zinc-100 max-w-[150px] truncate"
            >
              <option value="">-- Select Operator --</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
              <option
                value="__MANAGE_OPERATORS__"
                className="font-bold text-amber-900 bg-amber-100"
              >
                ⚙️ Manage Operators...
              </option>
            </select>

            <button
              type="button"
              onClick={() => setIsOperatorModalOpen(true)}
              className="flex items-center gap-1 bg-black hover:bg-zinc-800 text-amber-400 font-bold text-[11px] px-2 py-0.5 border border-black cursor-pointer transition-colors shrink-0 ml-1"
              title="Edit staff roster and operators database"
            >
              <Users className="w-3 h-3 text-amber-400" />
              Edit Staff
            </button>
          </div>

          <span
            className={`text-xs px-3 py-1.5 font-bold uppercase tracking-wider border-2 ${
              isLocked
                ? "bg-amber-400 border-black text-black"
                : "bg-black border-black text-white"
            } flex items-center gap-1.5`}
          >
            {isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {isLocked ? "Locked" : "Draft"}
          </span>

          {/* Recalculate Page Values Button */}
          {onRecalculatePageValues && (
            <button
              onClick={onRecalculatePageValues}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              title="Recalculate all row totals and page variances"
            >
              <RefreshCw className="w-3 h-3 text-black" />
              Recalculate Page Values
            </button>
          )}

          {/* Export PDF Button (jsPDF) */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 text-white font-extrabold text-xs px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Export current day sheet to PDF using jsPDF (print media query styled)"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-white" />
                Export PDF
              </>
            )}
          </button>

          {/* Print Day Page Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white font-extrabold text-xs px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Print current day sheet"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            Print / Preview
          </button>

          {/* Print-Friendly Thermal View Button */}
          <button
            type="button"
            onClick={() => setIsThermalModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Open Print-Friendly View cleaned up specifically for quick POS thermal printer output (essential fields only)"
          >
            <Receipt className="w-3.5 h-3.5 text-black" />
            <span>Print-Friendly View</span>
          </button>

          {/* Desktop Calculator Toolbar Button */}
          <button
            onClick={() => {
              setSelectedTillIndex(0);
              setCalcTargetField("col1ExpectedCash");
              setCalcModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Open Desktop Calculator"
          >
            <Calculator className="w-3.5 h-3.5 text-black" />
            Calculator
          </button>
        </div>
      </div>

      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
            <span>Expected Takings</span>
            <Scale className="w-4 h-4 text-black" />
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(totals.totalCol3Expected)}
          </p>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">
            Cash: {formatCurrency(totals.totalCol1Cash)} | Card:{" "}
            {formatCurrency(totals.totalCol2Card)}
          </p>
        </div>

        <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
            <span>Actual Counted</span>
            <CheckCircle2 className="w-4 h-4 text-black" />
          </div>
          <p className="text-2xl font-mono font-bold text-black">
            {formatCurrency(totals.totalCol7Actual)}
          </p>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">
            Banked: {formatCurrency(totals.totalCol4Banking)} | Float:{" "}
            {formatCurrency(totals.totalCol5Float)}
          </p>
        </div>

        {/* Net Variance / Total Variance Card */}
        <div
          data-total-variance="true"
          className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] total-variance-highlight"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
            <span className="font-extrabold text-black">
              Total Variance / Till Difference
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border total-variance-badge ${
                totals.totalVariance < 0
                  ? "bg-rose-100 border-rose-600 text-rose-800"
                  : totals.totalVariance > 0
                    ? "bg-emerald-100 border-emerald-600 text-emerald-900"
                    : "bg-zinc-100 border-zinc-400 text-black"
              }`}
            >
              {totals.totalVariance < 0 ? (
                <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
              ) : totals.totalVariance > 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-700 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-black shrink-0" />
              )}
              {totals.totalVariance < 0
                ? "Short"
                : totals.totalVariance > 0
                  ? "Over"
                  : "Balanced"}
            </span>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-mono font-black ${
              totals.totalVariance < 0
                ? "text-rose-600"
                : totals.totalVariance > 0
                  ? "text-emerald-700"
                  : "text-black"
            }`}
          >
            {formatCurrency(totals.totalVariance, true)}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mt-1">
            {totals.totalVariance === 0
              ? "Balanced (Till Reconciled)"
              : totals.totalVariance > 0
                ? "Cash Over (+)"
                : "Cash Short (-)"}
          </p>
        </div>

        <div className="bg-black text-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 mb-1">
              Audit Record ID
            </div>
            <p className="font-mono text-sm text-zinc-300 truncate">
              {record.id || "Current Entry"}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
              Rows Audited
            </span>
            <span className="font-mono font-bold text-amber-400">
              {record.rows.length} Tills
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 bg-zinc-100 border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-serif italic font-bold text-lg text-black">
              Register Audit Detail
            </h3>

            {/* Mobile View Toggle */}
            <div className="flex md:hidden items-center border-2 border-black bg-white p-0.5 text-xs font-bold">
              <button
                onClick={() => setMobileViewMode("cards")}
                className={`px-2 py-0.5 ${
                  mobileViewMode === "cards"
                    ? "bg-amber-400 text-black"
                    : "text-zinc-600"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setMobileViewMode("table")}
                className={`px-2 py-0.5 ${
                  mobileViewMode === "table"
                    ? "bg-amber-400 text-black"
                    : "text-zinc-600"
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onPrevRecord}
              className="p-1.5 bg-white border-2 border-black hover:bg-zinc-100 text-black active:scale-95 transition-all cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNextRecord}
              className="p-1.5 bg-white border-2 border-black hover:bg-zinc-100 text-black active:scale-95 transition-all cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-zinc-400 mx-1" />

            <button
              onClick={onSaveRecord}
              className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 border-2 border-black active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              Save Sheet
            </button>

            <button
              onClick={onAddRecord}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-black text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-black active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Entry
            </button>

            <button
              onClick={onOpenRecordsList}
              className="flex items-center gap-1.5 bg-white hover:bg-amber-50 text-black text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-black active:scale-95 transition-all cursor-pointer"
            >
              <List className="w-3.5 h-3.5" />
              Archive
            </button>

            <button
              onClick={onOpenWeeklyReport}
              className="flex items-center gap-1.5 bg-white hover:bg-amber-50 text-black text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-black active:scale-95 transition-all cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Weekly
            </button>

            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-black active:scale-95 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Mobile Cards View */}
        <div
          className={`${mobileViewMode === "cards" ? "block md:hidden" : "hidden"} p-4 space-y-4 bg-zinc-50 border-b-2 border-black`}
        >
          {record.rows.map((row, idx) => {
            if (row.isYard) {
              const yardVar = row.customVariance || 0;
              return (
                <div
                  key={row.id || idx}
                  className="bg-amber-50 p-4 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <span className="font-serif italic font-bold text-lg text-black">
                      {row.name}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                      Special Adjustment
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-black">
                      Variance (Difference):
                    </span>
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
                      className="w-28 text-right font-mono font-bold bg-white border-2 border-black p-1.5 text-sm"
                    />
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
                className="bg-white p-4 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-3"
              >
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="font-serif italic font-bold text-lg text-black">
                    {row.name}
                  </span>
                  {!isLocked && (
                    <button
                      onClick={() => handleOpenCalc(idx)}
                      className="flex items-center gap-1 text-xs font-bold bg-amber-400 border border-black px-2 py-1 shadow-xs"
                    >
                      <Calculator className="w-3.5 h-3.5" /> Cash Calc
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-zinc-600">
                        <span className="bg-amber-400 text-black px-1 rounded font-mono mr-1">
                          B
                        </span>
                        Sys Cash (1)
                      </label>
                      <span
                        className="text-[9px] font-mono font-bold text-zinc-800 bg-zinc-200 border border-zinc-300 px-1.5 py-0.5 rounded select-none pointer-events-none"
                        title="Protected field: Yesterday's Float"
                      >
                        Yest: £
                        {getYesterdayFloat(row, record, allRecords).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col1ExpectedCash}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col1ExpectedCash", val)
                        }
                        placeholder="0.00"
                        className="w-full text-right font-mono font-bold bg-zinc-50 border-2 border-black p-1.5"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col1ExpectedCash")
                          }
                          title="Open Calculator for Sys Cash (1)"
                          className="bg-amber-400 hover:bg-amber-300 text-black p-1.5 border border-black shadow-xs shrink-0 cursor-pointer"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                      <span className="bg-amber-400 text-black px-1 rounded font-mono mr-1">
                        C
                      </span>
                      Sys Card (2)
                    </label>
                    <div className="flex items-center gap-1">
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col2ExpectedCard}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col2ExpectedCard", val)
                        }
                        placeholder="0.00"
                        className="w-full text-right font-mono font-bold bg-zinc-50 border-2 border-black p-1.5"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col2ExpectedCard")
                          }
                          title="Open Slips Adder / Calculator for Sys Card (2)"
                          className="bg-amber-400 hover:bg-amber-300 text-black p-1.5 border border-black shadow-xs shrink-0 cursor-pointer"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-100 border border-black p-2 flex justify-between items-center text-xs font-mono font-bold">
                  <span>
                    <span className="bg-amber-400 text-black px-1 rounded font-mono mr-1">
                      D
                    </span>
                    Sys Total (3):
                  </span>
                  <span>{formatCurrency(expTotal)}</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 block mb-1 truncate">
                      <span className="bg-amber-400 text-black px-1 rounded font-mono mr-0.5">
                        E
                      </span>
                      Banking (4)
                    </label>
                    <div className="flex items-center gap-0.5">
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col4BankingCash}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col4BankingCash", val)
                        }
                        placeholder="0.00"
                        className="w-full text-right font-mono font-bold bg-zinc-50 border-2 border-black p-1 text-xs"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col4BankingCash")
                          }
                          title="Count Cash for Banking (4)"
                          className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                        >
                          <Calculator className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 block mb-1 truncate">
                      <span className="bg-amber-400 text-black px-1 rounded font-mono mr-0.5">
                        F
                      </span>
                      Float (5)
                    </label>
                    <div className="flex items-center gap-0.5">
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col5FloatCash}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col5FloatCash", val)
                        }
                        placeholder="0.00"
                        className="w-full text-right font-mono font-bold bg-zinc-50 border-2 border-black p-1 text-xs"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCalcForField(idx, "col5FloatCash")
                          }
                          title="Count Cash for Float (5)"
                          className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                        >
                          <Calculator className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-zinc-600 block mb-1 truncate">
                      <span className="bg-amber-400 text-black px-1 rounded font-mono mr-0.5">
                        G
                      </span>
                      Card (6)
                    </label>
                    <DecimalInput
                      disabled={isLocked}
                      value={row.col6ActualCard}
                      onChange={(val) =>
                        handleRowNumericChange(idx, "col6ActualCard", val)
                      }
                      placeholder="0.00"
                      className="w-full text-right font-mono font-bold bg-zinc-200 border-2 border-black p-1 text-xs"
                    />
                  </div>
                </div>

                <div className="bg-zinc-100 border border-black p-2 flex justify-between items-center text-xs font-mono font-bold">
                  <span>
                    <span className="bg-amber-400 text-black px-1 rounded font-mono mr-1">
                      H
                    </span>
                    Counted Total (7):
                  </span>
                  <span>{formatCurrency(actTotal)}</span>
                </div>

                <div className="border-2 border-black p-2 flex justify-between items-center text-xs font-bold">
                  <span className="flex items-center gap-1">
                    <span className="bg-amber-400 text-black px-1 rounded font-mono text-[10px]">
                      I
                    </span>
                    Variance (8):
                  </span>
                  <span
                    className={`font-mono ${
                      variance < 0
                        ? "text-rose-600"
                        : variance > 0
                          ? "text-emerald-700"
                          : "text-black"
                    }`}
                  >
                    {formatCurrency(variance, true)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Content */}
        <div
          className={`${mobileViewMode === "table" ? "block" : "hidden md:block"} overflow-x-auto border-2 border-black`}
        >
          <table className="w-full min-w-[960px] xl:min-w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-black text-white border-b-2 border-black text-xs font-sans">
              <tr>
                <th className="py-2.5 px-3 lg:px-4 font-bold">Register</th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    B
                  </span>
                  System Cash (1)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    C
                  </span>
                  System Card (2)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold bg-zinc-900 text-amber-400">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    D
                  </span>
                  System Total (3)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    E
                  </span>
                  Banking Cash (4)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    F
                  </span>
                  Float Cash (5)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    G
                  </span>
                  Card PDQ (6)
                </th>
                <th className="py-2.5 px-2 lg:px-3 text-right font-bold bg-zinc-900 text-amber-400">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    H
                  </span>
                  Counted Total (7)
                </th>
                <th className="py-2.5 px-3 lg:px-4 text-right font-bold">
                  <span className="bg-amber-400 text-black px-1 py-0.5 rounded font-mono text-[10px] mr-1">
                    I
                  </span>
                  Variance (8)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-black font-medium">
              {record.rows.map((row, idx) => {
                if (row.isYard) {
                  return (
                    <tr
                      key={row.id || idx}
                      className="bg-amber-100/60 font-medium border-y border-black"
                    >
                      <td
                        colSpan={9}
                        className="py-3 px-4 font-serif italic font-bold text-black"
                      >
                        {row.name}
                      </td>
                    </tr>
                  );
                }

                const expTotal = getRowExpectedTotal(row);
                const actTotal = getRowActualTotal(row);
                const variance = getRowVariance(row, record, allRecords);

                return (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-black flex items-center justify-between">
                      <span className="font-sans">{row.name}</span>
                      {!isLocked && (
                        <button
                          onClick={() => handleOpenCalc(idx)}
                          title="Open Cash Calculator"
                          className="text-zinc-500 hover:text-black p-1 rounded transition-colors"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>

                    {/* Col 1 */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div
                          className="bg-zinc-100 text-zinc-800 border border-zinc-300 rounded px-1.5 py-0.5 text-right font-mono text-[10px] shrink-0 select-none pointer-events-none"
                          title="Protected field: Yesterday's Float (5)"
                        >
                          <span className="text-[8px] text-zinc-500 block font-sans font-bold uppercase leading-none">
                            Yest Float
                          </span>
                          <span className="font-bold text-zinc-800">
                            £
                            {getYesterdayFloat(row, record, allRecords).toFixed(
                              2,
                            )}
                          </span>
                        </div>
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col1ExpectedCash}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col1ExpectedCash", val)
                          }
                          placeholder="0.00"
                          className="w-20 text-right font-mono font-semibold bg-zinc-50 border border-zinc-300 px-1.5 py-1 text-black focus:outline-none focus:border-black focus:bg-white text-xs"
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col1ExpectedCash")
                            }
                            title="Open Calculator for Sys Cash (1)"
                            className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Col 2 */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col2ExpectedCard}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col2ExpectedCard", val)
                          }
                          placeholder="0.00"
                          className="w-20 text-right font-mono font-semibold bg-zinc-50 border border-zinc-300 px-1.5 py-1 text-black focus:outline-none focus:border-black focus:bg-white text-xs"
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col2ExpectedCard")
                            }
                            title="Open Slips Adder / Calculator for Sys Card (2)"
                            className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Col 3 */}
                    <td className="py-2 px-3 text-right font-mono font-bold bg-zinc-100 border-x border-zinc-200">
                      {formatCurrency(expTotal)}
                    </td>

                    {/* Col 4 */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col4BankingCash}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col4BankingCash", val)
                          }
                          placeholder="0.00"
                          className="w-20 text-right font-mono font-semibold bg-zinc-50 border border-zinc-300 px-1.5 py-1 text-black focus:outline-none focus:border-black focus:bg-white text-xs"
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col4BankingCash")
                            }
                            title="Count Cash for Banking (4)"
                            className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Col 5 */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DecimalInput
                          disabled={isLocked}
                          value={row.col5FloatCash}
                          onChange={(val) =>
                            handleRowNumericChange(idx, "col5FloatCash", val)
                          }
                          placeholder="0.00"
                          className="w-20 text-right font-mono font-semibold bg-zinc-50 border border-zinc-300 px-1.5 py-1 text-black focus:outline-none focus:border-black focus:bg-white text-xs"
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCalcForField(idx, "col5FloatCash")
                            }
                            title="Count Cash for Float (5)"
                            className="bg-amber-400 hover:bg-amber-300 text-black p-1 border border-black shadow-xs shrink-0 cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Col 6 */}
                    <td className="py-2 px-3 text-right">
                      <DecimalInput
                        disabled={isLocked}
                        value={row.col6ActualCard}
                        onChange={(val) =>
                          handleRowNumericChange(idx, "col6ActualCard", val)
                        }
                        placeholder="0.00"
                        className="w-24 text-right font-mono font-semibold bg-zinc-50 border border-zinc-300 px-2 py-1 text-black focus:outline-none focus:border-black focus:bg-white"
                      />
                    </td>

                    {/* Col 7 */}
                    <td className="py-2 px-3 text-right font-mono font-bold bg-zinc-100 border-x border-zinc-200">
                      {formatCurrency(actTotal)}
                    </td>

                    {/* Col 8 Variance */}
                    <td className="py-2 px-4 text-right font-mono font-bold">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border ${
                          variance < 0
                            ? "bg-rose-100 border-rose-600 text-rose-800"
                            : variance > 0
                              ? "bg-emerald-100 border-emerald-600 text-emerald-900"
                              : "bg-zinc-100 border-zinc-400 text-black"
                        }`}
                      >
                        {variance < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                        ) : variance > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-black" />
                        )}
                        <span>{formatCurrency(variance, true)}</span>
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                          (
                          {variance < 0
                            ? "Short"
                            : variance > 0
                              ? "Over"
                              : "Ok"}
                          )
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Grand Totals Footer */}
            <tfoot className="bg-black text-white font-mono font-bold border-t-2 border-black">
              <tr>
                <td className="py-3.5 px-4 uppercase text-xs tracking-wider text-amber-400 font-serif italic font-normal">
                  Grand Totals
                </td>
                <td className="py-3.5 px-3 text-right">
                  {formatCurrency(totals.totalCol1Cash)}
                </td>
                <td className="py-3.5 px-3 text-right">
                  {formatCurrency(totals.totalCol2Card)}
                </td>
                <td className="py-3.5 px-3 text-right text-amber-400 bg-zinc-900 border-x border-zinc-800">
                  {formatCurrency(totals.totalCol3Expected)}
                </td>
                <td className="py-3.5 px-3 text-right">
                  {formatCurrency(totals.totalCol4Banking)}
                </td>
                <td className="py-3.5 px-3 text-right">
                  {formatCurrency(totals.totalCol5Float)}
                </td>
                <td className="py-3.5 px-3 text-right">
                  {formatCurrency(totals.totalCol6Card)}
                </td>
                <td className="py-3.5 px-3 text-right text-amber-400 bg-zinc-900 border-x border-zinc-800">
                  {formatCurrency(totals.totalCol7Actual)}
                </td>
                <td
                  className="py-3.5 px-4 text-right variance-total-cell"
                  data-total-variance="true"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold border border-white total-variance-badge ${
                      totals.totalVariance < 0
                        ? "bg-rose-600 text-white"
                        : totals.totalVariance > 0
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-amber-400"
                    }`}
                  >
                    {totals.totalVariance < 0 ? (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    ) : totals.totalVariance > 0 ? (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
                    )}
                    <span>{formatCurrency(totals.totalVariance, true)}</span>
                    <span className="text-[10px] uppercase tracking-wider ml-0.5">
                      {totals.totalVariance < 0
                        ? "Short"
                        : totals.totalVariance > 0
                          ? "Over"
                          : "Balanced"}
                    </span>
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Manager Notes & Audit Verification Section */}
      <div className="bg-white p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">
            Audit Notes & Manager Remarks
          </label>
          <textarea
            disabled={isLocked}
            value={record.notes || ""}
            onChange={(e) =>
              onChangeRecord({ ...record, notes: e.target.value })
            }
            placeholder="Enter shift notes, explanations for variances, staff on duty..."
            className="w-full h-20 p-3 bg-zinc-50 border-2 border-black text-sm font-mono focus:outline-none focus:bg-white text-black"
          />
        </div>
        <div className="shrink-0 flex flex-col items-center justify-center p-2 bg-zinc-50 border border-black">
          <RecordAuditQrCode
            record={record}
            totals={totals}
            size={72}
            showCaption={true}
            className="border-none shadow-none bg-transparent"
          />
        </div>
      </div>

      {/* Physical Filing Verification & Approval Footer (Print Only) */}
      <div className="hidden print:flex print-filing-footer items-end justify-between gap-4">
        <div className="print-sign-line">
          Operator Signature
          <div className="text-[8pt] text-zinc-600 font-normal">
            {record.operator || "Staff Member"}
          </div>
        </div>

        <div className="flex items-center gap-3 border-2 border-black p-2 bg-zinc-50">
          <RecordAuditQrCode
            record={record}
            totals={totals}
            size={60}
            showCaption={false}
            className="border-none shadow-none p-0 bg-transparent"
          />
          <div
            className="print-audit-stamp border-none p-0 bg-transparent text-left"
            data-total-variance="true"
          >
            <div>
              TOTAL VARIANCE:{" "}
              <span className="font-mono text-sm font-black">
                {formatCurrency(totals.totalVariance, true)}
              </span>
            </div>
            <div className="text-[7.5pt] font-mono text-zinc-700">
              ID: <strong>{record.id}</strong> | Status:{" "}
              <strong>
                {totals.totalVariance < 0
                  ? "SHORT"
                  : totals.totalVariance > 0
                    ? "OVER"
                    : "BALANCED"}
              </strong>
            </div>
            <div className="text-[6.5pt] uppercase tracking-wider text-zinc-500 mt-0.5">
              Digital Verification QR Code
            </div>
          </div>
        </div>

        <div className="print-sign-line">
          Manager / Auditor Approval
          <div className="text-[8pt] text-zinc-600 font-normal">
            Date & Signature
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
    </div>
  );
};
