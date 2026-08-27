import React, { useState, useMemo } from 'react';
import { SheetRecord } from '../types';
import {
  calculateGrandTotals,
  downloadCSV,
  exportRecordToCSV,
  filterRecordsByFinancialYear,
  formatCurrency,
  formatToUKDate,
  getFinancialYear,
} from '../utils/calculations';
import {
  Search,
  Calendar,
  FileSpreadsheet,
  Trash2,
  Lock,
  Unlock,
  ArrowRight,
  Filter,
  Plus,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  User,
  Printer,
  RefreshCw,
  X,
  Coins,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import { FinancialYearSwitcher, FinancialYearFormat } from './FinancialYearSwitcher';

interface RecordsListProps {
  records: SheetRecord[];
  selectedYear?: string;
  onSelectYear?: (year: string) => void;
  financialYearFormat?: FinancialYearFormat;
  onChangeFinancialYearFormat?: (format: FinancialYearFormat) => void;
  onSelectRecord: (id: string) => void;
  onDeleteRecord: (id: string) => void;
  onNewRecord: () => void;
  onBackToSheet: () => void;
  operators?: string[];
  onOpenRangeReport?: () => void;
  onRecalculateAllData?: () => void;
}

type RevenuePreset = 'all' | 'under1k' | '1k-2.5k' | '2.5k-5k' | 'over5k' | 'custom';
type SortOption = 'date-desc' | 'date-asc' | 'revenue-desc' | 'revenue-asc' | 'variance-asc' | 'variance-desc';

export const RecordsList: React.FC<RecordsListProps> = ({
  records,
  selectedYear = 'all',
  onSelectYear,
  financialYearFormat = 'calendar',
  onChangeFinancialYearFormat,
  onSelectRecord,
  onDeleteRecord,
  onNewRecord,
  onBackToSheet,
  operators = [],
  onOpenRangeReport,
  onRecalculateAllData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVariance, setFilterVariance] = useState<'all' | 'over' | 'short' | 'balanced'>('all');
  const [filterOperator, setFilterOperator] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Revenue threshold states
  const [revenuePreset, setRevenuePreset] = useState<RevenuePreset>('all');
  const [minRevenue, setMinRevenue] = useState<string>('');
  const [maxRevenue, setMaxRevenue] = useState<string>('');
  const [revenueMetric, setRevenueMetric] = useState<'actual' | 'expected' | 'banked'>('actual');

  // Sorting and Advanced Filter dropdown states
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Quick date presets
  const handleDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'all') => {
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const todayStr = toISO(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(toISO(past));
      setEndDate(toISO(today));
      return;
    }

    if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(toISO(past));
      setEndDate(toISO(today));
      return;
    }

    if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(toISO(firstDay));
      setEndDate(toISO(lastDay));
      return;
    }

    if (preset === 'lastMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(toISO(firstDay));
      setEndDate(toISO(lastDay));
      return;
    }
  };

  // Quick revenue presets
  const handleRevenuePresetChange = (preset: RevenuePreset) => {
    setRevenuePreset(preset);
    if (preset === 'all') {
      setMinRevenue('');
      setMaxRevenue('');
    } else if (preset === 'under1k') {
      setMinRevenue('0');
      setMaxRevenue('1000');
    } else if (preset === '1k-2.5k') {
      setMinRevenue('1000');
      setMaxRevenue('2500');
    } else if (preset === '2.5k-5k') {
      setMinRevenue('2500');
      setMaxRevenue('5000');
    } else if (preset === 'over5k') {
      setMinRevenue('5000');
      setMaxRevenue('');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterVariance('all');
    setFilterOperator('all');
    setStartDate('');
    setEndDate('');
    setRevenuePreset('all');
    setMinRevenue('');
    setMaxRevenue('');
    setSortBy('date-desc');
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    filterVariance !== 'all' ||
    filterOperator !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    revenuePreset !== 'all' ||
    minRevenue !== '' ||
    maxRevenue !== '';

  // Filtered & Sorted records
  const filteredAndSortedRecords = useMemo(() => {
    const rawSearch = searchTerm.trim().toLowerCase();

    // Check if search contains smart numeric threshold syntax (e.g. ">1000", "<500", ">=2500", "1000-2000")
    let smartMinRev: number | null = null;
    let smartMaxRev: number | null = null;
    let cleanSearch = rawSearch;

    const gtMatch = rawSearch.match(/(?:>|>=|rev:>|rev:>=)\s*(\d+(?:\.\d+)?)/);
    if (gtMatch) {
      smartMinRev = parseFloat(gtMatch[1]);
      cleanSearch = cleanSearch.replace(gtMatch[0], '').trim();
    }

    const ltMatch = rawSearch.match(/(?:<|<=|rev:<|rev:<=)\s*(\d+(?:\.\d+)?)/);
    if (ltMatch) {
      smartMaxRev = parseFloat(ltMatch[1]);
      cleanSearch = cleanSearch.replace(ltMatch[0], '').trim();
    }

    const rangeMatch = rawSearch.match(/(\d+(?:\.\d+)?)\s*(?:-|–|\.\.)\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch && !smartMinRev && !smartMaxRev) {
      smartMinRev = parseFloat(rangeMatch[1]);
      smartMaxRev = parseFloat(rangeMatch[2]);
      cleanSearch = cleanSearch.replace(rangeMatch[0], '').trim();
    }

    const filtered = records.filter((rec) => {
      const ukDate = formatToUKDate(rec.date);
      const isoDate = rec.date;

      // Friendly date strings (e.g. Month name, Day of week)
      let dayName = '';
      let monthName = '';
      try {
        const d = new Date(rec.date);
        if (!isNaN(d.getTime())) {
          dayName = d.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();
          monthName = d.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase();
        }
      } catch (e) {}

      const totals = calculateGrandTotals(rec.rows, rec, records);
      const actualRevenue = totals.totalCol7Actual;
      const expectedRevenue = totals.totalCol3Expected;
      const bankedRevenue = totals.totalCol4Banking;

      const targetRevenue =
        revenueMetric === 'actual'
          ? actualRevenue
          : revenueMetric === 'expected'
          ? expectedRevenue
          : bankedRevenue;

      // 1. Financial Year Filter
      if (selectedYear !== 'all' && selectedYear) {
        const fy = getFinancialYear(rec.date, financialYearFormat);
        if (fy !== selectedYear && !rec.date.startsWith(selectedYear)) {
          return false;
        }
      }

      // 2. Text Search matching Date, Operator, Notes, Day, Month, or formatted numbers
      if (cleanSearch) {
        const matchesDate =
          ukDate.includes(cleanSearch) ||
          isoDate.includes(cleanSearch) ||
          dayName.includes(cleanSearch) ||
          monthName.includes(cleanSearch);
        const matchesOperator = (rec.operator || '').toLowerCase().includes(cleanSearch);
        const matchesNotes = (rec.notes || '').toLowerCase().includes(cleanSearch);
        const matchesId = rec.id.toLowerCase().includes(cleanSearch);
        const matchesRevAmount =
          targetRevenue.toFixed(2).includes(cleanSearch) ||
          Math.round(targetRevenue).toString().includes(cleanSearch);

        if (!matchesDate && !matchesOperator && !matchesNotes && !matchesId && !matchesRevAmount) {
          return false;
        }
      }

      // 3. Smart Revenue threshold from search bar
      if (smartMinRev !== null && targetRevenue < smartMinRev) return false;
      if (smartMaxRev !== null && targetRevenue > smartMaxRev) return false;

      // 4. Operator filter dropdown
      if (filterOperator !== 'all') {
        if (filterOperator === '__unassigned__') {
          if (rec.operator && rec.operator.trim() !== '') return false;
        } else if (rec.operator !== filterOperator) {
          return false;
        }
      }

      // 5. Date range filter
      if (startDate && rec.date < startDate) return false;
      if (endDate && rec.date > endDate) return false;

      // 6. Variance filter
      if (filterVariance === 'over' && totals.totalVariance <= 0) return false;
      if (filterVariance === 'short' && totals.totalVariance >= 0) return false;
      if (filterVariance === 'balanced' && totals.totalVariance !== 0) return false;

      // 7. Explicit Revenue Thresholds (Min / Max)
      const parsedMin = minRevenue !== '' ? parseFloat(minRevenue) : null;
      const parsedMax = maxRevenue !== '' ? parseFloat(maxRevenue) : null;

      if (parsedMin !== null && !isNaN(parsedMin) && targetRevenue < parsedMin) return false;
      if (parsedMax !== null && !isNaN(parsedMax) && targetRevenue > parsedMax) return false;

      return true;
    });

    // Apply Sorting
    return filtered.sort((a, b) => {
      const totalsA = calculateGrandTotals(a.rows, a, records);
      const totalsB = calculateGrandTotals(b.rows, b, records);

      if (sortBy === 'date-desc') {
        return b.date.localeCompare(a.date);
      }
      if (sortBy === 'date-asc') {
        return a.date.localeCompare(b.date);
      }
      if (sortBy === 'revenue-desc') {
        return totalsB.totalCol7Actual - totalsA.totalCol7Actual;
      }
      if (sortBy === 'revenue-asc') {
        return totalsA.totalCol7Actual - totalsB.totalCol7Actual;
      }
      if (sortBy === 'variance-asc') {
        return totalsA.totalVariance - totalsB.totalVariance;
      }
      if (sortBy === 'variance-desc') {
        return totalsB.totalVariance - totalsA.totalVariance;
      }
      return 0;
    });
  }, [
    records,
    selectedYear,
    financialYearFormat,
    searchTerm,
    filterVariance,
    filterOperator,
    startDate,
    endDate,
    minRevenue,
    maxRevenue,
    revenueMetric,
    sortBy,
  ]);

  // Summary aggregates for filtered set
  const filteredAggregates = useMemo(() => {
    return filteredAndSortedRecords.reduce(
      (acc, rec) => {
        const totals = calculateGrandTotals(rec.rows, rec, records);
        acc.totalActual += totals.totalCol7Actual;
        acc.totalExpected += totals.totalCol3Expected;
        acc.totalBanked += totals.totalCol4Banking;
        acc.totalVariance += totals.totalVariance;
        return acc;
      },
      { totalActual: 0, totalExpected: 0, totalBanked: 0, totalVariance: 0 }
    );
  }, [filteredAndSortedRecords, records]);

  const handleExportAll = () => {
    if (filteredAndSortedRecords.length === 0) return;
    const combinedCsv = filteredAndSortedRecords
      .map((r) => exportRecordToCSV(r))
      .join('\n\n========================================\n\n');
    downloadCSV(
      `Daily_Till_Sheets_Export_${new Date().toISOString().slice(0, 10)}.csv`,
      combinedCsv
    );
  };

  return (
    <div className="w-full max-w-full ml-0 mr-auto p-3 sm:p-5 lg:p-6 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
            Historical Ledger
          </div>
          <h1 className="text-2xl font-serif italic font-bold text-black flex items-center gap-2">
            <Calendar className="w-5 h-5 text-black" />
            Audit Records Archive
          </h1>
          <p className="text-xs font-mono text-zinc-600 mt-1">
            {records.length} daily sheets stored in local delta database
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onNewRecord}
            className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            New Daily Sheet
          </button>

          {onOpenRangeReport && (
            <button
              onClick={onOpenRangeReport}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Printer className="w-4 h-4 text-black" />
              Print Range Report
            </button>
          )}

          {onRecalculateAllData && (
            <button
              onClick={onRecalculateAllData}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Recalculate all records in database and synchronize floats"
            >
              <RefreshCw className="w-4 h-4 text-black" />
              Recalculate All
            </button>
          )}

          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-black font-bold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer"
            title="Export currently filtered records to CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV ({filteredAndSortedRecords.length})
          </button>

          <button
            onClick={onBackToSheet}
            className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-black font-bold text-xs uppercase tracking-wider px-3.5 py-2 border-2 border-black transition-all cursor-pointer"
          >
            Active Sheet
          </button>
        </div>
      </div>

      {/* Financial Year Switcher Bar */}
      {onSelectYear && (
        <FinancialYearSwitcher
          selectedYear={selectedYear}
          onSelectYear={onSelectYear}
          records={records}
          format={financialYearFormat}
          onChangeFormat={onChangeFinancialYearFormat}
          compact={false}
          showFormatToggle={true}
        />
      )}

      {/* Main Search and Filtering Panel */}
      <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-4 sm:p-5 space-y-4">
        {/* Top Search Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Universal Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by date (e.g. 14/08 or August), operator, notes, or revenue threshold (e.g. >2000, 1000-3000)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 border-2 border-black font-mono text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Operator Select */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border-2 border-black px-2.5 py-1.5 shrink-0">
            <User className="w-4 h-4 text-black shrink-0" />
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider text-black focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Operators</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
              <option value="__unassigned__">(Unassigned)</option>
            </select>
          </div>

          {/* Variance Status Select */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border-2 border-black px-2.5 py-1.5 shrink-0">
            <Filter className="w-4 h-4 text-black shrink-0" />
            <select
              value={filterVariance}
              onChange={(e) => setFilterVariance(e.target.value as any)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider text-black focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Variances</option>
              <option value="over">Over (+)</option>
              <option value="short">Short (-)</option>
              <option value="balanced">Balanced (0.00)</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border-2 border-black px-2.5 py-1.5 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-black shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider text-black focus:outline-none cursor-pointer pr-1"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="revenue-desc">Revenue: Highest First</option>
              <option value="revenue-asc">Revenue: Lowest First</option>
              <option value="variance-asc">Variance: Biggest Shortage</option>
              <option value="variance-desc">Variance: Biggest Surplus</option>
            </select>
          </div>

          {/* Toggle Advanced / Revenue Filters */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-black text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
              showAdvancedFilters || revenuePreset !== 'all' || minRevenue || maxRevenue || startDate || endDate
                ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-black'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Revenue & Date Filters</span>
            {(revenuePreset !== 'all' || minRevenue || maxRevenue || startDate || endDate) && (
              <span className="w-2 h-2 rounded-full bg-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Revenue Threshold & Date Range Expanded Controls */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-zinc-200 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-zinc-50 p-3.5 border-2 border-black">
            {/* Left: Revenue Threshold Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Revenue / Takings Threshold:</span>
                </label>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-600">
                  <span>Based on:</span>
                  <select
                    value={revenueMetric}
                    onChange={(e) => setRevenueMetric(e.target.value as any)}
                    className="bg-white border border-zinc-400 rounded-xs px-1.5 py-0.5 text-[10px] font-mono font-bold text-black focus:outline-none"
                  >
                    <option value="actual">Actual Takings</option>
                    <option value="expected">Expected Sales</option>
                    <option value="banked">Cash Banked</option>
                  </select>
                </div>
              </div>

              {/* Revenue Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Amounts' },
                  { id: 'under1k', label: '< £1,000' },
                  { id: '1k-2.5k', label: '£1k – £2.5k' },
                  { id: '2.5k-5k', label: '£2.5k – £5k' },
                  { id: 'over5k', label: '> £5,000' },
                  { id: 'custom', label: 'Custom Range' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleRevenuePresetChange(preset.id as RevenuePreset)}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      revenuePreset === preset.id
                        ? 'bg-black text-white border-black font-extrabold shadow-xs'
                        : 'bg-white hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Min & Max Revenue Input Boxes */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center bg-white border-2 border-black px-2 py-1 flex-1">
                  <span className="text-xs font-mono font-bold text-zinc-500 mr-1.5">Min £:</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="0.00"
                    value={minRevenue}
                    onChange={(e) => {
                      setMinRevenue(e.target.value);
                      setRevenuePreset('custom');
                    }}
                    className="w-full font-mono text-xs font-bold text-black focus:outline-none bg-transparent"
                  />
                  {minRevenue && (
                    <button
                      onClick={() => setMinRevenue('')}
                      className="text-zinc-400 hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <span className="text-zinc-400 text-xs font-bold">to</span>

                <div className="flex items-center bg-white border-2 border-black px-2 py-1 flex-1">
                  <span className="text-xs font-mono font-bold text-zinc-500 mr-1.5">Max £:</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="No limit"
                    value={maxRevenue}
                    onChange={(e) => {
                      setMaxRevenue(e.target.value);
                      setRevenuePreset('custom');
                    }}
                    className="w-full font-mono text-xs font-bold text-black focus:outline-none bg-transparent"
                  />
                  {maxRevenue && (
                    <button
                      onClick={() => setMaxRevenue('')}
                      className="text-zinc-400 hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {(minRevenue || maxRevenue) && (
                  <button
                    onClick={() => {
                      setMinRevenue('');
                      setMaxRevenue('');
                      setRevenuePreset('all');
                    }}
                    className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 hover:underline px-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Right: Date Range Selector & Quick Presets */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-700" />
                <span>Date Range & Quick Presets:</span>
              </label>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Dates' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'Last 30 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleDatePreset(preset.id as any)}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-white hover:bg-zinc-200 text-zinc-800 border border-zinc-300 transition-all cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Date From & To Picker */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1 flex-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 shrink-0">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-black focus:outline-none cursor-pointer"
                  />
                </div>

                <span className="text-zinc-400 text-xs font-bold">—</span>

                <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1 flex-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 shrink-0">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-black focus:outline-none cursor-pointer"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 hover:underline px-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter Summary & Quick Clear Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-black bg-zinc-100 border border-black px-2 py-1">
              Showing {filteredAndSortedRecords.length} of {records.length} records
            </span>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-400 font-sans font-bold text-[11px] uppercase tracking-wider px-2 py-1 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Reset All Filters
              </button>
            )}
          </div>

          {/* Filtered Aggregates Summary */}
          {filteredAndSortedRecords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
              <span className="text-zinc-600">
                Filtered Takings: <strong className="text-black font-bold">{formatCurrency(filteredAggregates.totalActual)}</strong>
              </span>
              <span className="text-zinc-600 hidden sm:inline">
                Banked: <strong className="text-black font-bold">{formatCurrency(filteredAggregates.totalBanked)}</strong>
              </span>
              <span className="text-zinc-600">
                Net Variance:{' '}
                <strong
                  className={
                    filteredAggregates.totalVariance < 0
                      ? 'text-rose-700 font-bold'
                      : filteredAggregates.totalVariance > 0
                      ? 'text-emerald-700 font-bold'
                      : 'text-black font-bold'
                  }
                >
                  {formatCurrency(filteredAggregates.totalVariance, true)}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm border-collapse">
            <thead className="bg-black text-white font-serif italic border-b-2 border-black text-xs">
              <tr>
                <th className="py-3 px-4 font-normal">Date</th>
                <th className="py-3 px-4 font-normal">Operator</th>
                <th className="py-3 px-4 font-normal">Status</th>
                <th className="py-3 px-4 text-right font-normal">Exp Takings</th>
                <th className="py-3 px-4 text-right font-normal">Actual Counted</th>
                <th className="py-3 px-4 text-right font-normal">Cash Banked</th>
                <th className="py-3 px-4 text-right font-normal">Variance</th>
                <th className="py-3 px-4 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-black font-medium">
              {filteredAndSortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 px-4 text-zinc-500 text-sm font-mono">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 border-2 border-black flex items-center justify-center text-zinc-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-black font-serif italic text-base">
                        No cashing up records match your search criteria.
                      </div>
                      <p className="text-xs text-zinc-600">
                        Try searching for a different date, operator name, or adjusting your revenue threshold filters.
                      </p>
                      {isAnyFilterActive && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black font-sans font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 border-2 border-black cursor-pointer shadow-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedRecords.map((rec) => {
                  const totals = calculateGrandTotals(rec.rows, rec, records);
                  const ukDate = formatToUKDate(rec.date);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-black font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{ukDate}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-zinc-900 text-amber-300 rounded font-black">
                            {getFinancialYear(rec.date, financialYearFormat)}
                          </span>
                        </div>
                        <span className="block text-[11px] font-normal text-zinc-500">
                          {rec.date}
                        </span>
                        {rec.notes && (
                          <span
                            className="block mt-1.5 text-[11px] font-sans font-normal text-zinc-700 bg-amber-50/80 p-1 rounded border-l-2 border-amber-500 max-w-[220px] truncate"
                            title={rec.notes}
                          >
                            💬 {rec.notes}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="inline-flex items-center gap-1 font-bold bg-amber-50 border border-amber-300 text-amber-950 px-2 py-0.5 rounded">
                          <User className="w-3 h-3 text-amber-700" />
                          {rec.operator || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 border ${
                            rec.isSaved
                              ? 'bg-amber-100 border-amber-600 text-amber-900'
                              : 'bg-zinc-100 border-zinc-400 text-black'
                          }`}
                        >
                          {rec.isSaved ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          {rec.isSaved ? 'Saved' : 'Draft'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono">
                        {formatCurrency(totals.totalCol3Expected)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {formatCurrency(totals.totalCol7Actual)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-black">
                        {formatCurrency(totals.totalCol4Banking)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs font-bold ${
                            totals.totalVariance < 0
                              ? 'bg-rose-100 border-rose-600 text-rose-800'
                              : totals.totalVariance > 0
                              ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                              : 'bg-zinc-100 border-zinc-300 text-black'
                          }`}
                        >
                          {totals.totalVariance < 0 ? (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          ) : totals.totalVariance > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-black shrink-0" />
                          )}
                          <span>{formatCurrency(totals.totalVariance, true)}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectRecord(rec.id)}
                            className="flex items-center gap-1 bg-black hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 border border-black transition-colors cursor-pointer"
                          >
                            Open
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            onClick={() => onDeleteRecord(rec.id)}
                            className="text-zinc-500 hover:text-rose-600 p-1.5 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
