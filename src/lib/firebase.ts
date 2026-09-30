import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore,
  initializeFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from './firebaseConfig';
import { SheetRecord, AuditLogEntry } from '../types';
import { SecurityConfig } from '../utils/security';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = firebaseConfig.firestoreDatabaseId;
// Initialize Firestore with ignoreUndefinedProperties to prevent fatal crashes on undefined fields
export const db = dbId 
  ? initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId)
  : initializeFirestore(app, { ignoreUndefinedProperties: true });

export const RECORDS_COLLECTION = 'till_records';
export const SETTINGS_COLLECTION = 'till_settings';
export const AUDIT_COLLECTION = 'till_audit_logs';
export const OPERATORS_DOC = 'operators_list';
export const SECURITY_DOC = 'app_security';

/**
 * Deeply sanitizes data objects before storing in Firestore.
 * Converts any `undefined` properties to null or removes them safely.
 */
export function sanitizeForCloud<T>(data: T): T {
  if (data === undefined || data === null) return null as unknown as T;
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (value === undefined ? null : value))
  );
}

const saveDebounceTimers = new Map<string, any>();
const pendingRecordsToSave = new Map<string, SheetRecord>();

// Immediately flush any pending debounced saves to Firestore
export async function flushPendingSaves(): Promise<void> {
  for (const timer of saveDebounceTimers.values()) {
    clearTimeout(timer);
  }
  saveDebounceTimers.clear();

  if (pendingRecordsToSave.size === 0) return;

  const recordsToSave = Array.from(pendingRecordsToSave.values());
  pendingRecordsToSave.clear();

  try {
    const promises = recordsToSave.map((rec) => {
      const docRef = doc(db, RECORDS_COLLECTION, rec.id);
      return setDoc(docRef, sanitizeForCloud(rec));
    });
    await Promise.all(promises);
  } catch (err) {
    console.warn('Notice: Error flushing pending saves to Cloud:', err);
  }
}

// Attach event listeners to flush saves when user closes app or switches tabs
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSaves();
    }
  });
  window.addEventListener('beforeunload', () => {
    flushPendingSaves();
  });
}

// Save a single record to Firestore immediately without debouncing
export async function saveRecordToCloudImmediately(record: SheetRecord): Promise<void> {
  // Cancel pending debounce timer if active
  if (saveDebounceTimers.has(record.id)) {
    clearTimeout(saveDebounceTimers.get(record.id));
    saveDebounceTimers.delete(record.id);
  }
  pendingRecordsToSave.delete(record.id);

  const recordWithTime: SheetRecord = {
    ...record,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };

  try {
    const docRef = doc(db, RECORDS_COLLECTION, recordWithTime.id);
    await setDoc(docRef, sanitizeForCloud(recordWithTime));
  } catch (err) {
    console.warn('Notice: Firebase Cloud immediate save error:', err);
  }
}

// Save a single record to Firestore (Debounced for rapid typing - 100ms)
export function saveRecordToCloud(record: SheetRecord, debounceMs = 100) {
  const recordWithTime: SheetRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  pendingRecordsToSave.set(record.id, recordWithTime);

  if (saveDebounceTimers.has(record.id)) {
    clearTimeout(saveDebounceTimers.get(record.id));
  }

  const timer = setTimeout(async () => {
    saveDebounceTimers.delete(record.id);
    const recToSave = pendingRecordsToSave.get(record.id);
    if (!recToSave) return;
    pendingRecordsToSave.delete(record.id);

    try {
      const docRef = doc(db, RECORDS_COLLECTION, recToSave.id);
      await setDoc(docRef, sanitizeForCloud(recToSave));
    } catch (err) {
      console.warn('Notice: Firebase Cloud save pending or offline:', err);
    }
  }, debounceMs);

  saveDebounceTimers.set(record.id, timer);
}

// Delete a single record from Firestore
export async function deleteRecordFromCloud(recordId: string) {
  try {
    const docRef = doc(db, RECORDS_COLLECTION, recordId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting record from Firebase Cloud:', err);
  }
}

// Save operators list to Firestore
export async function saveOperatorsToCloud(operators: string[]) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, OPERATORS_DOC);
    await setDoc(docRef, sanitizeForCloud({ operators, updatedAt: new Date().toISOString() }));
  } catch (err) {
    console.error('Error saving operators to Firebase Cloud:', err);
  }
}

// Save security configuration to Firestore
export async function saveSecurityConfigToCloud(config: SecurityConfig) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SECURITY_DOC);
    await setDoc(docRef, sanitizeForCloud({ ...config, updatedAt: new Date().toISOString() }));
  } catch (err) {
    console.error('Error saving security config to Firebase Cloud:', err);
  }
}

// Bulk sync/seed records to Firestore (e.g. on restore JSON or initial seed)
export async function syncAllRecordsToCloud(records: SheetRecord[]) {
  try {
    // Process in batches of 400 to respect Firestore batch limit of 500
    for (let i = 0; i < records.length; i += 400) {
      const chunk = records.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const docRef = doc(db, RECORDS_COLLECTION, rec.id);
        batch.set(docRef, sanitizeForCloud(rec));
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error syncing records batch to Firebase Cloud:', err);
  }
}

// Save a single audit log entry to Firestore
export async function saveAuditEntryToCloud(entry: AuditLogEntry) {
  try {
    const docRef = doc(db, AUDIT_COLLECTION, entry.id);
    await setDoc(docRef, sanitizeForCloud(entry));
  } catch (err) {
    console.warn('Notice: Error saving audit entry to Cloud:', err);
  }
}

// Bulk sync/seed audit log entries to Firestore
export async function syncAuditLogsToCloud(entries: AuditLogEntry[]) {
  try {
    for (let i = 0; i < entries.length; i += 400) {
      const chunk = entries.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((entry) => {
        const docRef = doc(db, AUDIT_COLLECTION, entry.id);
        batch.set(docRef, sanitizeForCloud(entry));
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Notice: Error syncing audit logs batch to Cloud:', err);
  }
}

