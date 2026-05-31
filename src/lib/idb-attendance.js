/**
 * Simple IndexedDB wrapper for offline attendance management.
 */

const DB_NAME = 'KUCET_CMS_OFFLINE';
const STORE_NAME = 'pending_attendance';
const DB_VERSION = 1;

export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // We use a composite key or a generated one. 
        // A simple generated one is easiest for syncing.
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const savePendingAttendance = async (payload) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Check if we already have a pending sync for this specific assignment/date/session
    // and update it if so, otherwise add new.
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result;
      const existing = all.find(item => 
        item.assignment_id === payload.assignment_id && 
        item.date === payload.date && 
        item.session === payload.session
      );

      if (existing) {
        store.put({ ...payload, id: existing.id, timestamp: Date.now() });
      } else {
        store.add({ ...payload, timestamp: Date.now() });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};

export const getPendingAttendance = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const deletePendingAttendance = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};
