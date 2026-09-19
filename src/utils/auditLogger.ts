import { AuditActionType, AuditChangeDetail, AuditLogEntry, SheetRecord } from '../types';
import { formatCurrency, formatToUKDate, downloadCSV } from './calculations';

/**
 * Generate a unique ID for an audit log entry
 */
export function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Compare two SheetRecord versions and produce a granular AuditLogEntry.
 * Returns null if no changes were detected.
 */
export function diffSheetRecords(
  prev: SheetRecord,
  next: SheetRecord,
  user: string,
  userEmail?: string
): AuditLogEntry | null {
  if (!prev || !next) return null;

  const changes: AuditChangeDetail[] = [];
  let actionType: AuditActionType = 'edit';

  // 1. Check lock status
  if (prev.isSaved !== next.isSaved) {
    actionType = next.isSaved ? 'lock' : 'unlock';
    changes.push({
      field: 'Audit Status',
      oldValue: prev.isSaved ? 'Locked & Verified' : 'Active / Draft',
      newValue: next.isSaved ? 'Locked & Verified' : 'Active / Draft',
    });
  }

  // 2. Check cashier / operator
  if ((prev.operator || '') !== (next.operator || '')) {
    changes.push({
      field: 'Cashier / Operator',
      oldValue: prev.operator || 'Unassigned',
      newValue: next.operator || 'Unassigned',
    });
  }

  // 3. Check date
  if (prev.date !== next.date) {
    changes.push({
      field: 'Sheet Date',
      oldValue: formatToUKDate(prev.date),
      newValue: formatToUKDate(next.date),
    });
  }

  // 4. Check notes
  if ((prev.notes || '').trim() !== (next.notes || '').trim()) {
    changes.push({
      field: 'Shift Audit Notes',
      oldValue: prev.notes ? (prev.notes.length > 30 ? prev.notes.slice(0, 27) + '...' : prev.notes) : 'Empty',
      newValue: next.notes ? (next.notes.length > 30 ? next.notes.slice(0, 27) + '...' : next.notes) : 'Empty',
    });
  }

  // 5. Check row numbers
  const prevRowsMap = new Map((prev.rows || []).map((r) => [r.id, r]));
  (next.rows || []).forEach((nextRow) => {
    const prevRow = prevRowsMap.get(nextRow.id) || (prev.rows || []).find((r) => r.name === nextRow.name);
    const rowName = nextRow.name || 'Till';

    if (prevRow) {
      // col1ExpectedCash
      if (Math.abs(prevRow.col1ExpectedCash - nextRow.col1ExpectedCash) > 0.001) {
        const delta = nextRow.col1ExpectedCash - prevRow.col1ExpectedCash;
        changes.push({
          field: `${rowName} Expected Cash`,
          oldValue: formatCurrency(prevRow.col1ExpectedCash),
          newValue: formatCurrency(nextRow.col1ExpectedCash),
          delta: formatCurrency(delta, true),
        });
      }

      // col2ExpectedCard
      if (Math.abs(prevRow.col2ExpectedCard - nextRow.col2ExpectedCard) > 0.001) {
        const delta = nextRow.col2ExpectedCard - prevRow.col2ExpectedCard;
        changes.push({
          field: `${rowName} System Card Takings`,
          oldValue: formatCurrency(prevRow.col2ExpectedCard),
          newValue: formatCurrency(nextRow.col2ExpectedCard),
          delta: formatCurrency(delta, true),
        });
      }

      // col4BankingCash
      if (Math.abs(prevRow.col4BankingCash - nextRow.col4BankingCash) > 0.001) {
        const delta = nextRow.col4BankingCash - prevRow.col4BankingCash;
        changes.push({
          field: `${rowName} Cash Banked`,
          oldValue: formatCurrency(prevRow.col4BankingCash),
          newValue: formatCurrency(nextRow.col4BankingCash),
          delta: formatCurrency(delta, true),
        });
      }

      // col5FloatCash
      if (Math.abs(prevRow.col5FloatCash - nextRow.col5FloatCash) > 0.001) {
        const delta = nextRow.col5FloatCash - prevRow.col5FloatCash;
        changes.push({
          field: `${rowName} Float Cash`,
          oldValue: formatCurrency(prevRow.col5FloatCash),
          newValue: formatCurrency(nextRow.col5FloatCash),
          delta: formatCurrency(delta, true),
        });
      }

      // col6ActualCard
      if (Math.abs(prevRow.col6ActualCard - nextRow.col6ActualCard) > 0.001) {
        const delta = nextRow.col6ActualCard - prevRow.col6ActualCard;
        changes.push({
          field: `${rowName} Card PDQ Machine`,
          oldValue: formatCurrency(prevRow.col6ActualCard),
          newValue: formatCurrency(nextRow.col6ActualCard),
          delta: formatCurrency(delta, true),
        });
      }

      // customVariance
      if (Math.abs((prevRow.customVariance || 0) - (nextRow.customVariance || 0)) > 0.001) {
        const delta = (nextRow.customVariance || 0) - (prevRow.customVariance || 0);
        changes.push({
          field: `${rowName} Variance Override`,
          oldValue: formatCurrency(prevRow.customVariance || 0),
          newValue: formatCurrency(nextRow.customVariance || 0),
          delta: formatCurrency(delta, true),
        });
      }
    }
  });

  if (changes.length === 0) {
    return null;
  }

  // Generate a high-contrast readable summary
  let summary = '';
  if (actionType === 'lock') {
    summary = `Locked & verified daily audit sheet for ${formatToUKDate(next.date)}`;
  } else if (actionType === 'unlock') {
    summary = `Unlocked cashing sheet for ${formatToUKDate(next.date)} for revisions`;
  } else if (changes.length === 1) {
    const c = changes[0];
    if (c.delta) {
      summary = `Updated ${c.field}: ${c.oldValue} → ${c.newValue} (${c.delta})`;
    } else {
      summary = `Changed ${c.field}: "${c.oldValue}" → "${c.newValue}"`;
    }
  } else {
    const fieldTitles = changes.map((c) => c.field.split(' ')[0]);
    const uniqueFields = Array.from(new Set(fieldTitles)).join(', ');
    summary = `Updated ${changes.length} fields on ${formatToUKDate(next.date)} (${uniqueFields})`;
  }

  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    recordId: next.id,
    recordDate: next.date,
    user: user || 'Operator',
    userEmail,
    actionType,
    summary,
    changes,
  };
}

/**
 * Helper to create an audit entry when a new sheet record is created
 */
export function createRecordAuditEntry(
  record: SheetRecord,
  user: string,
  userEmail?: string
): AuditLogEntry {
  const carriedFloat = (record.rows || []).reduce((sum, r) => sum + (r.col1ExpectedCash || 0), 0);
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    recordId: record.id,
    recordDate: record.date,
    user: user || 'Operator',
    userEmail,
    actionType: 'create',
    summary: `Created new daily cashing sheet for ${formatToUKDate(record.date)} (${record.operator ? `Assigned: ${record.operator}` : 'Unassigned'})`,
    changes: [
      {
        field: 'Cashier / Operator',
        oldValue: 'None',
        newValue: record.operator || 'Unassigned',
      },
      {
        field: 'Initial Float Cascade',
        oldValue: '£0.00',
        newValue: formatCurrency(carriedFloat),
        delta: `+${formatCurrency(carriedFloat)}`,
      },
    ],
  };
}

/**
 * Helper to create an audit entry when a sheet record is deleted
 */
export function deleteRecordAuditEntry(
  record: SheetRecord,
  user: string,
  userEmail?: string
): AuditLogEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    recordId: record.id,
    recordDate: record.date,
    user: user || 'Operator',
    userEmail,
    actionType: 'delete',
    summary: `Deleted daily cashing sheet for ${formatToUKDate(record.date)} (ID: ${record.id})`,
    changes: [
      {
        field: 'Deleted Record Date',
        oldValue: formatToUKDate(record.date),
        newValue: 'Deleted from Archive',
      },
      {
        field: 'Assigned Operator',
        oldValue: record.operator || 'None',
        newValue: 'None',
      },
    ],
  };
}

/**
 * Helper for recalculation of all sheets
 */
export function recalculateAuditEntry(
  recordCount: number,
  user: string,
  userEmail?: string
): AuditLogEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    recordId: 'system',
    recordDate: new Date().toISOString().split('T')[0],
    user: user || 'Manager / Supervisor',
    userEmail,
    actionType: 'recalculate',
    summary: `Sequentially recalculated float cascades across all ${recordCount} archive records`,
  };
}

/**
 * Helper for restoring JSON backups
 */
export function restoreBackupAuditEntry(
  recordCount: number,
  user: string,
  userEmail?: string
): AuditLogEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    recordId: 'system',
    recordDate: new Date().toISOString().split('T')[0],
    user: user || 'Manager / Supervisor',
    userEmail,
    actionType: 'restore',
    summary: `Restored database backup containing ${recordCount} daily cashing sheets`,
  };
}

/**
 * Format timestamp into human-readable strings
 */
export function formatAuditTimestamp(isoString: string): {
  formattedDate: string;
  timeStr: string;
  relativeStr: string;
} {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { formattedDate: isoString, timeStr: '', relativeStr: '' };
    }

    const ukDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeStr = '';
    if (diffSec < 45) {
      relativeStr = 'Just now';
    } else if (diffMin < 60) {
      relativeStr = `${diffMin}m ago`;
    } else if (diffHours < 24) {
      relativeStr = `${diffHours}h ago`;
    } else if (diffDays === 1) {
      relativeStr = `Yesterday at ${timeStr.slice(0, 5)}`;
    } else if (diffDays < 7) {
      relativeStr = `${diffDays} days ago`;
    } else {
      relativeStr = ukDate;
    }

    return { formattedDate: ukDate, timeStr, relativeStr };
  } catch {
    return { formattedDate: isoString, timeStr: '', relativeStr: '' };
  }
}

/**
 * Export audit logs array to CSV file
 */
export function exportAuditLogsToCSV(logs: AuditLogEntry[]): void {
  const headers = [
    'Audit ID',
    'Timestamp (UTC)',
    'UK Date/Time',
    'Record Date',
    'User / Operator',
    'User Email',
    'Action Type',
    'Summary',
    'Granular Changes Count',
    'Detailed Changes List',
  ];

  const rows = logs.map((log) => {
    const { formattedDate, timeStr } = formatAuditTimestamp(log.timestamp);
    const changesText = (log.changes || [])
      .map(
        (c) =>
          `[${c.field}: ${c.oldValue} -> ${c.newValue}${c.delta ? ` (${c.delta})` : ''}]`
      )
      .join('; ');

    return [
      log.id,
      log.timestamp,
      `"${formattedDate} ${timeStr}"`,
      formatToUKDate(log.recordDate),
      `"${(log.user || 'Unknown').replace(/"/g, '""')}"`,
      `"${(log.userEmail || '').replace(/"/g, '""')}"`,
      log.actionType.toUpperCase(),
      `"${(log.summary || '').replace(/"/g, '""')}"`,
      log.changes ? log.changes.length : 0,
      `"${changesText.replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const now = new Date().toISOString().split('T')[0];
  downloadCSV(`DailyTill_Audit_Log_${now}.csv`, csvContent);
}
