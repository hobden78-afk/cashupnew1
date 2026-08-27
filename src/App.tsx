import React, { useEffect, useState } from 'react';
import { ActiveTab, SheetRecord, ViewMode } from './types';
import {
  TrendingUp,
  Receipt,
  Scale,
  Coins,
  Calculator,
  History,
  BarChart3,
  LayoutGrid,
  Sparkles,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import {
  createBlankRows,
  DEFAULT_OPERATORS,
  INITIAL_RECORDS,
} from './data/initialData';
import {
  calculateGrandTotals,
  downloadCSV,
  exportRecordToCSV,
  formatCurrency,
  formatToUKDate,
  recalculateAllRecords,
  sortRecordsByDate,
  filterRecordsByFinancialYear,
} from './utils/calculations';
import { Header } from './components/Header';
import { DeltaSheetForm } from './components/DeltaSheetForm';
import { ModernSheetForm } from './components/ModernSheetForm';
import { RecordsList } from './components/RecordsList';
import { WeeklyReportView } from './components/WeeklyReportView';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { DateRangeReportModal } from './components/DateRangeReportModal';
import { BulkExportModal } from './components/BulkExportModal';
import { OperatorModal } from './components/OperatorModal';
import { FinancialYearFormat, FinancialYearSwitcher } from './components/FinancialYearSwitcher';
import { 
  db, 
  RECORDS_COLLECTION, 
  SETTINGS_COLLECTION, 
  OPERATORS_DOC,
  saveRecordToCloud, 
  saveRecordToCloudImmediately,
  deleteRecordFromCloud, 
  saveOperatorsToCloud, 
  syncAllRecordsToCloud 
} from './lib/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleSignIn, googleLogout } from './lib/googleAuth';

const STORAGE_KEY = 'delta_till_cashing_up_records_v1';
const OPERATORS_STORAGE_KEY = 'delta_till_operators_v1';
const DELETED_IDS_STORAGE_KEY = 'delta_till_deleted_records_v1';

export default function App() {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {}
    return new Set();
  });

  const [records, setRecords] = useState<SheetRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return recalculateAllRecords(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load records from localStorage:', err);
    }
    return recalculateAllRecords(INITIAL_RECORDS);
  });

  const [operators, setOperators] = useState<string[]>(() => {
    try {
      const savedOps = localStorage.getItem(OPERATORS_STORAGE_KEY);
      if (savedOps) {
        const parsedOps = JSON.parse(savedOps);
        if (Array.isArray(parsedOps) && parsedOps.length > 0) {
          return parsedOps;
        }
      }
    } catch (err) {
      console.error('Failed to load operators from localStorage:', err);
    }
    return DEFAULT_OPERATORS;
  });

  const [activeRecordId, setActiveRecordId] = useState<string>(() => {
    return records[0]?.id || 'rec-2026-08-01';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [activeTab, setActiveTab] = useState<ActiveTab>('sheet');
  const [isHeaderHiddenOnSheet, setIsHeaderHiddenOnSheet] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('delta_till_hide_header_on_sheet_v1');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true; // Main header disappears by default when entering or editing daily record
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('delta_till_hide_header_on_sheet_v1', JSON.stringify(isHeaderHiddenOnSheet));
    } catch (e) {}
  }, [isHeaderHiddenOnSheet]);

  // Financial Year Filter & Format States
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('delta_till_selected_fy_v1');
      if (saved) return saved;
    } catch (e) {}
    return 'all';
  });

  const [financialYearFormat, setFinancialYearFormat] = useState<FinancialYearFormat>(() => {
    try {
      const saved = localStorage.getItem('delta_till_fy_format_v1');
      if (saved === 'calendar' || saved === 'uk_tax') return saved;
    } catch (e) {}
    return 'calendar';
  });

  useEffect(() => {
    try {
      localStorage.setItem('delta_till_selected_fy_v1', selectedFinancialYear);
    } catch (e) {}
  }, [selectedFinancialYear]);

  useEffect(() => {
    try {
      localStorage.setItem('delta_till_fy_format_v1', financialYearFormat);
    } catch (e) {}
  }, [financialYearFormat]);

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRangeReportOpen, setIsRangeReportOpen] = useState(false);
  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'connecting' | 'offline' | 'error'>('connecting');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    recordId?: string;
    dateStr?: string;
    isOnlyRecord?: boolean;
  }>({ isOpen: false });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        showToast(`Logged in as ${res.user.displayName || res.user.email}`);
      }
    } catch (err: any) {
      showToast(`Login notice: ${err?.message || 'Authentication cancelled'}`);
    }
  };

  const handleLogout = async () => {
    try {
      await googleLogout();
      setAuthUser(null);
      showToast('Logged out successfully');
    } catch (err: any) {
      showToast(`Logout error: ${err?.message || 'Failed to log out'}`);
    }
  };

  // 1. Subscribe to Firebase Firestore real-time updates for Till Records
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let isInitialCloudSeedAttempted = false;

    try {
      setCloudStatus('connecting');
      unsub = onSnapshot(
        collection(db, RECORDS_COLLECTION),
        (snapshot) => {
          setCloudStatus('connected');

          // Read deleted IDs set
          let currentDeletedIds = new Set<string>();
          try {
            const savedDel = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
            if (savedDel) {
              const parsed = JSON.parse(savedDel);
              if (Array.isArray(parsed)) currentDeletedIds = new Set(parsed);
            }
          } catch (e) {}

          const cloudRecords: SheetRecord[] = [];
          snapshot.forEach((docSnap) => {
            const rec = docSnap.data() as SheetRecord;
            if (rec && rec.id && !currentDeletedIds.has(rec.id)) {
              cloudRecords.push(rec);
            }
          });

          if (cloudRecords.length > 0) {
            // Cloud is the single source of truth for multi-user sync.
            // Recalculate sequentially to maintain exact float cascades & balance fidelity
            const sortedCloud = recalculateAllRecords(cloudRecords);
            setRecords(sortedCloud);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedCloud));
            } catch (e) {}
          } else {
            // If Cloud collection is completely empty, seed INITIAL_RECORDS once
            if (!isInitialCloudSeedAttempted) {
              isInitialCloudSeedAttempted = true;
              const initialRecalculated = recalculateAllRecords(INITIAL_RECORDS);
              syncAllRecordsToCloud(initialRecalculated);
              setRecords(initialRecalculated);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(initialRecalculated));
              } catch (e) {}
            }
          }
        },
        (err) => {
          console.warn('Firestore records sync notice:', err?.message || err);
          setCloudStatus('offline');
        }
      );
    } catch (err) {
      console.warn('Firestore subscription notice:', err);
      setCloudStatus('offline');
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 2. Subscribe to Firebase Firestore real-time updates for Operators list
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let seededOps = false;

    try {
      unsub = onSnapshot(
        doc(db, SETTINGS_COLLECTION, OPERATORS_DOC),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.operators) && data.operators.length > 0) {
              setOperators(data.operators);
              localStorage.setItem(OPERATORS_STORAGE_KEY, JSON.stringify(data.operators));
            }
          } else if (!seededOps) {
            seededOps = true;
            saveOperatorsToCloud(DEFAULT_OPERATORS);
          }
        },
        (err) => {
          console.warn('Firestore operators sync notice:', err?.message || err);
        }
      );
    } catch (err) {
      console.warn('Firestore operators subscription notice:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Backup to localStorage as secondary cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(OPERATORS_STORAGE_KEY, JSON.stringify(operators));
    } catch (err) {
      console.error('Failed to save operators to localStorage:', err);
    }
  }, [operators]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleAddOperator = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (operators.some((op) => op.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...operators, trimmed];
    setOperators(updated);
    saveOperatorsToCloud(updated);
    showToast(`Operator "${trimmed}" added to cloud database.`);
  };

  const handleDeleteOperator = (name: string) => {
    const updated = operators.filter((op) => op !== name);
    setOperators(updated);
    saveOperatorsToCloud(updated);
    showToast(`Operator "${name}" removed from cloud database.`);
  };

  const handleEditOperator = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const updatedOps = operators.map((op) => (op === oldName ? trimmed : op));
    setOperators(updatedOps);
    saveOperatorsToCloud(updatedOps);

    // Also update any records that had the old operator assigned
    setRecords((prev) => {
      const updatedRecords = prev.map((rec) => {
        if (rec.operator === oldName) {
          const updatedRec = { ...rec, operator: trimmed, updatedAt: new Date().toISOString() };
          saveRecordToCloud(updatedRec);
          return updatedRec;
        }
        return rec;
      });
      return updatedRecords;
    });

    showToast(`Staff member "${oldName}" updated to "${trimmed}".`);
  };

  // Currently active record
  const currentRecord =
    records.find((r) => r.id === activeRecordId) || records[0] || INITIAL_RECORDS[0];

  // Calculate current month statistics for summary dashboard card
  const targetMonthKey = currentRecord?.date
    ? currentRecord.date.substring(0, 7)
    : new Date().toISOString().substring(0, 7);

  const currentMonthRecords = records.filter(
    (r) => r.date && r.date.startsWith(targetMonthKey)
  );

  let monthTotalRevenue = 0;
  let monthTotalVariance = 0;

  currentMonthRecords.forEach((r) => {
    const totals = calculateGrandTotals(r.rows, r, records);
    monthTotalRevenue += totals.totalCol7Actual;
    monthTotalVariance += totals.totalVariance;
  });

  const monthDaysCount = currentMonthRecords.length;
  const avgDailyVariance = monthDaysCount > 0 ? monthTotalVariance / monthDaysCount : 0;

  const getMonthDisplayName = (yearMonthStr: string) => {
    if (!yearMonthStr || !yearMonthStr.includes('-')) return 'Current Month';
    const [year, month] = yearMonthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  };
  const monthDisplayName = getMonthDisplayName(targetMonthKey);

  // Update active record in records state & sync to Cloud
  const handleUpdateRecord = (updatedRecord: SheetRecord, immediate = false) => {
    const recordWithTime = {
      ...updatedRecord,
      updatedAt: new Date().toISOString(),
    };
    setRecords((prev) => {
      const updatedList = prev.map((r) => (r.id === recordWithTime.id ? recordWithTime : r));
      return sortRecordsByDate(updatedList);
    });
    if (immediate) {
      saveRecordToCloudImmediately(recordWithTime);
    } else {
      saveRecordToCloud(recordWithTime);
    }
  };

  // Recalculate ALL records in state, cascade previous floats, sync card machines, and sync to Cloud
  const handleRecalculateAllData = async () => {
    const recalculated = recalculateAllRecords(records);
    setRecords(recalculated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recalculated));
    } catch (e) {}

    try {
      await syncAllRecordsToCloud(recalculated);
      showToast(`⚡ All ${recalculated.length} daily records recalculated, balances verified & synced!`);
    } catch (err) {
      showToast(`⚡ All ${recalculated.length} daily records recalculated locally.`);
    }
  };

  // Recalculate current page values and cascade float data globally
  const handleRecalculateSheet = async () => {
    if (!currentRecord) return;
    const recalculated = recalculateAllRecords(records);
    setRecords(recalculated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recalculated));
    } catch (e) {}

    try {
      await syncAllRecordsToCloud(recalculated);
      showToast(`⚡ Page values recalculated & float cascades verified for ${formatToUKDate(currentRecord.date)}!`);
    } catch (err) {
      showToast(`⚡ Values recalculated for ${formatToUKDate(currentRecord.date)}.`);
    }
  };

  // Save & Lock current sheet
  const handleSaveSheet = () => {
    if (!currentRecord) return;
    const updated = {
      ...currentRecord,
      isSaved: true,
      updatedAt: new Date().toISOString(),
    };
    handleUpdateRecord(updated, true);
    showToast(`Sheet for ${formatToUKDate(currentRecord.date)} saved & locked successfully!`);
  };

  // Filtered records for navigation according to active financial year
  const navigableRecords = React.useMemo(() => {
    if (selectedFinancialYear === 'all' || !selectedFinancialYear) return records;
    return filterRecordsByFinancialYear(records, selectedFinancialYear, financialYearFormat);
  }, [records, selectedFinancialYear, financialYearFormat]);

  // Handler for selecting financial year with auto-switch to first record in year
  const handleSelectFinancialYear = (year: string) => {
    setSelectedFinancialYear(year);
    if (year !== 'all') {
      const yearRecords = filterRecordsByFinancialYear(records, year, financialYearFormat);
      if (yearRecords.length > 0) {
        const isCurrentInYear = yearRecords.some((r) => r.id === activeRecordId);
        if (!isCurrentInYear) {
          setActiveRecordId(yearRecords[0].id);
        }
      }
    }
  };

  // Add a new daily record
  const handleAddNewRecord = () => {
    // Determine next date or today
    const todayISO = new Date().toISOString().slice(0, 10);
    let newDate = todayISO;

    if (selectedFinancialYear !== 'all' && /^\d{4}$/.test(selectedFinancialYear)) {
      // If a specific year (e.g. 2025) is selected, place new record within that year
      const yearRecords = records.filter((r) => r.date.startsWith(selectedFinancialYear));
      if (yearRecords.length > 0) {
        const latestDate = new Date(
          Math.max(...yearRecords.map((r) => new Date(r.date).getTime()))
        );
        latestDate.setDate(latestDate.getDate() + 1);
        const potential = latestDate.toISOString().slice(0, 10);
        if (potential.startsWith(selectedFinancialYear)) {
          newDate = potential;
        } else {
          newDate = `${selectedFinancialYear}-01-01`;
        }
      } else {
        newDate = `${selectedFinancialYear}-01-01`;
      }
    } else {
      // Check if a record already exists for today, if so increment date
      const existingDates = new Set(records.map((r) => r.date));
      if (existingDates.has(newDate)) {
        const latestDate = new Date(
          Math.max(...records.map((r) => new Date(r.date).getTime()))
        );
        latestDate.setDate(latestDate.getDate() + 1);
        newDate = latestDate.toISOString().slice(0, 10);
      }
    }

    // Find previous day's record to carry over float (5) into Sys cash (1)
    const sortedExisting = sortRecordsByDate(records);
    const prevRecord = sortedExisting.find((r) => r.date < newDate) || sortedExisting[0];

    const initialRows = createBlankRows();
    if (prevRecord && prevRecord.rows) {
      initialRows.forEach((row) => {
        const prevRow = prevRecord.rows.find((pr) => pr.id === row.id || pr.name === row.name);
        const floatVal = prevRow && typeof prevRow.col5FloatCash === 'number' ? prevRow.col5FloatCash : 0;
        row.col1ExpectedCash = floatVal;
        row.prevFloat = floatVal;
      });
    }

    const newRec: SheetRecord = {
      id: `rec-${newDate}-${Date.now()}`,
      date: newDate,
      operator: operators[0] || '',
      isSaved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rows: initialRows,
    };

    setRecords((prev) => sortRecordsByDate([newRec, ...prev]));
    saveRecordToCloudImmediately(newRec);
    setActiveRecordId(newRec.id);
    setActiveTab('sheet');
    showToast(`New sheet created for ${formatToUKDate(newDate)} (Float carried over from previous day).`);
  };

  // Force sync all current records to cloud database
  const handleForceCloudSync = async () => {
    try {
      await syncAllRecordsToCloud(records);
      await saveOperatorsToCloud(operators);
      showToast(`☁️ Cloud Sync complete! ${records.length} records backed up.`);
    } catch (err) {
      showToast('⚠️ Cloud sync failed. Check network connection.');
    }
  };

  // Delete active record
  const handleDeleteActiveRecord = () => {
    if (!currentRecord) return;
    if (records.length <= 1) {
      setDeleteModal({
        isOpen: true,
        recordId: currentRecord.id,
        dateStr: formatToUKDate(currentRecord.date),
        isOnlyRecord: true,
      });
      return;
    }

    setDeleteModal({
      isOpen: true,
      recordId: currentRecord.id,
      dateStr: formatToUKDate(currentRecord.date),
      isOnlyRecord: false,
    });
  };

  // Delete specific record by ID
  const handleDeleteRecordById = (id: string) => {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;

    if (records.length <= 1) {
      setDeleteModal({
        isOpen: true,
        recordId: id,
        dateStr: formatToUKDate(rec.date),
        isOnlyRecord: true,
      });
      return;
    }

    setDeleteModal({
      isOpen: true,
      recordId: id,
      dateStr: formatToUKDate(rec.date),
      isOnlyRecord: false,
    });
  };

  // Execute deletion confirmed from modal
  const handleConfirmDeleteRecord = () => {
    if (!deleteModal.recordId) return;
    const targetId = deleteModal.recordId;
    const recToDelete = records.find((r) => r.id === targetId);
    const updatedList = records.filter((r) => r.id !== targetId);

    // Track deleted ID so other local sync loops won't resurrect it
    const newDeleted = new Set(deletedIds);
    newDeleted.add(targetId);
    setDeletedIds(newDeleted);
    try {
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(newDeleted)));
    } catch (e) {}

    setRecords(updatedList);
    deleteRecordFromCloud(targetId);

    if (activeRecordId === targetId && updatedList.length > 0) {
      setActiveRecordId(updatedList[0].id);
    }

    if (recToDelete) {
      showToast(`Record for ${formatToUKDate(recToDelete.date)} deleted from all devices.`);
    }
  };

  // Navigate to previous saved record (or date) within active financial year
  const handlePrevRecord = () => {
    const listToNav = navigableRecords.length > 0 ? navigableRecords : records;
    const currentIndex = listToNav.findIndex((r) => r.id === activeRecordId);
    if (currentIndex < listToNav.length - 1 && currentIndex !== -1) {
      setActiveRecordId(listToNav[currentIndex + 1].id);
    } else if (currentIndex === -1 && listToNav.length > 0) {
      setActiveRecordId(listToNav[0].id);
    } else {
      showToast('You are at the oldest saved record for this view.');
    }
  };

  // Navigate to next saved record (or date) within active financial year
  const handleNextRecord = () => {
    const listToNav = navigableRecords.length > 0 ? navigableRecords : records;
    const currentIndex = listToNav.findIndex((r) => r.id === activeRecordId);
    if (currentIndex > 0) {
      setActiveRecordId(listToNav[currentIndex - 1].id);
    } else if (currentIndex === -1 && listToNav.length > 0) {
      setActiveRecordId(listToNav[0].id);
    } else {
      showToast('You are at the most recent saved record for this view.');
    }
  };

  // Export current record to Excel / CSV
  const handleExportCurrentCSV = () => {
    if (!currentRecord) return;
    const csvContent = exportRecordToCSV(currentRecord);
    const filename = `Till_Cashing_Up_${formatToUKDate(currentRecord.date).replace(
      /\//g,
      '-'
    )}.csv`;
    downloadCSV(filename, csvContent);
    showToast(`Exported ${filename} successfully.`);
  };

  // Restore sample data from screenshot & sync to Cloud
  const handleResetSampleData = () => {
    setDeletedIds(new Set());
    localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
    setRecords(INITIAL_RECORDS);
    setActiveRecordId(INITIAL_RECORDS[0].id);
    syncAllRecordsToCloud(INITIAL_RECORDS);
    saveOperatorsToCloud(DEFAULT_OPERATORS);
    showToast('Reset to original sample data (01/08/2026) and synced to Cloud.');
  };

  // Export JSON backup
  const handleBackupJSON = () => {
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Till_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Backup downloaded successfully.');
  };

  // Restore JSON backup & sync to Cloud
  const handleRestoreJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].rows) {
          setDeletedIds(new Set());
          localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
          setRecords(parsed);
          setActiveRecordId(parsed[0].id);
          syncAllRecordsToCloud(parsed);
          showToast('Database restored and synced to Cloud successfully!');
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f2] text-black flex flex-col font-sans print:bg-white print:min-h-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-black text-white border-2 border-amber-400 px-4 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs font-mono font-bold flex items-center gap-2 animate-bounce print:hidden">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Main App Header or Minimal Top Bar when entering/editing sheet */}
      {activeTab === 'sheet' && isHeaderHiddenOnSheet ? (
        /* Sleek Minimal Quick Navigation Bar (When Main Header is Hidden during Daily Record Editing) */
        <div className="bg-black text-white border-b-2 border-black sticky top-0 z-40 px-3 sm:px-6 py-1.5 shadow-md flex flex-wrap items-center justify-between gap-2 print:hidden">
          {/* Left Side: Brand & Quick Tabs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber-400 text-black flex items-center justify-center font-serif font-bold text-xs shadow-xs border border-black shrink-0">
                Δ
              </div>
              <span className="font-serif italic font-bold text-xs sm:text-sm text-white hidden sm:inline">
                Daily Till Entry
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                cloudStatus === 'connected'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-600/60'
                  : cloudStatus === 'connecting'
                  ? 'bg-amber-950 text-amber-300 border-amber-600/60 animate-pulse'
                  : 'bg-rose-950 text-rose-300 border-rose-600/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  cloudStatus === 'connected' ? 'bg-emerald-400' : cloudStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                {cloudStatus === 'connected' ? 'Synced' : cloudStatus === 'connecting' ? 'Syncing...' : 'Offline'}
              </span>
            </div>

            {/* Quick Switch Tabs */}
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-sm border border-zinc-800 gap-1">
              <button
                onClick={() => setActiveTab('sheet')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs text-xs font-extrabold uppercase tracking-wider bg-white text-black shadow-xs cursor-default"
              >
                <Calculator className="w-3 h-3 text-black" />
                <span>Cashing Up</span>
              </button>

              <button
                onClick={() => setActiveTab('records')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <History className="w-3 h-3 text-zinc-400" />
                <span>Archive</span>
                {records.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] rounded-full font-mono font-bold bg-zinc-800 text-amber-400">
                    {records.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('weekly')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <BarChart3 className="w-3 h-3 text-zinc-400" />
                <span className="hidden sm:inline">Weekly Report</span>
                <span className="sm:hidden">Weekly</span>
              </button>
            </div>

            {/* Compact Financial Year Switcher */}
            <div className="hidden lg:flex items-center">
              <FinancialYearSwitcher
                selectedYear={selectedFinancialYear}
                onSelectYear={handleSelectFinancialYear}
                records={records}
                format={financialYearFormat}
                onChangeFormat={setFinancialYearFormat}
                compact={true}
                showFormatToggle={false}
              />
            </div>
          </div>

          {/* Right Side: View Mode & Show Full Header Toggle */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-sm border border-zinc-800 gap-1">
              <button
                onClick={() => setViewMode('classic')}
                className={`flex items-center gap-1 px-2 py-1 rounded-xs text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'classic'
                    ? 'bg-amber-400 text-black font-extrabold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Delta Classic Form"
              >
                <LayoutGrid className="w-3 h-3" />
                <span className="hidden md:inline">Delta Form</span>
              </button>
              <button
                onClick={() => setViewMode('modern')}
                className={`flex items-center gap-1 px-2 py-1 rounded-xs text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'modern'
                    ? 'bg-amber-400 text-black font-extrabold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Editorial Grid View"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden md:inline">Editorial Grid</span>
              </button>
            </div>

            {/* Recalculate Page Values */}
            <button
              onClick={handleRecalculateSheet}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
              title="Recalculate page values"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Recalculate</span>
            </button>

            {/* Show Full Header Button */}
            <button
              onClick={() => setIsHeaderHiddenOnSheet(false)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
              title="Show full main header toolbar"
            >
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Header</span>
            </button>
          </div>
        </div>
      ) : (
        <Header
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          activeTab={activeTab}
          onChangeActiveTab={setActiveTab}
          recordCount={records.length}
          onResetSampleData={handleResetSampleData}
          onBackupJSON={handleBackupJSON}
          onRestoreJSON={handleRestoreJSON}
          onRecalculatePageValues={handleRecalculateSheet}
          onRecalculateAllData={handleRecalculateAllData}
          onOpenGoogleCalendar={() => setIsCalendarModalOpen(true)}
          onForceCloudSync={handleForceCloudSync}
          onOpenRangeReport={() => setIsRangeReportOpen(true)}
          onOpenBulkExport={() => setIsBulkExportOpen(true)}
          onOpenStaffModal={() => setIsStaffModalOpen(true)}
          authUser={authUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          cloudStatus={cloudStatus}
          onHideHeader={activeTab === 'sheet' ? () => setIsHeaderHiddenOnSheet(true) : undefined}
          records={records}
          selectedYear={selectedFinancialYear}
          onSelectYear={handleSelectFinancialYear}
          financialYearFormat={financialYearFormat}
          onChangeFinancialYearFormat={setFinancialYearFormat}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 bg-[#f4f4f2] text-black w-full min-w-0 p-1 sm:p-2.5 md:p-3.5 print:bg-white print:p-0 print:m-0 print:overflow-visible">
        {/* Monthly Summary Dashboard Card - displayed when on archive/weekly or when main header is expanded */}
        {(activeTab !== 'sheet' || !isHeaderHiddenOnSheet) && (
          <div className="mb-4 sm:mb-6 print:hidden">
          <div className="bg-white border-2 border-black p-3.5 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4 w-full max-w-full ml-0 mr-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-400 border-2 border-black text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 bg-amber-100/80 px-2 py-0.5 border border-black">
                    {monthDisplayName}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600 font-medium">
                    ({monthDaysCount} {monthDaysCount === 1 ? 'day' : 'days'} logged)
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-black tracking-tight mt-0.5">
                  Monthly Cashing Up Dashboard
                </h2>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 border-t-2 md:border-t-0 md:border-l-2 border-black pt-3 md:pt-0 md:pl-5">
              {/* Metric 1: Monthly Total Revenue */}
              <div className="bg-zinc-50 border-2 border-black p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-[10px] font-mono font-bold uppercase text-zinc-600 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Total Revenue
                </div>
                <div className="text-base sm:text-xl font-black font-mono text-black mt-1">
                  {formatCurrency(monthTotalRevenue)}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                  Actual takings
                </div>
              </div>

              {/* Metric 2: Average Daily Variance */}
              <div className="bg-zinc-50 border-2 border-black p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-[10px] font-mono font-bold uppercase text-zinc-600 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Avg Daily Variance
                </div>
                <div
                  className={`text-base sm:text-xl font-black font-mono mt-1 ${
                    avgDailyVariance > 0
                      ? 'text-emerald-700'
                      : avgDailyVariance < 0
                      ? 'text-rose-700'
                      : 'text-zinc-800'
                  }`}
                >
                  {formatCurrency(avgDailyVariance, true)}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                  {avgDailyVariance === 0
                    ? 'Balanced on avg'
                    : avgDailyVariance > 0
                    ? 'Average overage'
                    : 'Average shortage'}
                </div>
              </div>

              {/* Metric 3: Total Month Variance */}
              <div className="col-span-2 sm:col-span-1 bg-zinc-50 border-2 border-black p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-[10px] font-mono font-bold uppercase text-zinc-600 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-purple-600 shrink-0" /> Month Variance
                </div>
                <div
                  className={`text-base sm:text-xl font-black font-mono mt-1 ${
                    monthTotalVariance > 0
                      ? 'text-emerald-700'
                      : monthTotalVariance < 0
                      ? 'text-rose-700'
                      : 'text-zinc-800'
                  }`}
                >
                  {formatCurrency(monthTotalVariance, true)}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                  Monthly net total
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {activeTab === 'sheet' && currentRecord && (
          <>
            {viewMode === 'classic' ? (
              <DeltaSheetForm
                record={currentRecord}
                allRecords={records}
                onChangeRecord={handleUpdateRecord}
                onSaveRecord={handleSaveSheet}
                onAddRecord={handleAddNewRecord}
                onDeleteRecord={handleDeleteActiveRecord}
                onOpenWeeklyReport={() => setActiveTab('weekly')}
                onExportExcel={handleExportCurrentCSV}
                onPrevRecord={handlePrevRecord}
                onNextRecord={handleNextRecord}
                onOpenRecordsList={() => setActiveTab('records')}
                operators={operators}
                onAddOperator={handleAddOperator}
                onDeleteOperator={handleDeleteOperator}
                onEditOperator={handleEditOperator}
                onRecalculatePageValues={handleRecalculateSheet}
                selectedYear={selectedFinancialYear}
                onSelectYear={handleSelectFinancialYear}
                financialYearFormat={financialYearFormat}
                onChangeFinancialYearFormat={setFinancialYearFormat}
              />
            ) : (
              <ModernSheetForm
                record={currentRecord}
                allRecords={records}
                onChangeRecord={handleUpdateRecord}
                onSaveRecord={handleSaveSheet}
                onAddRecord={handleAddNewRecord}
                onDeleteRecord={handleDeleteActiveRecord}
                onOpenWeeklyReport={() => setActiveTab('weekly')}
                onExportExcel={handleExportCurrentCSV}
                onPrevRecord={handlePrevRecord}
                onNextRecord={handleNextRecord}
                onOpenRecordsList={() => setActiveTab('records')}
                operators={operators}
                onAddOperator={handleAddOperator}
                onDeleteOperator={handleDeleteOperator}
                onEditOperator={handleEditOperator}
                onRecalculatePageValues={handleRecalculateSheet}
                selectedYear={selectedFinancialYear}
                onSelectYear={handleSelectFinancialYear}
                financialYearFormat={financialYearFormat}
                onChangeFinancialYearFormat={setFinancialYearFormat}
              />
            )}
          </>
        )}

        {activeTab === 'records' && (
          <RecordsList
            records={records}
            onSelectRecord={(id) => {
              setActiveRecordId(id);
              setActiveTab('sheet');
            }}
            onDeleteRecord={handleDeleteRecordById}
            onNewRecord={handleAddNewRecord}
            onBackToSheet={() => setActiveTab('sheet')}
            operators={operators}
            onOpenRangeReport={() => setIsRangeReportOpen(true)}
            onRecalculateAllData={handleRecalculateAllData}
            selectedYear={selectedFinancialYear}
            onSelectYear={handleSelectFinancialYear}
            financialYearFormat={financialYearFormat}
            onChangeFinancialYearFormat={setFinancialYearFormat}
          />
        )}

        {activeTab === 'weekly' && (
          <WeeklyReportView
            records={records}
            onBackToSheet={() => setActiveTab('sheet')}
            onSelectRecord={(id) => {
              setActiveRecordId(id);
              setActiveTab('sheet');
            }}
            onOpenRangeReport={() => setIsRangeReportOpen(true)}
            selectedYear={selectedFinancialYear}
            onSelectYear={handleSelectFinancialYear}
            financialYearFormat={financialYearFormat}
            onChangeFinancialYearFormat={setFinancialYearFormat}
          />
        )}
      </main>

      {/* Standalone Global Staff / Operator Database Modal */}
      <OperatorModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        operators={operators}
        onAddOperator={handleAddOperator}
        onDeleteOperator={handleDeleteOperator}
        onEditOperator={handleEditOperator}
        selectedOperator={currentRecord?.operator}
        onSelectOperator={(name) => {
          if (currentRecord) {
            handleUpdateRecord({ ...currentRecord, operator: name });
          }
        }}
      />

      {/* Delete Record Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleConfirmDeleteRecord}
        recordDate={deleteModal.dateStr || ''}
        isOnlyRecord={deleteModal.isOnlyRecord}
      />

      {/* Google Calendar Integration Modal */}
      {currentRecord && (
        <GoogleCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          currentRecord={currentRecord}
          allRecords={records}
        />
      )}

      {/* Date Range Day Page Report Modal */}
      <DateRangeReportModal
        isOpen={isRangeReportOpen}
        onClose={() => setIsRangeReportOpen(false)}
        records={records}
        operators={operators}
        onSelectRecord={(id) => {
          setActiveRecordId(id);
          setActiveTab('sheet');
        }}
      />

      {/* Bulk Export All (CSV & PDF) Modal */}
      <BulkExportModal
        isOpen={isBulkExportOpen}
        onClose={() => setIsBulkExportOpen(false)}
        records={records}
      />
    </div>
  );
}
