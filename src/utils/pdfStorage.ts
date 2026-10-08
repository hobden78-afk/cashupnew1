import { AttachedPdfFile } from '../types';

const DB_NAME = 'delta_till_attachments_db';
const STORE_NAME = 'pdf_files';
const DB_VERSION = 1;

// Maximum size stored directly in Firestore doc (700KB) to respect the 1MB Firestore document limit
export const MAX_FIRESTORE_PDF_SIZE = 700 * 1024; // 700KB
// Maximum allowed PDF upload size (15MB)
export const MAX_PDF_UPLOAD_SIZE = 15 * 1024 * 1024; // 15MB

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'recordId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a PDF to local IndexedDB for this record
 */
export async function savePdfToIndexedDb(recordId: string, pdf: AttachedPdfFile): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        recordId,
        pdf,
        savedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write error for PDF:', err);
  }
}

/**
 * Retrieve a PDF from local IndexedDB for this record
 */
export async function getPdfFromIndexedDb(recordId: string): Promise<AttachedPdfFile | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(recordId);
      req.onsuccess = () => {
        if (req.result && req.result.pdf) {
          resolve(req.result.pdf as AttachedPdfFile);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read error for PDF:', err);
    return null;
  }
}

/**
 * Delete a PDF from local IndexedDB for this record
 */
export async function deletePdfFromIndexedDb(recordId: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(recordId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error for PDF:', err);
  }
}

/**
 * Convert a File object to a Base64 data URL string
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable string (e.g., 245 KB, 1.4 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Trigger download of a base64 data URL as a file
 */
export function downloadPdfDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Convert a base64 Data URL to a native binary Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'application/pdf';
  const binaryStr = atob(parts[1] || '');
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Open a PDF safely in a new browser tab via Blob URL
 */
export function openPdfInNewTab(dataUrl: string): void {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (err) {
    console.error('Failed to open PDF in new tab:', err);
  }
}
