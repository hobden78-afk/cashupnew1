import React, { useState, useMemo } from 'react';
import { AuditActionType, AuditLogEntry, SheetRecord } from '../types';
import { formatToUKDate } from '../utils/calculations';
import {
  formatAuditTimestamp,
  exportAuditLogsToCSV,
} from '../utils/auditLogger';
import {
  Search,
  ArrowLeft,
  Download,
  Printer,
  Calendar,
  User,
  ShieldCheck,
  Edit3,
  PlusCircle,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  FileText,
  Clock,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  records: SheetRecord[];
  onBackToSheet: () => void;
  onSelectRecord: (recordId: string) => void;
  onClearHistory?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs,
  records,
  onBackToSheet,
  onSelectRecord,
  onClearHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | AuditActionType>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Distinct users in logs
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.user) set.add(l.user);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Distinct record dates in logs
  const distinctRecordDates = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.recordDate && l.recordDate !== 'system') set.add(l.recordDate);
    });
    return Array.from(set).sort().reverse();
  }, [logs]);

  // Filtered and chronologically sorted logs (newest first)
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        // Search term matching
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchUser = (log.user || '').toLowerCase().includes(q);
          const matchEmail = (log.userEmail || '').toLowerCase().includes(q);
          const matchSummary = (log.summary || '').toLowerCase().includes(q);
          const matchDate = (log.recordDate || '').toLowerCase().includes(q);
          const matchUKDate = formatToUKDate(log.recordDate).toLowerCase().includes(q);
          const matchChanges = (log.changes || []).some(
            (c) =>
              c.field.toLowerCase().includes(q) ||
              c.oldValue.toLowerCase().includes(q) ||
              c.newValue.toLowerCase().includes(q)
          );
          if (!matchUser && !matchEmail && !matchSummary && !matchDate && !matchUKDate && !matchChanges) {
            return false;
          }
        }

        // Action filter
        if (actionFilter !== 'all' && log.actionType !== actionFilter) {
          return false;
        }

        // User filter
        if (userFilter !== 'all' && log.user !== userFilter) {
          return false;
        }

        // Date filter
        if (dateFilter !== 'all' && log.recordDate !== dateFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, searchTerm, actionFilter, userFilter, dateFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const edits = logs.filter((l) => l.actionType === 'edit').length;
    const locks = logs.filter((l) => l.actionType === 'lock').length;
    const creations = logs.filter((l) => l.actionType === 'create').length;
    return { total, edits, locks, creations };
  }, [logs]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenSheetForLog = (log: AuditLogEntry) => {
    if (!log.recordDate || log.recordDate === 'system') return;
    // Find record by ID or by date
    const target =
      records.find((r) => r.id === log.recordId) ||
      records.find((r) => r.date === log.recordDate);
    if (target) {
      onSelectRecord(target.id);
    }
  };

  const getActionBadge = (actionType: AuditActionType) => {
    switch (actionType) {
      case 'lock':
        return {
          label: 'LOCKED & VERIFIED',
          icon: <Lock className="w-3 h-3 text-emerald-700" />,
          bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        };
      case 'unlock':
        return {
          label: 'UNLOCKED',
          icon: <Unlock className="w-3 h-3 text-amber-700" />,
          bgColor: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      case 'create':
        return {
          label: 'CREATED',
          icon: <PlusCircle className="w-3 h-3 text-blue-700" />,
          bgColor: 'bg-blue-50 text-blue-800 border-blue-300',
        };
      case 'delete':
        return {
          label: 'DELETED',
          icon: <Trash2 className="w-3 h-3 text-rose-700" />,
          bgColor: 'bg-rose-50 text-rose-800 border-rose-300',
        };
      case 'restore':
        return {
          label: 'RESTORED',
          icon: <RotateCcw className="w-3 h-3 text-purple-700" />,
          bgColor: 'bg-purple-50 text-purple-800 border-purple-300',
        };
      case 'recalculate':
        return {
          label: 'CASCADE RECALC',
          icon: <RefreshCw className="w-3 h-3 text-indigo-700" />,
          bgColor: 'bg-indigo-50 text-indigo-800 border-indigo-300',
        };
      case 'edit':
      default:
        return {
          label: 'EDITED',
          icon: <Edit3 className="w-3 h-3 text-amber-700" />,
          bgColor: 'bg-amber-50 text-amber-900 border-amber-300',
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border-2 border-black p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={onBackToSheet}
                className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 hover:text-black uppercase tracking-wider transition-colors cursor-pointer mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Cashing Sheet</span>
              </button>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black text-amber-400 rounded-xs">
                Auditing &amp; Compliance
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-zinc-950 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-amber-500 shrink-0" />
              <span>System Audit Log</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-3xl mt-1">
              Complete immutable revision history tracking all record creations, cashier reassignments,
              till float balance revisions, and supervisor locking events.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => exportAuditLogsToCSV(filteredLogs)}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider border border-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Download filtered audit history as CSV spreadsheet"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold uppercase tracking-wider border border-black shadow-xs transition-all cursor-pointer"
              title="Print official audit ledger"
            >
              <Printer className="w-4 h-4" />
              <span>Print Audit Log</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-6 pt-5 border-t border-zinc-200">
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Total Logged Events</span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-zinc-900 mt-0.5">{metrics.total}</div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Till Revisions &amp; Edits</span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-amber-900 mt-0.5">{metrics.edits}</div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Audit Sign-Offs (Locked)</span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-900 mt-0.5">{metrics.locks}</div>
          </div>
          <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">Sheets Created</span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-blue-900 mt-0.5">{metrics.creations}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border-2 border-black p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by operator, record date, summary, or altered field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-300 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-black focus:bg-white transition-colors"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* User Filter */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 px-2 py-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Operators &amp; Users</option>
                {distinctUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 px-2 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Sheet Dates</option>
                {distinctRecordDates.map((dateStr) => (
                  <option key={dateStr} value={dateStr}>
                    {formatToUKDate(dateStr)}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || actionFilter !== 'all' || userFilter !== 'all' || dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActionFilter('all');
                  setUserFilter('all');
                  setDateFilter('all');
                }}
                className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold uppercase tracking-wider border border-zinc-300 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Action Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Event:</span>
          </span>

          <button
            onClick={() => setActionFilter('all')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'all'
                ? 'bg-black text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All Events ({logs.length})
          </button>

          <button
            onClick={() => setActionFilter('edit')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'edit'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Edits ({logs.filter((l) => l.actionType === 'edit').length})
          </button>

          <button
            onClick={() => setActionFilter('lock')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'lock'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Locked / Sign-offs ({logs.filter((l) => l.actionType === 'lock').length})
          </button>

          <button
            onClick={() => setActionFilter('create')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Creations ({logs.filter((l) => l.actionType === 'create').length})
          </button>

          <button
            onClick={() => setActionFilter('delete')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'delete'
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Deletions ({logs.filter((l) => l.actionType === 'delete').length})
          </button>

          <button
            onClick={() => setActionFilter('recalculate')}
            className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer ${
              actionFilter === 'recalculate'
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Recalculations ({logs.filter((l) => l.actionType === 'recalculate').length})
          </button>
        </div>
      </div>

      {/* Showing count */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <span>
          Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> audit events
        </span>
        <span className="text-[11px] font-mono">Sorted: Newest First</span>
      </div>

      {/* Chronological List of Audit Log Cards */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border-2 border-black p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800">No matching audit events</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            Try adjusting your search criteria or resetting the active filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const { formattedDate, timeStr, relativeStr } = formatAuditTimestamp(log.timestamp);
            const badge = getActionBadge(log.actionType);
            const hasChanges = log.changes && log.changes.length > 0;
            const isExpanded = expandedLogIds.has(log.id);

            // Check if record exists
            const recordExists =
              log.recordDate &&
              log.recordDate !== 'system' &&
              records.some((r) => r.id === log.recordId || r.date === log.recordDate);

            // User initial
            const userInitial = (log.user || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={log.id}
                className="bg-white border-2 border-black shadow-xs hover:shadow-md transition-shadow"
              >
                {/* Header Row */}
                <div className="p-3.5 sm:p-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: User + Action Badge + Record Date */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* User Avatar Pill */}
                    <div className="flex items-center gap-2 bg-zinc-100 border border-zinc-300 pl-1 pr-2.5 py-0.5 rounded-full">
                      <div className="w-5 h-5 rounded-full bg-zinc-900 text-amber-400 flex items-center justify-center text-[10px] font-bold font-mono">
                        {userInitial}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-900 leading-tight">
                          {log.user}
                        </span>
                        {log.userEmail && (
                          <span className="text-[10px] text-zinc-500 leading-none">
                            {log.userEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Type Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${badge.bgColor}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    {/* Associated Record Date Badge */}
                    {log.recordDate && log.recordDate !== 'system' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-300">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        <span>Sheet: {formatToUKDate(log.recordDate)}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Timestamp */}
                  <div className="flex items-center gap-2 text-right self-end sm:self-auto">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs font-mono font-bold text-zinc-900">
                        {formattedDate} {timeStr}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{relativeStr}</span>
                      </span>
                    </div>

                    {/* Jump to sheet button */}
                    {recordExists && (
                      <button
                        onClick={() => handleOpenSheetForLog(log)}
                        className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 border border-transparent hover:border-zinc-300 rounded-xs transition-colors cursor-pointer print:hidden ml-1"
                        title={`Open cashing sheet for ${formatToUKDate(log.recordDate)}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Row */}
                <div className="p-3.5 sm:p-4 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-zinc-900">
                      {log.summary}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-400">
                      Audit Event ID: {log.id}
                    </p>
                  </div>

                  {/* Toggle Granular Changes button */}
                  {hasChanges && (
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors cursor-pointer shrink-0"
                    >
                      <span>
                        {isExpanded ? 'Hide' : 'Inspect'} {log.changes?.length} Change{log.changes?.length === 1 ? '' : 's'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded Granular Changes Table */}
                {hasChanges && isExpanded && (
                  <div className="p-3.5 sm:p-4 border-t border-zinc-200 bg-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                      Granular Field Adjustments
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-zinc-200">
                        <thead className="bg-zinc-100 text-[10px] font-extrabold uppercase tracking-wider text-zinc-600 border-b border-zinc-200">
                          <tr>
                            <th className="p-2">Altered Field</th>
                            <th className="p-2">Previous Value</th>
                            <th className="p-2">Updated Value</th>
                            <th className="p-2">Variance / Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono">
                          {log.changes?.map((c, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="p-2 font-sans font-bold text-zinc-900">
                                {c.field}
                              </td>
                              <td className="p-2 text-rose-700 bg-rose-50/40">
                                <span className="line-through">{c.oldValue}</span>
                              </td>
                              <td className="p-2 text-emerald-700 font-bold bg-emerald-50/40">
                                {c.newValue}
                              </td>
                              <td className="p-2 font-bold text-zinc-700">
                                {c.delta ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded-xs text-[10px] ${
                                      c.delta.startsWith('+')
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : c.delta.startsWith('-')
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-zinc-100 text-zinc-800'
                                    }`}
                                  >
                                    {c.delta}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info & Verification Notice */}
      <div className="p-4 bg-zinc-100 border border-zinc-300 text-center text-xs text-zinc-600 space-y-1">
        <p className="font-bold text-zinc-800">
          Official Audit Ledger • Tamper-Evident Chronological Record
        </p>
        <p className="text-[11px] text-zinc-500">
          Changes made to daily till balances, cash floats, card machine PDQs, and staff assignments
          are automatically recorded and preserved for compliance.
        </p>
      </div>
    </div>
  );
};
