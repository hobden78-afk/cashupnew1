import React, { useEffect, useState } from 'react';
import { ActiveTab, SheetRecord, ViewMode, AuditLogEntry, AuditActionType } from './types';
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
  Lock,
  Shield,
  Download,
  Database,
  FileSpreadsheet,
  Menu,
} from 'lucide-react';
import {
  createBlankRows,
  DEFAULT_OPERATORS,
  INITIAL_RECORDS,
} from './data/initialData';
import { INITIAL_AUDIT_LOGS } from './data/initialAuditData';
import {
  calculateGrandTotals,
  downloadCSV,
  exportRecordToCSV,
  formatCurrency,
  formatToUKDate,
  getWeekStartAndEnd,
  recalculateAllRecords,
  sortRecordsByDate,
  filterRecordsByFinancialYear,
} from './utils/calculations';
import {
  diffSheetRecords,
  createRecordAuditEntry,
  deleteRecordAuditEntry,
  recalculateAuditEntry,
  restoreBackupAuditEntry,
  generateAuditId,
} from './utils/auditLogger';
import { Header } from './components/Header';
import { DeltaSheetForm } from './components/DeltaSheetForm';
import { ModernSheetForm } from './components/ModernSheetForm';
import { RecordsList } from './components/RecordsList';
import { WeeklyReportView } from './components/WeeklyReportView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { AuditLogView } from './components/AuditLogView';
import { MenuView } from './components/MenuView';
import { ShareAppModal } from './components/ShareAppModal';
import { BackupModal } from './components/BackupModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { DateRangeReportModal } from './components/DateRangeReportModal';
import { BulkExportModal } from './components/BulkExportModal';
import { OperatorModal } from './components/OperatorModal';
import { FinancialYearFormat, FinancialYearSwitcher } from './components/FinancialYearSwitcher';
import { LockScreen } from './components/LockScreen';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { 
  SecurityConfig, 
  DEFAULT_SECURITY_CONFIG, 
  SECURITY_STORAGE_KEY, 
  SECURITY_SESSION_KEY 
} from './utils/security';
import { 
  db, 
  RECORDS_COLLECTION, 
  SETTINGS_COLLECTION, 
  AUDIT_COLLECTION,
  OPERATORS_DOC,
  SECURITY_DOC,
  saveRecordToCloud, 
  saveRecordToCloudImmediately,
  deleteRecordFromCloud, 
  saveOperatorsToCloud, 
  saveSecurityConfigToCloud,
  syncAllRecordsToCloud,
  saveAuditEntryToCloud,
  syncAuditLogsToCloud
} from './lib/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleSignIn, googleLogout } from './lib/googleAuth';

const STORAGE_KEY = 'delta_till_cashing_up_records_v1';
const OPERATORS_STORAGE_KEY = 'delta_till_operators_v1';
const DELETED_IDS_STORAGE_KEY = 'delta_till_deleted_records_v1';
const AUDIT_LOGS_STORAGE_KEY = 'delta_till_audit_logs_v1';
const LAST_ENTERED_RECORD_ID_KEY = 'delta_till_last_entered_record_id_v1';

/**
 * Find the most recently entered record in the dataset.
 * Prioritizes:
 * 1. The record with the newest createdAt timestamp (most recently entered).
 * 2. If createdAt is identical or missing, the record with the most recent calendar date (YYYY-MM-DD).
 */
function getLatestEnteredRecord(recordList: SheetRecord[]): SheetRecord | undefined {
  if (!recordList || recordList.length === 0) return undefined;

  return [...recordList].sort((a, b) => {
    // 1. Compare createdAt if both exist and differ significantly (> 1s)
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated && bCreated && Math.abs(aCreated - bCreated) > 1000) {
      return bCreated - aCreated;
    }

    // 2. Compare calendar date descending (newest date first)
    const aDate = a.date || '';
    const bDate = b.date || '';
    const dateDiff = bDate.localeCompare(aDate);
    if (dateDiff !== 0) return dateDiff;

    // 3. Compare updatedAt if available
    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (aUpdated && bUpdated) {
      return bUpdated - aUpdated;
    }

    return bCreated - aCreated;
  })[0];
}

/**
 * Determine the record ID to display on startup.
 * Checks the last record entered or saved in localStorage.
 * If a newer record was entered into the database (by date or createdAt),
 * it displays that latest entered record.
 */
function getStartupRecordId(recordList: SheetRecord[]): string | undefined {
  if (!recordList || recordList.length === 0) return undefined;

  const latestEntered = getLatestEnteredRecord(recordList);

  try {
    const savedId = localStorage.getItem(LAST_ENTERED_RECORD_ID_KEY);
    if (savedId) {
      const savedRecord = recordList.find((r) => r.id === savedId);
      if (savedRecord) {
        // If the latest entered record in the database is newer than the saved record,
        // display the latest entered record
        if (latestEntered && latestEntered.id !== savedRecord.id) {
          const savedDate = savedRecord.date || '';
          const latestDate = latestEntered.date || '';
          if (latestDate > savedDate) {
            return latestEntered.id;
          }
        }
        return savedRecord.id;
      }
    }
  } catch (e) {}

  return latestEntered?.id || recordList[0]?.id;
}

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
    return getStartupRecordId(records) || records[0]?.id || 'rec-2026-08-01';
  });

  const isInitialCloudLoadRef = React.useRef<boolean>(true);

  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [activeTab, setActiveTab] = useState<ActiveTab>('sheet');

  // Audit Logs State (with offline caching and seed data)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_AUDIT_LOGS;
  });

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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'connecting' | 'offline' | 'error'>('connecting');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    recordId?: string;
    dateStr?: string;
    isOnlyRecord?: boolean;
  }>({ isOpen: false });

  // Security & Password Protection State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    try {
      const saved = localStorage.getItem(SECURITY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return DEFAULT_SECURITY_CONFIG;
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SECURITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isEnabled && parsed.passwordHash) {
          const session = sessionStorage.getItem(SECURITY_SESSION_KEY);
          if (session === 'unlocked' && parsed.autoLockMinutes !== 0) {
            return false;
          }
          return true;
        }
      }
    } catch (e) {}
    return false;
  });

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isInitialSecuritySetup, setIsInitialSecuritySetup] = useState(false);

  // Inactivity Auto-Lock Timer
  useEffect(() => {
    if (!securityConfig.isEnabled || !securityConfig.passwordHash || isAppLocked) return;
    if (securityConfig.autoLockMinutes === -1) return; // Never auto-lock while active

    let timeoutId: any = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (securityConfig.autoLockMinutes > 0) {
        timeoutId = setTimeout(() => {
          setIsAppLocked(true);
          try {
            sessionStorage.removeItem(SECURITY_SESSION_KEY);
          } catch (e) {}
          showToast('App automatically locked due to inactivity');
        }, securityConfig.autoLockMinutes * 60 * 1000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && securityConfig.autoLockMinutes === 0) {
        setIsAppLocked(true);
        try {
          sessionStorage.removeItem(SECURITY_SESSION_KEY);
        } catch (e) {}
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [securityConfig, isAppLocked]);

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

            // On initial startup / cloud load, ensure the active record is the last record entered
            if (isInitialCloudLoadRef.current) {
              isInitialCloudLoadRef.current = false;
              const startupId = getStartupRecordId(sortedCloud);
              if (startupId) {
                setActiveRecordId(startupId);
              }
            }
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

              if (isInitialCloudLoadRef.current) {
                isInitialCloudLoadRef.current = false;
                const startupId = getStartupRecordId(initialRecalculated);
                if (startupId) {
                  setActiveRecordId(startupId);
                }
              }
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

  // 3. Subscribe to Firebase Firestore real-time updates for Security Settings
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onSnapshot(
        doc(db, SETTINGS_COLLECTION, SECURITY_DOC),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as SecurityConfig;
            if (data && typeof data.isEnabled === 'boolean') {
              setSecurityConfig((prev) => {
                const updated = { ...prev, ...data };
                try {
                  localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(updated));
                } catch (e) {}
                return updated;
              });
            }
          }
        },
        (err) => {
          console.warn('Firestore security sync notice:', err?.message || err);
        }
      );
    } catch (err) {
      console.warn('Firestore security subscription notice:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 4. Subscribe to Firebase Firestore real-time updates for Audit Logs
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onSnapshot(
        collection(db, AUDIT_COLLECTION),
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudLogs: AuditLogEntry[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as AuditLogEntry;
              if (data && data.id) {
                cloudLogs.push(data);
              }
            });

            if (cloudLogs.length > 0) {
              setAuditLogs((prev) => {
                const map = new Map<string, AuditLogEntry>();
                prev.forEach((l) => map.set(l.id, l));
                cloudLogs.forEach((l) => map.set(l.id, l));
                return Array.from(map.values()).sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
              });
            }
          }
        },
        (err) => {
          console.warn('Firestore audit logs sync notice:', err?.message || err);
        }
      );
    } catch (err) {
      console.warn('Firestore audit logs subscription notice:', err);
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

  useEffect(() => {
    try {
      localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(securityConfig));
    } catch (err) {
      console.error('Failed to save security config to localStorage:', err);
    }
  }, [securityConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(auditLogs));
    } catch (err) {
      console.error('Failed to save audit logs to localStorage:', err);
    }
  }, [auditLogs]);

  // Helper to add an audit log entry both locally and to Cloud
  const addAuditLog = (entry: AuditLogEntry) => {
    setAuditLogs((prev) => [entry, ...prev.filter((l) => l.id !== entry.id)]);
    saveAuditEntryToCloud(entry);
  };

  // Helper to resolve current actor / user display label
  const resolveCurrentUser = (recordOperator?: string): string => {
    if (authUser?.displayName && recordOperator && authUser.displayName !== recordOperator) {
      return `${recordOperator} (${authUser.displayName})`;
    }
    if (authUser?.displayName) return authUser.displayName;
    if (authUser?.email) return authUser.email;
    if (recordOperator) return recordOperator;
    return 'Operator / Cashier';
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSaveSecurityConfig = (newConfig: SecurityConfig) => {
    setSecurityConfig(newConfig);
    try {
      localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {}
    saveSecurityConfigToCloud(newConfig);

    if (!newConfig.isEnabled || !newConfig.passwordHash) {
      setIsAppLocked(false);
      try {
        sessionStorage.removeItem(SECURITY_SESSION_KEY);
      } catch (e) {}
      showToast('Password protection disabled.');
    } else {
      showToast('Security settings updated successfully.');
    }
  };

  const handleUnlockApp = () => {
    setIsAppLocked(false);
    setIsInitialSecuritySetup(false);
    try {
      sessionStorage.setItem(SECURITY_SESSION_KEY, 'unlocked');
    } catch (e) {}
    showToast('App unlocked successfully.');
  };

  const handleLockAppNow = () => {
    if (!securityConfig.isEnabled || !securityConfig.passwordHash) {
      setIsSecurityModalOpen(true);
      return;
    }
    setIsAppLocked(true);
    try {
      sessionStorage.removeItem(SECURITY_SESSION_KEY);
    } catch (e) {}
    showToast('Application locked.');
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

  // Active day sheet totals (live copy of Day Total / Sys Total 3, etc.)
  const currentRecordTotals = React.useMemo(() => {
    if (!currentRecord) return null;
    return calculateGrandTotals(currentRecord.rows, currentRecord, records);
  }, [currentRecord, records]);

  // Active week statistics based on current active record date (Sys 3 week total)
  const currentWeekInfo = React.useMemo(() => {
    if (!currentRecord?.date) return null;
    return getWeekStartAndEnd(currentRecord.date);
  }, [currentRecord?.date]);

  const { currentWeekSys3Total, currentWeekDaysCount } = React.useMemo(() => {
    if (!currentWeekInfo) return { currentWeekSys3Total: 0, currentWeekDaysCount: 0 };

    const weekRecords = records.filter(
      (r) => r.date && r.date >= currentWeekInfo.mondayISO && r.date <= currentWeekInfo.sundayISO
    );

    let sys3Total = 0;
    let foundCurrent = false;

    weekRecords.forEach((r) => {
      if (r.id === currentRecord?.id) {
        foundCurrent = true;
        // Use live totals from currently active sheet if editing
        sys3Total += currentRecordTotals ? currentRecordTotals.totalCol3Expected : 0;
      } else {
        const totals = calculateGrandTotals(r.rows, r, records);
        sys3Total += totals.totalCol3Expected;
      }
    });

    // If current record date is within this week but not yet in records array
    if (
      !foundCurrent &&
      currentRecord?.date &&
      currentRecord.date >= currentWeekInfo.mondayISO &&
      currentRecord.date <= currentWeekInfo.sundayISO &&
      currentRecordTotals
    ) {
      sys3Total += currentRecordTotals.totalCol3Expected;
    }

    return {
      currentWeekSys3Total: sys3Total,
      currentWeekDaysCount: weekRecords.length + (!foundCurrent && currentRecord ? 1 : 0),
    };
  }, [currentWeekInfo, records, currentRecord, currentRecordTotals]);

  // Undo history for active day sheet
  const [undoStack, setUndoStack] = useState<SheetRecord[]>([]);

  // Audit log baseline snapshot & debounce timer
  const auditBaselineRef = React.useRef<SheetRecord | null>(null);
  const auditDebounceTimerRef = React.useRef<any>(null);

  // When active record changes, flush pending audit comparison, update baseline, and remember last accessed record
  useEffect(() => {
    if (auditDebounceTimerRef.current) {
      clearTimeout(auditDebounceTimerRef.current);
      auditDebounceTimerRef.current = null;
    }
    auditBaselineRef.current = currentRecord ? JSON.parse(JSON.stringify(currentRecord)) : null;
    setUndoStack([]);

    if (activeRecordId) {
      try {
        localStorage.setItem(LAST_ENTERED_RECORD_ID_KEY, activeRecordId);
      } catch (e) {}
    }
  }, [activeRecordId]);

  // Update active record in records state & sync to Cloud
  const handleUpdateRecord = (updatedRecord: SheetRecord, immediate = false, isUndoAction = false) => {
    // If this is a normal edit (not an undo restore), record current snapshot to undo history
    if (!isUndoAction && currentRecord && currentRecord.id === updatedRecord.id) {
      const prevDataStr = JSON.stringify({
        date: currentRecord.date,
        operator: currentRecord.operator,
        isSaved: currentRecord.isSaved,
        rows: currentRecord.rows,
      });
      const nextDataStr = JSON.stringify({
        date: updatedRecord.date,
        operator: updatedRecord.operator,
        isSaved: updatedRecord.isSaved,
        rows: updatedRecord.rows,
      });
      if (prevDataStr !== nextDataStr) {
        setUndoStack((prev) => [...prev.slice(-30), currentRecord]);
      }
    }

    // Capture Audit Log changes
    if (isUndoAction) {
      addAuditLog({
        id: generateAuditId(),
        timestamp: new Date().toISOString(),
        recordId: updatedRecord.id,
        recordDate: updatedRecord.date,
        user: resolveCurrentUser(updatedRecord.operator),
        userEmail: authUser?.email || undefined,
        actionType: 'edit',
        summary: `Reverted recent changes on ${formatToUKDate(updatedRecord.date)} sheet via Undo (Ctrl+Z)`,
      });
      auditBaselineRef.current = JSON.parse(JSON.stringify(updatedRecord));
    } else if (immediate) {
      if (auditDebounceTimerRef.current) {
        clearTimeout(auditDebounceTimerRef.current);
        auditDebounceTimerRef.current = null;
      }
      const baseline = auditBaselineRef.current || currentRecord;
      if (baseline && baseline.id === updatedRecord.id) {
        const diffEntry = diffSheetRecords(
          baseline,
          updatedRecord,
          resolveCurrentUser(updatedRecord.operator),
          authUser?.email || undefined
        );
        if (diffEntry) {
          addAuditLog(diffEntry);
        }
      }
      auditBaselineRef.current = JSON.parse(JSON.stringify(updatedRecord));
    } else {
      // Debounce audit logging for keyboard entry to produce single neat log entry
      if (!auditBaselineRef.current || auditBaselineRef.current.id !== updatedRecord.id) {
        auditBaselineRef.current = currentRecord
          ? JSON.parse(JSON.stringify(currentRecord))
          : JSON.parse(JSON.stringify(updatedRecord));
      }
      if (auditDebounceTimerRef.current) {
        clearTimeout(auditDebounceTimerRef.current);
      }
      auditDebounceTimerRef.current = setTimeout(() => {
        const baseline = auditBaselineRef.current;
        if (baseline && baseline.id === updatedRecord.id) {
          const diffEntry = diffSheetRecords(
            baseline,
            updatedRecord,
            resolveCurrentUser(updatedRecord.operator),
            authUser?.email || undefined
          );
          if (diffEntry) {
            addAuditLog(diffEntry);
          }
        }
        auditBaselineRef.current = JSON.parse(JSON.stringify(updatedRecord));
      }, 900);
    }

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

  const handleUndo = () => {
    if (undoStack.length === 0) {
      showToast('No recent changes to undo.');
      return;
    }
    const previousSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    handleUpdateRecord(previousSnapshot, true, true);
    showToast(`Undid change on ${formatToUKDate(previousSnapshot.date)} sheet.`);
  };

  // Keyboard shortcut listener for Ctrl+Z / Cmd+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const activeElem = document.activeElement;
        const isInputActive =
          activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA');
        if (!isInputActive && undoStack.length > 0 && activeTab === 'sheet') {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, activeTab]);

  // Recalculate ALL records in state, cascade previous floats, sync card machines, and sync to Cloud
  const handleRecalculateAllData = async () => {
    const recalculated = recalculateAllRecords(records);
    setRecords(recalculated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recalculated));
    } catch (e) {}

    addAuditLog(
      recalculateAuditEntry(
        recalculated.length,
        resolveCurrentUser(),
        authUser?.email || undefined
      )
    );

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
        const prevRow = prevRecord.rows.find(
          (pr) => pr.id === row.id || pr.name === row.name || (pr.name && row.name && pr.name.toLowerCase() === row.name.toLowerCase())
        );
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
    addAuditLog(
      createRecordAuditEntry(
        newRec,
        resolveCurrentUser(newRec.operator),
        authUser?.email || undefined
      )
    );
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
      const nextId = getStartupRecordId(updatedList) || updatedList[0].id;
      setActiveRecordId(nextId);
    }

    if (recToDelete) {
      addAuditLog(
        deleteRecordAuditEntry(
          recToDelete,
          resolveCurrentUser(recToDelete.operator),
          authUser?.email || undefined
        )
      );
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

  // Jump to specific date or create new sheet for selected date
  const handleGoToDate = (targetDate: string) => {
    if (!targetDate) return;
    const existing = records.find((r) => r.date === targetDate);
    if (existing) {
      setActiveRecordId(existing.id);
      setActiveTab('sheet');
      showToast(`Jumped to day sheet for ${formatToUKDate(targetDate)}.`);
    } else {
      // Find previous day's record to carry over float into Sys cash
      const sortedExisting = sortRecordsByDate(records);
      const prevRecord = sortedExisting.find((r) => r.date < targetDate) || sortedExisting[0];

      const initialRows = createBlankRows();
      if (prevRecord && prevRecord.rows) {
        initialRows.forEach((row) => {
          const prevRow = prevRecord.rows.find(
            (pr) => pr.id === row.id || pr.name === row.name || (pr.name && row.name && pr.name.toLowerCase() === row.name.toLowerCase())
          );
          const floatVal = prevRow && typeof prevRow.col5FloatCash === 'number' ? prevRow.col5FloatCash : 0;
          row.col1ExpectedCash = floatVal;
          row.prevFloat = floatVal;
        });
      }

      const newRec: SheetRecord = {
        id: `rec-${targetDate}-${Date.now()}`,
        date: targetDate,
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
      showToast(`Created & opened new sheet for ${formatToUKDate(targetDate)}.`);
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
    addAuditLog({
      id: generateAuditId(),
      timestamp: new Date().toISOString(),
      recordId: 'system',
      recordDate: INITIAL_RECORDS[0].date,
      user: resolveCurrentUser(),
      userEmail: authUser?.email || undefined,
      actionType: 'restore',
      summary: 'Reset database to original sample records & standard till configuration',
    });
    showToast('Reset to original sample data (01/08/2026) and synced to Cloud.');
  };

  // Export comprehensive JSON backup & sync to Cloud
  const handleBackupJSON = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const backupPayload = {
      app: 'Delta Daily Till Cashing',
      version: '2.0',
      exportedAt: now.toISOString(),
      recordCount: records.length,
      records: records,
      operators: operators,
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Till_Database_Backup_${dateStr}_${timeStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also trigger cloud sync as part of backup
    syncAllRecordsToCloud(records);
    saveOperatorsToCloud(operators);

    showToast(`💾 Backup complete! ${records.length} records & staff roster saved to file & Cloud.`);
  };

  // Restore JSON backup & sync to Cloud (supports legacy array and envelope formats)
  const handleRestoreJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        let recordsToRestore: SheetRecord[] = [];
        let operatorsToRestore: string[] | null = null;

        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].rows) {
          recordsToRestore = parsed;
        } else if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
          recordsToRestore = parsed.records;
          if (Array.isArray(parsed.operators) && parsed.operators.length > 0) {
            operatorsToRestore = parsed.operators;
          }
        }

        if (recordsToRestore.length > 0) {
          setDeletedIds(new Set());
          localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
          setRecords(recordsToRestore);
          const startupId = getStartupRecordId(recordsToRestore) || recordsToRestore[0].id;
          setActiveRecordId(startupId);
          syncAllRecordsToCloud(recordsToRestore);

          if (operatorsToRestore) {
            setOperators(operatorsToRestore);
            saveOperatorsToCloud(operatorsToRestore);
          }

          addAuditLog(
            restoreBackupAuditEntry(
              recordsToRestore.length,
              resolveCurrentUser(),
              authUser?.email || undefined
            )
          );

          showToast(`✅ Database restored! ${recordsToRestore.length} records loaded & synced.`);
        } else {
          alert('Invalid backup file: Could not find valid till records.');
        }
      } catch (err) {
        alert('Failed to parse JSON file. Please select a valid till database backup.');
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
                <span className="hidden sm:inline">Weekly</span>
              </button>

              <button
                onClick={() => setActiveTab('monthly')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <TrendingUp className="w-3 h-3 text-zinc-400" />
                <span className="hidden sm:inline">Monthly</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3 text-zinc-400" />
                <span className="hidden sm:inline">Audit Log</span>
                <span className="sm:hidden">Audit</span>
                {auditLogs.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] rounded-full font-mono font-bold bg-zinc-800 text-amber-400">
                    {auditLogs.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-amber-300 hover:text-white hover:bg-zinc-800"
                title="Open System Menu"
              >
                <Menu className="w-3 h-3 text-amber-400" />
                <span>Menu</span>
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

            {/* Backup Button (Instant One-Click Backup, Green) */}
            <button
              onClick={handleBackupJSON}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-950 shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
              title="Backup all daily records and staff data immediately to JSON file"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            {/* Recalculate Page Values */}
            <button
              onClick={handleRecalculateSheet}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black border border-black shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
              title="Recalculate page values"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Recalculate</span>
            </button>

            {/* Quick Lock / Security Button on collapsed header */}
            {securityConfig.isEnabled && securityConfig.passwordHash && (
              <button
                onClick={handleLockAppNow}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/50 shadow-xs cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all rounded-xs"
                title="Lock App immediately"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}

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
          records={records}
          selectedYear={selectedFinancialYear}
          onSelectYear={handleSelectFinancialYear}
          financialYearFormat={financialYearFormat}
          onChangeFinancialYearFormat={setFinancialYearFormat}
          authUser={authUser}
          cloudStatus={cloudStatus}
          onHideHeader={activeTab === 'sheet' ? () => setIsHeaderHiddenOnSheet(true) : undefined}
          isSecurityProtected={securityConfig.isEnabled && !!securityConfig.passwordHash}
          onLockAppNow={handleLockAppNow}
          auditCount={auditLogs.length}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 bg-[#f4f4f2] text-black w-full min-w-0 p-1 sm:p-2.5 md:p-3.5 print:bg-white print:p-0 print:m-0 print:overflow-visible">
        {/* Monthly Summary Dashboard Card - displayed when on archive/weekly or when main header is expanded */}
        {(activeTab !== 'sheet' || !isHeaderHiddenOnSheet) && activeTab !== 'monthly' && activeTab !== 'audit' && activeTab !== 'menu' && (
          <div className="mb-4 sm:mb-6 print:hidden">
          <div className="bg-white border-2 border-black p-3.5 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full max-w-full ml-0 mr-auto">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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

              {/* Day Total Field Copy (Col 3 Sys Total from current active day sheet) */}
              {currentRecord && currentRecordTotals && (
                <div
                  id="top-dashboard-day-total"
                  className="flex items-center gap-2.5 bg-zinc-50 border-2 border-black p-2 sm:p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0"
                  title={`Live Day Total for ${formatToUKDate(currentRecord.date)} (Sys Total Col 3)`}
                >
                  <div className="flex flex-col">
                    <div className="text-[10px] font-mono font-black uppercase text-zinc-700 flex items-center gap-1.5 tracking-tight">
                      <span className="bg-amber-400 text-slate-950 font-mono font-black text-[9px] px-1 border border-black rounded-xs">
                        D
                      </span>
                      <span>Day Total (Sys 3)</span>
                      <span className="text-zinc-500 font-normal">
                        ({formatToUKDate(currentRecord.date)})
                      </span>
                    </div>
                    <div className="bg-amber-100 border-2 border-slate-900 rounded px-3 py-1 mt-1 text-right font-black text-slate-900 text-base sm:text-xl font-mono shadow-xs">
                      {formatCurrency(currentRecordTotals.totalCol3Expected)}
                    </div>
                  </div>
                </div>
              )}

              {/* Week Total Field Copy (Col 3 Sys Total for calendar week of active day sheet) */}
              {currentRecord && currentWeekInfo && (
                <div
                  id="top-dashboard-week-total"
                  className="flex items-center gap-2.5 bg-zinc-50 border-2 border-black p-2 sm:p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 cursor-pointer hover:bg-amber-50/60 transition-colors"
                  onClick={() => setActiveTab('weekly')}
                  title={`Live Week Total for ${currentWeekInfo.label} (${currentWeekDaysCount} ${currentWeekDaysCount === 1 ? 'day' : 'days'} logged, Sys Total Col 3) - Click to view Weekly Report`}
                >
                  <div className="flex flex-col">
                    <div className="text-[10px] font-mono font-black uppercase text-zinc-700 flex items-center gap-1.5 tracking-tight">
                      <span className="bg-amber-400 text-slate-950 font-mono font-black text-[9px] px-1 border border-black rounded-xs">
                        W
                      </span>
                      <span>Week Total (Sys 3)</span>
                      <span className="text-zinc-500 font-normal">
                        ({currentWeekInfo.mondayUK.slice(0, 5)}–{currentWeekInfo.sundayUK.slice(0, 5)})
                      </span>
                    </div>
                    <div className="bg-amber-100 border-2 border-slate-900 rounded px-3 py-1 mt-1 text-right font-black text-slate-900 text-base sm:text-xl font-mono shadow-xs">
                      {formatCurrency(currentWeekSys3Total)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 border-t-2 xl:border-t-0 xl:border-l-2 border-black pt-3 xl:pt-0 xl:pl-5">
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
                onOpenMonthlyReport={() => setActiveTab('monthly')}
                onExportExcel={handleExportCurrentCSV}
                onPrevRecord={handlePrevRecord}
                onNextRecord={handleNextRecord}
                onOpenRecordsList={() => setActiveTab('records')}
                onGoToDate={handleGoToDate}
                onUndo={handleUndo}
                canUndo={undoStack.length > 0}
                operators={operators}
                onAddOperator={handleAddOperator}
                onDeleteOperator={handleDeleteOperator}
                onEditOperator={handleEditOperator}
                onRecalculatePageValues={handleRecalculateSheet}
                selectedYear={selectedFinancialYear}
                onSelectYear={handleSelectFinancialYear}
                financialYearFormat={financialYearFormat}
                onChangeFinancialYearFormat={setFinancialYearFormat}
                onBackupJSON={handleBackupJSON}
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
                onOpenMonthlyReport={() => setActiveTab('monthly')}
                onExportExcel={handleExportCurrentCSV}
                onPrevRecord={handlePrevRecord}
                onNextRecord={handleNextRecord}
                onOpenRecordsList={() => setActiveTab('records')}
                onGoToDate={handleGoToDate}
                onUndo={handleUndo}
                canUndo={undoStack.length > 0}
                operators={operators}
                onAddOperator={handleAddOperator}
                onDeleteOperator={handleDeleteOperator}
                onEditOperator={handleEditOperator}
                onRecalculatePageValues={handleRecalculateSheet}
                selectedYear={selectedFinancialYear}
                onSelectYear={handleSelectFinancialYear}
                financialYearFormat={financialYearFormat}
                onChangeFinancialYearFormat={setFinancialYearFormat}
                onBackupJSON={handleBackupJSON}
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
            onBackupJSON={handleBackupJSON}
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
            onOpenMonthlyReport={() => setActiveTab('monthly')}
            selectedYear={selectedFinancialYear}
            onSelectYear={handleSelectFinancialYear}
            financialYearFormat={financialYearFormat}
            onChangeFinancialYearFormat={setFinancialYearFormat}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReportView
            records={records}
            onBackToSheet={() => setActiveTab('sheet')}
            onSelectRecord={(id) => {
              setActiveRecordId(id);
              setActiveTab('sheet');
            }}
            operators={operators}
            selectedYear={selectedFinancialYear}
            onSelectYear={handleSelectFinancialYear}
            financialYearFormat={financialYearFormat}
            onChangeFinancialYearFormat={setFinancialYearFormat}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogView
            logs={auditLogs}
            records={records}
            onBackToSheet={() => setActiveTab('sheet')}
            onSelectRecord={(id) => {
              setActiveRecordId(id);
              setActiveTab('sheet');
            }}
            onClearHistory={() => {
              if (window.confirm('Are you sure you want to clear the local audit log history?')) {
                setAuditLogs([]);
              }
            }}
          />
        )}

        {activeTab === 'menu' && (
          <MenuView
            records={records}
            recordCount={records.length}
            auditCount={auditLogs.length}
            operators={operators}
            onBackToSheet={() => setActiveTab('sheet')}
            onChangeActiveTab={setActiveTab}
            onBackupJSON={handleBackupJSON}
            onRestoreJSON={handleRestoreJSON}
            onRecalculateAllData={handleRecalculateAllData}
            onResetSampleData={handleResetSampleData}
            onForceCloudSync={handleForceCloudSync}
            onOpenGoogleCalendar={() => setIsCalendarModalOpen(true)}
            onOpenRangeReport={() => setIsRangeReportOpen(true)}
            onOpenBulkExport={() => setIsBulkExportOpen(true)}
            onOpenStaffModal={() => setIsStaffModalOpen(true)}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            authUser={authUser}
            onLogin={handleLogin}
            onLogout={handleLogout}
            cloudStatus={cloudStatus}
            isSecurityProtected={securityConfig.isEnabled && !!securityConfig.passwordHash}
            onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            onLockAppNow={handleLockAppNow}
            selectedYear={selectedFinancialYear}
            onSelectYear={handleSelectFinancialYear}
            financialYearFormat={financialYearFormat}
            onChangeFinancialYearFormat={setFinancialYearFormat}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
          />
        )}
      </main>

      {/* Mobile / Android App Link Modal */}
      <ShareAppModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Advanced Backup & Cloud Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        recordCount={records.length}
        onBackupJSON={handleBackupJSON}
        onRestoreJSON={handleRestoreJSON}
        onResetSampleData={handleResetSampleData}
        onForceCloudSync={handleForceCloudSync}
        onOpenBulkExport={() => setIsBulkExportOpen(true)}
        onRecalculateAllData={handleRecalculateAllData}
      />

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

      {/* Security & Password Protection Settings Modal */}
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        config={securityConfig}
        onSaveConfig={handleSaveSecurityConfig}
        onLockNow={handleLockAppNow}
      />

      {/* Master App Lock Screen Overlay (Active when app is locked) */}
      {isAppLocked && (
        <LockScreen
          config={securityConfig}
          onUnlock={handleUnlockApp}
          onSaveConfig={handleSaveSecurityConfig}
        />
      )}
    </div>
  );
}
