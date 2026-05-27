import { type StudioSession } from '../project/schema';
import { hydrateSessionPayload } from '../project/storage';
import { detectKey, type KeyMode } from './keyDetector';

const STORAGE_KEY = 'sonicstudio:scoresheets:v1';
const MAX_SCORESHEETS = 24;

export interface ScoresheetKeySnapshot {
  rootName: string;
  mode: KeyMode;
  label: string;
  confidence: number;
  uncertain: boolean;
}

export interface Scoresheet {
  id: string;
  name: string;
  savedAt: string;
  session: StudioSession;
  detectedKey?: ScoresheetKeySnapshot;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const normalizeKeySnapshot = (value: unknown): ScoresheetKeySnapshot | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.rootName !== 'string') return undefined;
  if (value.mode !== 'major' && value.mode !== 'minor') return undefined;
  if (typeof value.label !== 'string') return undefined;
  return {
    rootName: value.rootName,
    mode: value.mode,
    label: value.label,
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    uncertain: value.uncertain === true,
  };
};

const normalizeScoresheet = (value: unknown): Scoresheet | null => {
  if (!isRecord(value)) return null;
  const session = hydrateSessionPayload(value.session);
  if (!session) return null;
  const id = typeof value.id === 'string' && value.id
    ? value.id
    : `scoresheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, 48)
    : 'Untitled scoresheet';
  const savedAt = typeof value.savedAt === 'string' && value.savedAt
    ? value.savedAt
    : new Date().toISOString();
  return {
    id,
    name,
    savedAt,
    session,
    detectedKey: normalizeKeySnapshot(value.detectedKey),
  };
};

export const listScoresheets = (): Scoresheet[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeScoresheet)
      .filter((value): value is Scoresheet => value !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
};

const persistScoresheets = (sheets: Scoresheet[]): Scoresheet[] => {
  if (typeof window === 'undefined') return sheets;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets.slice(0, MAX_SCORESHEETS)));
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('SonicStudio: failed to persist scoresheets', error);
    }
  }
  return sheets.slice(0, MAX_SCORESHEETS);
};

export const saveScoresheet = (
  name: string,
  session: StudioSession,
  options: { replaceId?: string } = {},
): Scoresheet[] => {
  const sheets = listScoresheets();
  const cleanName = name.trim().slice(0, 48) || 'Untitled scoresheet';
  const detected = detectKey(session.project.tracks);
  const detectedKey: ScoresheetKeySnapshot = {
    rootName: detected.rootName,
    mode: detected.mode,
    label: detected.label,
    confidence: detected.confidence,
    uncertain: detected.uncertain,
  };
  const next: Scoresheet = {
    id: options.replaceId ?? `scoresheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    savedAt: new Date().toISOString(),
    session,
    detectedKey,
  };
  const filtered = options.replaceId ? sheets.filter((sheet) => sheet.id !== options.replaceId) : sheets;
  return persistScoresheets([next, ...filtered]);
};

export const renameScoresheet = (id: string, name: string): Scoresheet[] => {
  const sheets = listScoresheets().map((sheet) => (
    sheet.id === id ? { ...sheet, name: name.trim().slice(0, 48) || sheet.name } : sheet
  ));
  return persistScoresheets(sheets);
};

export const deleteScoresheet = (id: string): Scoresheet[] => {
  const next = listScoresheets().filter((sheet) => sheet.id !== id);
  return persistScoresheets(next);
};

export const loadScoresheet = (id: string): Scoresheet | null => (
  listScoresheets().find((sheet) => sheet.id === id) ?? null
);

export const clearAllScoresheets = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
