import type { InstrumentType } from '../project/schema';
import { normalizeCaptureSuggestionControls, type CaptureSuggestion, type CaptureSuggestionControls } from './audioRecording';

const STORAGE_KEY = 'sonicstudio:recorded-notes:v1';
const CHANGE_EVENT = 'sonicstudio:recorded-notes:change';

export interface RecordedNotePreset {
  clarity: number;
  confidence: number;
  createdAt: string;
  id: string;
  name: string;
  note: string;
  pitchHz: number | null;
  presetId: string | null;
  presetLabel: string;
  trackType: InstrumentType;
  updatedAt: string;
  controls: CaptureSuggestionControls;
}

interface PersistedRecordedNotesEnvelope {
  items: RecordedNotePreset[];
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeControls = (value: unknown): CaptureSuggestionControls | null => {
  if (!isRecord(value)) {
    return null;
  }

  return normalizeCaptureSuggestionControls(value);
};

const normalizeRecordedNotePreset = (value: unknown): RecordedNotePreset | null => {
  if (!isRecord(value)) {
    return null;
  }

  const controls = normalizeControls(value.controls);
  if (!controls) {
    return null;
  }

  if (
    typeof value.name !== 'string'
    || typeof value.note !== 'string'
    || typeof value.trackType !== 'string'
    || typeof value.presetLabel !== 'string'
    || typeof value.createdAt !== 'string'
    || typeof value.updatedAt !== 'string'
    || typeof value.clarity !== 'number'
    || typeof value.confidence !== 'number'
  ) {
    return null;
  }

  return {
    clarity: value.clarity,
    confidence: value.confidence,
    controls,
    createdAt: value.createdAt,
    id: typeof value.id === 'string' && value.id ? value.id : createId('capture'),
    name: value.name.trim().slice(0, 40) || 'Captured note',
    note: value.note,
    pitchHz: typeof value.pitchHz === 'number' ? value.pitchHz : null,
    presetId: typeof value.presetId === 'string' ? value.presetId : null,
    presetLabel: value.presetLabel,
    trackType: value.trackType as InstrumentType,
    updatedAt: value.updatedAt,
  };
};

const sortRecordedNotes = (items: RecordedNotePreset[]) => (
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
);

const emitChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const buildRecordedNotePreset = ({
  clarity,
  confidence,
  id,
  name,
  note,
  pitchHz,
  suggestion,
}: {
  clarity: number;
  confidence: number;
  id?: string;
  name: string;
  note: string;
  pitchHz: number | null;
  suggestion: CaptureSuggestion;
}): RecordedNotePreset => {
  const timestamp = new Date().toISOString();

  return {
    clarity,
    confidence,
    controls: { ...suggestion.controls },
    createdAt: timestamp,
    id: id ?? createId('capture'),
    name: name.trim().slice(0, 40) || `${note} ${suggestion.presetLabel}`,
    note,
    pitchHz,
    presetId: suggestion.presetId,
    presetLabel: suggestion.presetLabel,
    trackType: suggestion.trackType,
    updatedAt: timestamp,
  };
};

export const loadRecordedNotePresets = (): RecordedNotePreset[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const items = isRecord(parsed) && Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : [];

    return sortRecordedNotes(items
      .map((item) => normalizeRecordedNotePreset(item))
      .filter((item): item is RecordedNotePreset => item !== null));
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to load recorded note presets', error);
    }
    return [];
  }
};

export const persistRecordedNotePresets = (items: RecordedNotePreset[]): RecordedNotePreset[] => {
  const normalized = sortRecordedNotes(items
    .map((item) => normalizeRecordedNotePreset(item))
    .filter((item): item is RecordedNotePreset => item !== null));

  if (typeof window === 'undefined') {
    return normalized;
  }

  try {
    const envelope: PersistedRecordedNotesEnvelope = {
      items: normalized,
      version: 1,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    emitChange();
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to persist recorded note presets', error);
    }
  }

  return normalized;
};

export const saveRecordedNotePreset = (preset: RecordedNotePreset): RecordedNotePreset[] => {
  const existing = loadRecordedNotePresets();
  const nextPreset = {
    ...preset,
    updatedAt: new Date().toISOString(),
  };
  const next = [
    nextPreset,
    ...existing.filter((entry) => entry.id !== nextPreset.id),
  ];

  return persistRecordedNotePresets(next);
};

export const subscribeRecordedNotePresets = (listener: (items: RecordedNotePreset[]) => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => {
    listener(loadRecordedNotePresets());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      handleChange();
    }
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
};