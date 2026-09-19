// Utility for application password hashing and verification using Web Crypto API

export interface SecurityConfig {
  isEnabled: boolean;
  passwordHash: string;
  salt: string;
  hint?: string;
  autoLockMinutes: number; // 0 = immediate, 2, 5, 15, 30, -1 = never
  requireForSheetUnlock?: boolean;
  updatedAt?: string;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  isEnabled: false,
  passwordHash: '',
  salt: '',
  hint: '',
  autoLockMinutes: 15,
  requireForSheetUnlock: false,
};

export const SECURITY_STORAGE_KEY = 'delta_till_security_config_v1';
export const SECURITY_SESSION_KEY = 'delta_till_session_unlocked_v1';

// Generate random salt for cryptographic resistance
export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback
  return Math.random().toString(36).substring(2, 18);
}

// Compute SHA-256 hash of password + salt
export async function hashPassword(password: string, salt: string): Promise<string> {
  const text = `${salt}:${password}:delta_till_salt`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Web Crypto API failed, using fallback hash', e);
    }
  }
  
  // Fallback simple bitwise hash for environments without WebCrypto
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

// Verify input password against stored salt and hash
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash) return false;
  const computed = await hashPassword(password, salt);
  return computed === expectedHash;
}
