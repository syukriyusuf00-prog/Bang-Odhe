import type { MediaSlotConfig, MediaSlotId } from '../types';

const DB_NAME = 'gizisync_media_studio_db';
const STORE_NAME = 'media_slots';
const DB_VERSION = 1;
const FALLBACK_PREFIX = 'gizisync_slot_v1_';

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalMediaSlot(config: MediaSlotConfig): Promise<void> {
  const db = await openMediaDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({
          ...config,
          updatedAt: config.updatedAt ? config.updatedAt.toISOString() : new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      // Fallback to localStorage below
    }
  }

  try {
    const compact = {
      ...config,
      originalDataUrl: undefined,
      updatedAt: config.updatedAt ? config.updatedAt.toISOString() : new Date().toISOString(),
    };
    window.localStorage.setItem(`${FALLBACK_PREFIX}${config.slotId}`, JSON.stringify(compact));
  } catch {
    // Ignore storage quota overflow gracefully
  }
}

export async function loadAllLocalMediaSlots(): Promise<Partial<Record<MediaSlotId, MediaSlotConfig>>> {
  const result: Partial<Record<MediaSlotId, MediaSlotConfig>> = {};
  const db = await openMediaDb();
  if (db) {
    try {
      const rows = await new Promise<Array<MediaSlotConfig & { updatedAt?: string }>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result as Array<MediaSlotConfig & { updatedAt?: string }>);
        req.onerror = () => reject(req.error);
      });
      for (const row of rows) {
        result[row.slotId] = {
          ...row,
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
          source: 'local',
        };
      }
      return result;
    } catch {
      // Fallback below
    }
  }

  const slotIds: MediaSlotId[] = [
    'hero_portrait',
    'app_sispermbg',
    'app_status_gizi',
    'app_sop_sistakol',
    'app_gizi_seimbang',
  ];
  for (const slotId of slotIds) {
    try {
      const raw = window.localStorage.getItem(`${FALLBACK_PREFIX}${slotId}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as MediaSlotConfig & { updatedAt?: string };
      result[slotId] = {
        ...parsed,
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : null,
        source: 'local',
      };
    } catch {
      // Skip malformed entry
    }
  }
  return result;
}

export async function deleteLocalMediaSlot(slotId: MediaSlotId): Promise<void> {
  const db = await openMediaDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(slotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore
    }
  }
  try {
    window.localStorage.removeItem(`${FALLBACK_PREFIX}${slotId}`);
  } catch {
    // Ignore
  }
}
