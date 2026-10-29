/**
 * IndexedDB Persistent Storage for Past Space Reconstructions
 * Stores history items, reports, and real binary blobs (PNG, WAV, MP4, TXT)
 */

import { HistoryItem } from '../types';

const DB_NAME = 'astra_history_db';
const DB_VERSION = 1;
const STORE_NAME = 'reconstructions';

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Prepare serializable record (keep Blobs as IndexedDB supports Blobs natively)
    const record: HistoryItem = {
      ...item,
      // URLs will be regenerated from Blobs on read
      originalUrl: undefined,
      reconstructedUrl: undefined,
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllHistory(): Promise<HistoryItem[]> {
  try {
    const db = await openHistoryDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: HistoryItem[] = (req.result || []).map((item: HistoryItem) => {
          let originalUrl = item.originalUrl;
          let reconstructedUrl = item.reconstructedUrl;

          if (item.originalBlob) {
            originalUrl = URL.createObjectURL(item.originalBlob);
          }
          if (item.reconstructedBlob) {
            reconstructedUrl = URL.createObjectURL(item.reconstructedBlob);
          }

          return {
            ...item,
            originalUrl,
            reconstructedUrl,
          };
        });

        // Sort latest first
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load history from IndexedDB:', err);
    return [];
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
