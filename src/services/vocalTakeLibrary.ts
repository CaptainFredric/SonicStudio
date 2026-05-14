const DB_NAME = 'sonicstudio-vocal-takes';
const STORE_NAME = 'takes';
const CHANGE_EVENT = 'sonicstudio:vocal-takes:change';

export interface VocalTakeSummary {
  clarity: number;
  createdAt: string;
  durationSeconds: number;
  id: string;
  mimeType: string;
  name: string;
  note: string | null;
  sizeBytes: number;
  updatedAt: string;
}

interface VocalTakeRecord extends VocalTakeSummary {
  blob: Blob;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isIndexedDbAvailable = () => (
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
);

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const openDatabase = async () => {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is unavailable in this browser.');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the vocal take library.'));
  });
};

const emitChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const normalizeVocalTakeRecord = (value: unknown): VocalTakeRecord | null => {
  if (!isRecord(value) || !(value.blob instanceof Blob)) {
    return null;
  }

  if (
    typeof value.name !== 'string'
    || typeof value.createdAt !== 'string'
    || typeof value.updatedAt !== 'string'
    || typeof value.durationSeconds !== 'number'
    || typeof value.clarity !== 'number'
  ) {
    return null;
  }

  return {
    blob: value.blob,
    clarity: value.clarity,
    createdAt: value.createdAt,
    durationSeconds: Math.max(0, value.durationSeconds),
    id: typeof value.id === 'string' && value.id ? value.id : createId('vocal'),
    mimeType: typeof value.mimeType === 'string' && value.mimeType ? value.mimeType : value.blob.type || 'audio/wav',
    name: value.name.trim().slice(0, 56) || 'Vocal take',
    note: typeof value.note === 'string' && value.note.trim() ? value.note.trim() : null,
    sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : value.blob.size,
    updatedAt: value.updatedAt,
  };
};

const toSummary = (record: VocalTakeRecord): VocalTakeSummary => ({
  clarity: record.clarity,
  createdAt: record.createdAt,
  durationSeconds: record.durationSeconds,
  id: record.id,
  mimeType: record.mimeType,
  name: record.name,
  note: record.note,
  sizeBytes: record.sizeBytes,
  updatedAt: record.updatedAt,
});

const sortVocalTakes = <T extends VocalTakeSummary>(items: T[]) => (
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
);

export const saveVocalTake = async ({
  blob,
  clarity,
  durationSeconds,
  name,
  note,
}: {
  blob: Blob;
  clarity: number;
  durationSeconds: number;
  name: string;
  note: string | null;
}) => {
  const database = await openDatabase();

  try {
    const timestamp = new Date().toISOString();
    const record: VocalTakeRecord = {
      blob,
      clarity,
      createdAt: timestamp,
      durationSeconds: Math.max(0, durationSeconds),
      id: createId('vocal'),
      mimeType: blob.type || 'audio/wav',
      name: name.trim().slice(0, 56) || 'Vocal take',
      note: note?.trim() ? note.trim() : null,
      sizeBytes: blob.size,
      updatedAt: timestamp,
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the vocal take.'));
      transaction.objectStore(STORE_NAME).put(record);
    });

    emitChange();
    return toSummary(record);
  } finally {
    database.close();
  }
};

export const listVocalTakeSummaries = async () => {
  const database = await openDatabase();

  try {
    const records = await new Promise<VocalTakeRecord[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => {
        const normalized = Array.isArray(request.result)
          ? request.result
            .map((record) => normalizeVocalTakeRecord(record))
            .filter((record): record is VocalTakeRecord => record !== null)
          : [];
        resolve(sortVocalTakes(normalized));
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read the vocal take library.'));
    });

    return records.map(toSummary);
  } finally {
    database.close();
  }
};

export const getVocalTakeBlob = async (id: string) => {
  const database = await openDatabase();

  try {
    const record = await new Promise<VocalTakeRecord | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(id);

      request.onsuccess = () => resolve(normalizeVocalTakeRecord(request.result));
      request.onerror = () => reject(request.error ?? new Error('Could not read that vocal take.'));
    });

    return record?.blob ?? null;
  } finally {
    database.close();
  }
};

export const deleteVocalTake = async (id: string) => {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not delete the vocal take.'));
      transaction.objectStore(STORE_NAME).delete(id);
    });

    emitChange();
  } finally {
    database.close();
  }
};

export const subscribeVocalTakeSummaries = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => listener();
  const handleFocus = () => listener();

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('focus', handleFocus);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('focus', handleFocus);
  };
};