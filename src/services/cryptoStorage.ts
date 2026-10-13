/**
 * AES-GCM Encryption Layer using native Web Crypto API
 * with IndexedDB & localStorage persistence for BAGJA EXAM
 */

const DB_NAME = 'BagjaExamSecureDB';
const STORE_NAME = 'encrypted_cache';
const KEY_SALT = 'BAGJA_EXAM_SMPN7_CIMAHI_2026';

// Derive AES-GCM CryptoKey using PBKDF2
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(KEY_SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('SECURE_SALT_7_CIMAHI'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt string with AES-GCM
export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    // Pack IV + ciphertext into base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('AES-GCM encryption fallback to base64 obfuscation:', err);
    return btoa(encodeURIComponent(data));
  }
}

// Decrypt string with AES-GCM
export async function decryptData(encryptedBase64: string): Promise<string> {
  try {
    const binary = atob(encryptedBase64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    if (combined.length < 13) {
      // Fallback decode
      return decodeURIComponent(atob(encryptedBase64));
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await getCryptoKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    try {
      return decodeURIComponent(atob(encryptedBase64));
    } catch (_) {
      throw new Error('Dekripsi data gagal.');
    }
  }
}

// IndexedDB Helper
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save encrypted data to IndexedDB + localStorage
export async function saveSecureStorage(key: string, value: any): Promise<void> {
  const jsonStr = JSON.stringify(value);
  const encrypted = await encryptData(jsonStr);

  // 1. localStorage backup
  try {
    localStorage.setItem(`SECURE_${key}`, encrypted);
  } catch (_) {}

  // 2. IndexedDB persistence
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, data: encrypted, updatedAt: new Date().toISOString() });
  } catch (_) {}
}

// Load decrypted data from IndexedDB or localStorage
export async function loadSecureStorage<T>(key: string): Promise<T | null> {
  // 1. Try IndexedDB
  try {
    const db = await openIndexedDB();
    const result = await new Promise<any>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (result && result.data) {
      const decrypted = await decryptData(result.data);
      return JSON.parse(decrypted) as T;
    }
  } catch (_) {}

  // 2. Try localStorage fallback
  try {
    const stored = localStorage.getItem(`SECURE_${key}`);
    if (stored) {
      const decrypted = await decryptData(stored);
      return JSON.parse(decrypted) as T;
    }
  } catch (_) {}

  return null;
}
