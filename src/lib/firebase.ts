import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SheetRecord } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = (firebaseConfig as Record<string, string>).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

export const RECORDS_COLLECTION = 'till_records';
export const SETTINGS_COLLECTION = 'till_settings';
export const OPERATORS_DOC = 'operators_list';

const saveDebounceTimers = new Map<string, any>();
const pendingRecordsToSave = new Map<string, SheetRecord>();

// Immediately flush any pending debounced saves to Firestore
export async function flushPendingSaves() {
  for (const timer of saveDebounceTimers.values()) {
    clearTimeout(timer);
  }
  saveDebounceTimers.clear();

  if (pendingRecordsToSave.size === 0) return;

  const recordsToSave = Array.from(pendingRecordsToSave.values());
  pendingRecordsToSave.clear();

  try {
    const batch = writeBatch(db);
    recordsToSave.forEach((rec) => {
      const docRef = doc(db, RECORDS_COLLECTION, rec.id);
      batch.set(docRef, rec);
    });
    await batch.commit();
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
export async function saveRecordToCloudImmediately(record: SheetRecord) {
  if (saveDebounceTimers.has(record.id)) {
    clearTimeout(saveDebounceTimers.get(record.id));
    saveDebounceTimers.delete(record.id);
  }
  pendingRecordsToSave.delete(record.id);

  try {
    const recordWithTime = {
      ...record,
      updatedAt: record.updatedAt || new Date().toISOString(),
    };
    const docRef = doc(db, RECORDS_COLLECTION, recordWithTime.id);
    await setDoc(docRef, recordWithTime);
  } catch (err) {
    console.warn('Notice: Firebase Cloud immediate save error:', err);
  }
}

// Save a single record to Firestore (Debounced for rapid typing)
export async function saveRecordToCloud(record: SheetRecord, debounceMs = 300) {
  const recordWithTime = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  pendingRecordsToSave.set(record.id, recordWithTime);

  if (saveDebounceTimers.has(record.id)) {
    clearTimeout(saveDebounceTimers.get(record.id));
  }

  const timer = setTimeout(async () => {
    saveDebounceTimers.delete(record.id);
    const recToSave = pendingRecordsToSave.get(record.id) || recordWithTime;
    pendingRecordsToSave.delete(record.id);

    try {
      const docRef = doc(db, RECORDS_COLLECTION, recToSave.id);
      await setDoc(docRef, recToSave);
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
    await setDoc(docRef, { operators, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Error saving operators to Firebase Cloud:', err);
  }
}

// Bulk sync/seed records to Firestore (e.g. on restore JSON or initial seed)
export async function syncAllRecordsToCloud(records: SheetRecord[]) {
  try {
    const batch = writeBatch(db);
    records.forEach((rec) => {
      const docRef = doc(db, RECORDS_COLLECTION, rec.id);
      batch.set(docRef, rec);
    });
    await batch.commit();
  } catch (err) {
    console.error('Error syncing records batch to Firebase Cloud:', err);
  }
}
