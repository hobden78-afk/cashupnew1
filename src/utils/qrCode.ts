import QRCode from 'qrcode';
import { SheetRecord, GrandTotals } from '../types';
import { formatCurrency, formatToUKDate } from './calculations';

/**
 * Builds a structured, high-density verification text string for the QR code.
 * Scanning this with any smartphone camera or 2D barcode scanner instantly reveals
 * the record ID, audit date, operator, key financial totals, and variance status.
 */
export function buildRecordAuditPayload(record: SheetRecord, totals: GrandTotals): string {
  const formattedDate = formatToUKDate(record.date);
  const varianceStatus =
    totals.totalVariance < 0
      ? 'SHORT'
      : totals.totalVariance > 0
      ? 'OVER'
      : 'BALANCED';

  return [
    `--- TILL AUDIT VERIFICATION ---`,
    `ID: ${record.id}`,
    `Date: ${formattedDate} (${record.date})`,
    `Operator: ${record.operator || 'Unspecified'}`,
    `Status: ${record.isSaved ? 'Finalised / Locked' : 'Draft / Unsaved'}`,
    `Expected Takings (D): ${formatCurrency(totals.totalCol3Expected)}`,
    `Actual Count (H): ${formatCurrency(totals.totalCol7Actual)}`,
    `Cash Banked (E): ${formatCurrency(totals.totalCol4Banking)}`,
    `Float Retained (F): ${formatCurrency(totals.totalCol5Float)}`,
    `Card PDQ (G): ${formatCurrency(totals.totalCol6Card)}`,
    `Total Variance: ${formatCurrency(totals.totalVariance, true)} [${varianceStatus}]`,
    `Active Tills: ${record.rows.length}`,
    `Updated: ${record.updatedAt || new Date().toISOString()}`,
  ].join('\n');
}

/**
 * Generates a QR Code as a high-resolution base64 PNG data URL.
 */
export async function generateRecordQrDataUrl(
  record: SheetRecord,
  totals: GrandTotals,
  size: number = 200
): Promise<string> {
  const payload = buildRecordAuditPayload(record, totals);
  try {
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code data URL:', error);
    return '';
  }
}

/**
 * Generates a QR Code as an SVG string for sharp rendering at any scale.
 */
export async function generateRecordQrSvg(
  record: SheetRecord,
  totals: GrandTotals,
  size: number = 100
): Promise<string> {
  const payload = buildRecordAuditPayload(record, totals);
  try {
    return await QRCode.toString(payload, {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    return '';
  }
}
