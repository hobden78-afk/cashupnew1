import { GrandTotals, SheetRecord, TillRowData } from '../types';

/**
 * Format number as UK currency (£1,234.56)
 */
export function formatCurrency(amount: number, showSign: boolean = false): string {
  if (isNaN(amount)) amount = 0;
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = absAmount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `-£${formatted}`;
  }
  
  if (showSign && amount > 0) {
    return `+£${formatted}`;
  }

  return `£${formatted}`;
}

/**
 * Convert ISO YYYY-MM-DD to UK format DD/MM/YYYY
 */
export function formatToUKDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Convert UK format DD/MM/YYYY to ISO YYYY-MM-DD
 */
export function parseUKDateToISO(ukDateStr: string): string {
  if (!ukDateStr) return '';
  const parts = ukDateStr.split('/');
  if (parts.length !== 3) return ukDateStr;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

/**
 * Calculate line level expected total (Col 3)
 */
export function getRowExpectedTotal(row: TillRowData): number {
  if (row.isYard) return 0;
  return (row.col1ExpectedCash || 0) + (row.col2ExpectedCard || 0);
}

/**
 * Calculate line level actual total (Col 7: Banking Cash + Float Cash + Card Machine)
 */
export function getRowActualTotal(row: TillRowData): number {
  if (row.isYard) return 0;
  return (row.col4BankingCash || 0) + (row.col5FloatCash || 0) + (row.col6ActualCard || 0);
}

/**
 * Calculate line level variance (Col 8)
 * 
 * Account for Float:
 * Total Counted in drawer (Col 7) = Banking Cash (Col 4) + Float Cash (Col 5) + Card (Col 6).
 * Expected System Sales (Col 3) = System Cash (Col 1) + System Card (Col 2).
 * Opening Float = Previous Day Float or current row float.
 * 
 * Variance = Counted Total (Col 7) - System Sales (Col 3) - Opening Float.
 */
export function getRowVariance(
  row: TillRowData,
  record?: SheetRecord,
  allRecords: SheetRecord[] = []
): number {
  if (row.isYard) {
    return row.customVariance || 0;
  }
  const actual = getRowActualTotal(row);
  const expected = getRowExpectedTotal(row);

  let openingFloat = 0;
  if (record) {
    openingFloat = getYesterdayFloat(row, record, allRecords);
  }
  if (!openingFloat) {
    openingFloat = row.prevFloat ?? row.col5FloatCash ?? 0;
  }

  return Number((actual - expected - openingFloat).toFixed(2));
}

/**
 * Compute grand totals for a full sheet record
 */
export function calculateGrandTotals(
  rows: TillRowData[],
  record?: SheetRecord,
  allRecords: SheetRecord[] = []
): GrandTotals {
  let totalCol1Cash = 0;
  let totalCol2Card = 0;
  let totalCol3Expected = 0;
  let totalCol4Banking = 0;
  let totalCol5Float = 0;
  let totalCol6Card = 0;
  let totalCol7Actual = 0;

  for (const row of rows) {
    if (row.isYard) {
      continue;
    }
    
    totalCol1Cash += row.col1ExpectedCash || 0;
    totalCol2Card += row.col2ExpectedCard || 0;
    totalCol3Expected += getRowExpectedTotal(row);

    totalCol4Banking += row.col4BankingCash || 0;
    totalCol5Float += row.col5FloatCash || 0;
    totalCol6Card += row.col6ActualCard || 0;
    totalCol7Actual += getRowActualTotal(row);
  }

  // The total variance is the sum of Cell 8 (getRowVariance) for all rows
  const totalVariance = rows.reduce(
    (sum, row) => sum + getRowVariance(row, record, allRecords),
    0
  );

  return {
    totalCol1Cash: Number(totalCol1Cash.toFixed(2)),
    totalCol2Card: Number(totalCol2Card.toFixed(2)),
    totalCol3Expected: Number(totalCol3Expected.toFixed(2)),
    totalCol4Banking: Number(totalCol4Banking.toFixed(2)),
    totalCol5Float: Number(totalCol5Float.toFixed(2)),
    totalCol6Card: Number(totalCol6Card.toFixed(2)),
    totalCol7Actual: Number(totalCol7Actual.toFixed(2)),
    totalVariance: Number(totalVariance.toFixed(2)),
  };
}

/**
 * Sort records strictly by date descending (newest date first).
 * Fallback to createdAt descending if dates match.
 */
export function sortRecordsByDate(records: SheetRecord[]): SheetRecord[] {
  return [...records].sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

/**
 * Generate CSV string for export
 */
export function exportRecordToCSV(record: SheetRecord, allRecords: SheetRecord[] = []): string {
  const totals = calculateGrandTotals(record.rows, record, allRecords);
  const ukDate = formatToUKDate(record.date);

  const headers = [
    'Till Name',
    'Exp Cash (Col 1)',
    'Exp Card (Col 2)',
    'Exp Total (Col 3)',
    'Banking Cash (Col 4)',
    'Float Cash (Col 5)',
    'Actual Card (Col 6)',
    'Actual Total (Col 7)',
    'Variance (Col 8)',
  ];

  const lines: string[] = [
    `Daily Till Cashing Up Sheet - Date: ${ukDate}${record.operator ? ` - Operator: ${record.operator}` : ''}`,
    `Saved Status: ${record.isSaved ? 'Saved (Locked)' : 'Draft'}`,
    record.operator ? `Operator: ${record.operator}` : '',
    '',
    headers.join(','),
  ].filter(line => line !== undefined);

  for (const row of record.rows) {
    if (row.isYard) {
      lines.push(`"${row.name}",,,,,,,,"${row.customVariance || 0}"`);
      continue;
    }
    const expTotal = getRowExpectedTotal(row);
    const actTotal = getRowActualTotal(row);
    const variance = getRowVariance(row, record, allRecords);

    lines.push([
      `"${row.name}"`,
      row.col1ExpectedCash.toFixed(2),
      row.col2ExpectedCard.toFixed(2),
      expTotal.toFixed(2),
      row.col4BankingCash.toFixed(2),
      row.col5FloatCash.toFixed(2),
      row.col6ActualCard.toFixed(2),
      actTotal.toFixed(2),
      variance.toFixed(2),
    ].join(','));
  }

  lines.push([
    '"TOTALS"',
    totals.totalCol1Cash.toFixed(2),
    totals.totalCol2Card.toFixed(2),
    totals.totalCol3Expected.toFixed(2),
    totals.totalCol4Banking.toFixed(2),
    totals.totalCol5Float.toFixed(2),
    totals.totalCol6Card.toFixed(2),
    totals.totalCol7Actual.toFixed(2),
    totals.totalVariance.toFixed(2),
  ].join(','));

  if (record.notes) {
    lines.push('');
    lines.push(`"Notes: ${record.notes.replace(/"/g, '""')}"`);
  }

  return lines.join('\n');
}

/**
 * Recalculate ALL records in the database sequentially and mathematically.
 * 
 * 1. Sorts chronologically (earliest to newest).
 * 2. Cascades each day's float (col 5) into the next day's opening float (prevFloat).
 * 3. Ensures 2-decimal precision on all numeric inputs.
 * 4. Ensures Card PDQ (Col 6) is synchronized with Expected Card (Col 2).
 * 5. Recomputes all row totals, actual totals, and variances.
 * 6. Returns records sorted descending by date for UI presentation.
 */
export function recalculateAllRecords(records: SheetRecord[]): SheetRecord[] {
  if (!records || records.length === 0) return [];

  // Sort chronological ascending (earliest day first)
  const chronological = [...records].sort((a, b) => {
    const dDiff = (a.date || '').localeCompare(b.date || '');
    if (dDiff !== 0) return dDiff;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const recalculated: SheetRecord[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const rec = chronological[i];
    const prevRec = i > 0 ? recalculated[i - 1] : undefined;

    // Ensure all standard tills exist in the record (including Till 5)
    let currentRows = [...(rec.rows || [])];
    const hasTill5 = currentRows.some(
      (r) => r.id === 'till-5' || (r.name && r.name.toLowerCase() === 'till 5')
    );
    if (!hasTill5) {
      const till5Row: TillRowData = {
        id: 'till-5',
        name: 'Till 5',
        col1ExpectedCash: 0,
        col2ExpectedCard: 0,
        col4BankingCash: 0,
        col5FloatCash: 0,
        col6ActualCard: 0,
      };
      const yardIdx = currentRows.findIndex((r) => r.isYard);
      if (yardIdx !== -1) {
        currentRows.splice(yardIdx, 0, till5Row);
      } else {
        currentRows.push(till5Row);
      }
    }

    const updatedRows = currentRows.map((row) => {
      if (row.isYard) {
        return {
          ...row,
          customVariance: Number(Number(row.customVariance || 0).toFixed(2)),
          col1ExpectedCash: 0,
          col2ExpectedCard: 0,
          col4BankingCash: 0,
          col5FloatCash: 0,
          col6ActualCard: 0,
        };
      }

      const col1Cash = Number(Number(row.col1ExpectedCash || 0).toFixed(2));
      const col2Card = Number(Number(row.col2ExpectedCard || 0).toFixed(2));
      const col4Banking = Number(Number(row.col4BankingCash || 0).toFixed(2));
      const col5Float = Number(Number(row.col5FloatCash || 0).toFixed(2));
      // Card Machine PDQ (Col 6) equals System Card (Col 2) in this reconciliation logic
      const col6Card = row.col6ActualCard !== undefined && row.col6ActualCard !== 0 
        ? Number(Number(row.col6ActualCard).toFixed(2)) 
        : col2Card;

      let prevFloat = row.prevFloat;
      if (prevRec && prevRec.rows) {
        const prevRow = prevRec.rows.find(
          (pr) => pr.id === row.id || (pr.name && row.name && pr.name.toLowerCase() === row.name.toLowerCase())
        );
        if (prevRow) {
          prevFloat = Number(Number(prevRow.col5FloatCash || 0).toFixed(2));
        }
      }

      return {
        ...row,
        col1ExpectedCash: col1Cash,
        col2ExpectedCard: col2Card,
        col4BankingCash: col4Banking,
        col5FloatCash: col5Float,
        col6ActualCard: col6Card,
        prevFloat: prevFloat !== undefined ? Number(Number(prevFloat).toFixed(2)) : undefined,
      };
    });

    recalculated.push({
      ...rec,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });
  }

  // Return sorted descending (newest first)
  return sortRecordsByDate(recalculated);
}

/**
 * Download CSV file trigger
 */
export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get start (Monday) and end (Sunday) dates for a calendar week given an ISO YYYY-MM-DD date
 */
export function getWeekStartAndEnd(dateStr: string): {
  mondayISO: string;
  sundayISO: string;
  mondayUK: string;
  sundayUK: string;
  label: string;
} {
  const parts = dateStr.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue ... 6 is Sat

  // Distance to Monday: if Sunday (0), go back 6 days. Otherwise, go back (dayOfWeek - 1) days.
  const diffToMonday = date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const monday = new Date(year, month, diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const formatUK = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${dd}/${m}/${y}`;
  };

  const mondayISO = formatISO(monday);
  const sundayISO = formatISO(sunday);
  const mondayUK = formatUK(monday);
  const sundayUK = formatUK(sunday);

  return {
    mondayISO,
    sundayISO,
    mondayUK,
    sundayUK,
    label: `Mon ${mondayUK} – Sun ${sundayUK}`,
  };
}

export interface WeekGroup {
  mondayISO: string;
  sundayISO: string;
  mondayUK: string;
  sundayUK: string;
  label: string;
  records: SheetRecord[];
}

/**
 * Group records by Monday-to-Sunday calendar weeks
 */
export function groupRecordsByCalendarWeek(records: SheetRecord[]): WeekGroup[] {
  const groupsMap = new Map<string, WeekGroup>();

  // Ensure current calendar week is represented even if no records exist
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentWeekInfo = getWeekStartAndEnd(todayStr);
  groupsMap.set(currentWeekInfo.mondayISO, {
    ...currentWeekInfo,
    records: [],
  });

  records.forEach((rec) => {
    const info = getWeekStartAndEnd(rec.date);
    if (!groupsMap.has(info.mondayISO)) {
      groupsMap.set(info.mondayISO, {
        ...info,
        records: [],
      });
    }
    groupsMap.get(info.mondayISO)!.records.push(rec);
  });

  // Sort weeks descending by Monday ISO (latest week first)
  const sortedWeeks = Array.from(groupsMap.values()).sort((a, b) => {
    return b.mondayISO.localeCompare(a.mondayISO);
  });

  // Sort records within each week chronologically (Monday to Sunday)
  sortedWeeks.forEach((week) => {
    week.records = sortRecordsByDate(week.records).reverse();
  });

  return sortedWeeks;
}

/**
 * Get day of week name (e.g., "Monday", "Tuesday") from ISO date
 */
export function getDayOfWeekName(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d.getDay()];
}

/**
 * Helper to get yesterday's float for a specific row/till in a record.
 * Uses row.prevFloat if explicitly set, otherwise looks up previous record's col5FloatCash.
 */
export function getYesterdayFloat(
  row: TillRowData,
  record: SheetRecord,
  allRecords: SheetRecord[] = []
): number {
  if (row.prevFloat !== undefined) {
    return row.prevFloat;
  }
  if (!allRecords || allRecords.length === 0) return 0;
  const sorted = sortRecordsByDate(allRecords);
  const prevRecord = sorted.find((r) => r.date < record.date);
  if (!prevRecord) return 0;
  const prevRow = prevRecord.rows.find(
    (pr) => pr.id === row.id || pr.name === row.name || (pr.name && row.name && pr.name.toLowerCase() === row.name.toLowerCase())
  );
  return prevRow ? prevRow.col5FloatCash || 0 : 0;
}

/**
 * Get Financial Year for a date string (YYYY-MM-DD)
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @param format 'calendar' | 'uk_tax'
 */
export function getFinancialYear(dateStr: string, format: 'calendar' | 'uk_tax' = 'calendar'): string {
  if (!dateStr || !dateStr.includes('-')) return '';
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year)) return '';

  if (format === 'calendar') {
    return String(year);
  }

  // UK Tax / Financial Year runs from 6th April to 5th April
  if (month < 4 || (month === 4 && day < 6)) {
    const startYr = year - 1;
    const endYrShort = String(year).slice(-2);
    return `FY ${startYr}/${endYrShort}`;
  } else {
    const nextYrShort = String(year + 1).slice(-2);
    return `FY ${year}/${nextYrShort}`;
  }
}

/**
 * Extract distinct financial years present in records list
 */
export function getAvailableFinancialYears(
  records: SheetRecord[],
  format: 'calendar' | 'uk_tax' = 'calendar'
): string[] {
  const yearsSet = new Set<string>();

  // Always include key baseline years
  if (format === 'calendar') {
    yearsSet.add('2025');
    yearsSet.add('2026');
  } else {
    yearsSet.add('FY 2024/25');
    yearsSet.add('FY 2025/26');
    yearsSet.add('FY 2026/27');
  }

  records.forEach((r) => {
    if (r.date) {
      const fy = getFinancialYear(r.date, format);
      if (fy) yearsSet.add(fy);
    }
  });

  return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Filter records by selected financial year
 */
export function filterRecordsByFinancialYear(
  records: SheetRecord[],
  selectedYear: string,
  format: 'calendar' | 'uk_tax' = 'calendar'
): SheetRecord[] {
  if (!selectedYear || selectedYear === 'all' || selectedYear === 'ALL') {
    return records;
  }

  return records.filter((r) => {
    if (!r.date) return false;
    const fy = getFinancialYear(r.date, format);
    return fy === selectedYear || r.date.startsWith(selectedYear);
  });
}


