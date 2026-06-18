/**
 * Simple IndexedDB wrapper for offline admission drafts.
 * Replaces localStorage to support base64 images without QuotaExceeded errors.
 */

import { getNow } from '@/lib/clock';

const DB_NAME = 'KUCET_CMS_ADMISSION';
const STORE_NAME = 'admission_draft';
const DB_VERSION = 1;
const DRAFT_KEY = 'current_draft';

export const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('IndexedDB not available on server'));
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const saveAdmissionDraft = async (payload) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      store.put({ ...payload, id: DRAFT_KEY, timestamp: getNow() });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to local storage', err);
    throw err;
  }
};

export const getAdmissionDraft = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DRAFT_KEY);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch {
    return null;
  }
};

export const deleteAdmissionDraft = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(DRAFT_KEY);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed', err);
    throw err;
  }
};
