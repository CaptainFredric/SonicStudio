// Captured note strings — the studio's mini shelf for short musical
// ideas the user wants to keep handy without committing them to a
// pattern slot.
//
// A "string" here is just a sequence of notes you'd hum or type out
// (e.g. "C4 E4 G4 B4"). The user can save many of them and later drop
// any one onto a lane, where it converts to the existing PatternSegment
// shape and rides the same applyPatternSegment / stitch path the loop
// browser already uses.
//
// Read-only on the audio engine. Persists to localStorage. Authored as
// the smallest possible extension that complements songTranscription
// (whole-song captures) and recordedNoteLibrary (single-note captures).
//
// String syntax:
//   "C4 E4 G4 B4"     four single-step notes
//   "C4 . E4 G4"      "." is a rest at that step
//   "C4*2 E4 G4*3"    "*N" holds the note for N steps (gate = N)
//   "C4@0.9 E4@0.5"   "@V" sets velocity (0..1) on that note
//
// All three suffixes can combine: "C4*2@0.85".

import {
  createEmptyPattern,
  createStepEvent,
  type NoteEvent,
  type StepValue,
} from '../project/schema';
import { clampNoteGate, NOTE_GATE_MIN, NOTE_GATE_MAX } from '../utils/noteEditing';
import { NOTE_NAMES_SHARP, PITCH_CLASS_BY_NAME } from '../utils/pitch';
import type { PatternSegment } from './patternSegments';

// Schema's own gate/velocity clamps aren't exported. Mirror the same
// bounds locally so a captured string can never store an out-of-range
// value that the schema would reject later.
const clampStepGate = (value: number) => clampNoteGate(
  Math.max(NOTE_GATE_MIN, Math.min(NOTE_GATE_MAX, value)),
);
const clampStepVelocity = (value: number) => Math.max(0.1, Math.min(1, value));

const STORAGE_KEY = 'sonicstudio:note-strings:v1';
const CHANGE_EVENT = 'sonicstudio:note-strings:change';
const MAX_STORED_STRINGS = 32;
const MAX_NOTES_PER_STRING = 64;

export type NoteStringSource = 'typed' | 'pasted' | 'transcribed' | 'recorded';

export interface CapturedNoteToken {
  /** Pitch name, e.g. "C4". Always upper-case A..G, optional #/b, then an integer octave. */
  note: string;
  /** Step-lengths held, >= 0.125. Defaults to 1. */
  gate: number;
  /** 0..1. Defaults to 0.78. */
  velocity: number;
}

export interface CapturedNoteString {
  id: string;
  name: string;
  source: NoteStringSource;
  /** The note sequence in order. Rests are represented as null entries. */
  tokens: Array<CapturedNoteToken | null>;
  /** Plain-text form the user originally typed, for round-trip editing. */
  raw: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedEnvelope {
  items: CapturedNoteString[];
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const createId = () => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `string_${globalThis.crypto.randomUUID()}`;
  }
  return `string_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
};

// --- Parsing ---------------------------------------------------------------

const NOTE_TOKEN_REGEX = /^([A-Ga-g])([#b]?)(-?\d+)$/;

const normalizePitch = (raw: string): string | null => {
  const match = raw.match(NOTE_TOKEN_REGEX);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = match[3];
  // Tone.js / our engine expects "C#" (sharp) not "Db". Normalize flats to sharps.
  const sharpFor: Record<string, string> = {
    Cb: 'B', Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#',
  };
  if (accidental === 'b') {
    const key = `${letter}b`;
    const sharp = sharpFor[key];
    return sharp ? `${sharp}${octave}` : null;
  }
  return `${letter}${accidental}${octave}`;
};

interface ParseOptions {
  /** Hard cap on tokens kept (defaults to MAX_NOTES_PER_STRING). */
  maxTokens?: number;
}

export interface ParsedNoteString {
  ok: boolean;
  tokens: Array<CapturedNoteToken | null>;
  /** Tokens the parser could not read; useful for showing inline errors. */
  rejected: string[];
}

/**
 * Parse a free-form note string. Whitespace, commas, and `|` all separate
 * tokens. Tokens that don't match the syntax land in `rejected` rather
 * than throwing — callers decide whether to save or coach the user.
 */
export const parseNoteString = (input: string, options: ParseOptions = {}): ParsedNoteString => {
  const maxTokens = options.maxTokens ?? MAX_NOTES_PER_STRING;
  const rawTokens = input
    .split(/[\s,|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, maxTokens);

  const tokens: Array<CapturedNoteToken | null> = [];
  const rejected: string[] = [];

  rawTokens.forEach((token) => {
    if (token === '.' || token === '-') {
      tokens.push(null);
      return;
    }

    // Strip the gate / velocity suffixes off the head pitch token.
    let pitchRaw = token;
    let gate = 1;
    let velocity = 0.78;

    const gateMatch = pitchRaw.match(/\*([0-9.]+)/);
    if (gateMatch) {
      const value = Number.parseFloat(gateMatch[1]);
      if (Number.isFinite(value)) gate = value;
      pitchRaw = pitchRaw.replace(/\*[0-9.]+/, '');
    }

    const velocityMatch = pitchRaw.match(/@([0-9.]+)/);
    if (velocityMatch) {
      const value = Number.parseFloat(velocityMatch[1]);
      if (Number.isFinite(value)) velocity = value;
      pitchRaw = pitchRaw.replace(/@[0-9.]+/, '');
    }

    const pitch = normalizePitch(pitchRaw);
    if (!pitch) {
      rejected.push(token);
      return;
    }

    tokens.push({
      note: pitch,
      gate: clampStepGate(gate),
      velocity: clampStepVelocity(velocity),
    });
  });

  return {
    ok: rejected.length === 0 && tokens.length > 0,
    tokens,
    rejected,
  };
};

// --- PatternSegment conversion --------------------------------------------

const STEP_QUANTA = [8, 16, 32, 64, 128];

const pickStepsPerPattern = (tokens: Array<CapturedNoteToken | null>): number => {
  const usedSteps = tokens.reduce((sum, token) => sum + (token ? Math.max(1, Math.round(token.gate)) : 1), 0);
  return STEP_QUANTA.find((option) => option >= usedSteps) ?? STEP_QUANTA[STEP_QUANTA.length - 1];
};

const buildSegmentSteps = (
  tokens: Array<CapturedNoteToken | null>,
  stepsPerPattern: number,
): StepValue[] => {
  const grid = createEmptyPattern(stepsPerPattern);
  let cursor = 0;

  for (const token of tokens) {
    if (cursor >= stepsPerPattern) break;
    if (token === null) {
      cursor += 1;
      continue;
    }

    const event: NoteEvent = createStepEvent(token.note, {
      gate: token.gate,
      velocity: token.velocity,
    });
    grid[cursor] = [...grid[cursor], event];
    cursor += Math.max(1, Math.round(token.gate));
  }

  return grid;
};

/**
 * Convert a captured string into the same PatternSegment shape the loop
 * browser uses, so it can ride existing apply / stitch dispatchers.
 */
export const noteStringToPatternSegment = (
  captured: CapturedNoteString,
  sourceTrackName: string,
  sourceTrackType: PatternSegment['sourceTrackType'] = 'lead',
): PatternSegment => {
  const stepsPerPattern = pickStepsPerPattern(captured.tokens);
  return {
    automation: {
      level: Array.from({ length: stepsPerPattern }, () => 0.5),
      tone: Array.from({ length: stepsPerPattern }, () => 0.5),
    },
    createdAt: captured.createdAt,
    id: `segment_${captured.id}`,
    name: captured.name,
    sourceTrackName,
    sourceTrackType,
    steps: buildSegmentSteps(captured.tokens, stepsPerPattern),
    stepsPerPattern,
  };
};

// --- Storage --------------------------------------------------------------

const normalizeToken = (value: unknown): CapturedNoteToken | null => {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  if (typeof value.note !== 'string') return null;
  return {
    note: value.note,
    gate: typeof value.gate === 'number' ? clampStepGate(value.gate) : 1,
    velocity: typeof value.velocity === 'number' ? clampStepVelocity(value.velocity) : 0.78,
  };
};

const normalizeCapturedString = (value: unknown): CapturedNoteString | null => {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string') return null;
  const tokens = Array.isArray(value.tokens)
    ? value.tokens.map(normalizeToken).slice(0, MAX_NOTES_PER_STRING)
    : [];
  if (tokens.length === 0) return null;

  const source = ['typed', 'pasted', 'transcribed', 'recorded'].includes(String(value.source))
    ? value.source as NoteStringSource
    : 'typed';

  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name: value.name.trim().slice(0, 48) || 'Captured string',
    source,
    tokens,
    raw: typeof value.raw === 'string' ? value.raw : '',
    createdAt,
    updatedAt,
  };
};

const sortByMostRecent = (items: CapturedNoteString[]) => (
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
);

const emitChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const loadCapturedNoteStrings = (): CapturedNoteString[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const items = isRecord(parsed) && Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed) ? parsed : [];

    return sortByMostRecent(
      items
        .map((item) => normalizeCapturedString(item))
        .filter((item): item is CapturedNoteString => item !== null),
    );
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to load captured note strings', error);
    }
    return [];
  }
};

export const persistCapturedNoteStrings = (items: CapturedNoteString[]): CapturedNoteString[] => {
  const normalized = sortByMostRecent(
    items
      .map((item) => normalizeCapturedString(item))
      .filter((item): item is CapturedNoteString => item !== null),
  ).slice(0, MAX_STORED_STRINGS);

  if (typeof window === 'undefined') return normalized;

  try {
    const envelope: PersistedEnvelope = { items: normalized, version: 1 };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    emitChange();
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to persist captured note strings', error);
    }
  }

  return normalized;
};

interface CaptureInput {
  name?: string;
  raw: string;
  source?: NoteStringSource;
}

/**
 * Parse `raw`, save the resulting tokens as a new captured string, and
 * return the updated list. Returns `null` if parsing produced no tokens.
 */
export const captureNoteString = (input: CaptureInput): CapturedNoteString[] | null => {
  const parsed = parseNoteString(input.raw);
  if (parsed.tokens.length === 0) return null;

  const now = new Date().toISOString();
  const next: CapturedNoteString = {
    id: createId(),
    name: (input.name ?? '').trim().slice(0, 48) || defaultNameForTokens(parsed.tokens),
    source: input.source ?? 'typed',
    tokens: parsed.tokens,
    raw: input.raw,
    createdAt: now,
    updatedAt: now,
  };

  const existing = loadCapturedNoteStrings();
  return persistCapturedNoteStrings([next, ...existing]);
};

interface SaveTokensInput {
  name: string;
  tokens: Array<CapturedNoteToken | null>;
  source?: NoteStringSource;
}

/**
 * Save a pre-built token sequence to the shelf. Used by surfaces like
 * the chord-starter picker that compose tokens directly rather than
 * parsing free-form text.
 */
export const saveCapturedNoteStringFromTokens = (input: SaveTokensInput): CapturedNoteString[] | null => {
  const tokens = input.tokens.slice(0, MAX_NOTES_PER_STRING);
  if (tokens.length === 0) return null;

  const now = new Date().toISOString();
  const next: CapturedNoteString = {
    id: createId(),
    name: input.name.trim().slice(0, 48) || defaultNameForTokens(tokens),
    source: input.source ?? 'typed',
    tokens,
    raw: tokens
      .map((token) => (token === null ? '.' : token.gate > 1 ? `${token.note}*${token.gate}` : token.note))
      .join(' '),
    createdAt: now,
    updatedAt: now,
  };

  return persistCapturedNoteStrings([next, ...loadCapturedNoteStrings()]);
};

export const renameCapturedNoteString = (id: string, name: string): CapturedNoteString[] => {
  const existing = loadCapturedNoteStrings();
  const next = existing.map((entry) => (
    entry.id === id
      ? { ...entry, name: name.trim().slice(0, 48) || entry.name, updatedAt: new Date().toISOString() }
      : entry
  ));
  return persistCapturedNoteStrings(next);
};

export const removeCapturedNoteString = (id: string): CapturedNoteString[] => {
  const existing = loadCapturedNoteStrings();
  return persistCapturedNoteStrings(existing.filter((entry) => entry.id !== id));
};

// MIDI <-> note-name plumbing used by transposeCapturedNoteString.
// Pitch-class map and sharp names come from the shared pitch util.
const noteNameToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G])(#?)(-?\d+)$/);
  if (!match) return null;
  const pitchClass = `${match[1]}${match[2]}`;
  const pc = PITCH_CLASS_BY_NAME[pitchClass];
  if (pc === undefined) return null;
  const octave = Number.parseInt(match[3], 10);
  if (!Number.isFinite(octave)) return null;
  return (octave + 1) * 12 + pc;
};

const midiToNoteName = (midi: number): string => {
  const safeMidi = Math.max(0, Math.min(127, Math.round(midi)));
  const pc = ((safeMidi % 12) + 12) % 12;
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${NOTE_NAMES_SHARP[pc]}${octave}`;
};

/**
 * Return a new shelf list with `id` transposed by `semitones`. Notes
 * that would fall out of MIDI range are clamped, rests pass through.
 * The raw text form is regenerated so the entry reads cleanly after
 * an export / import round-trip.
 */
export const transposeCapturedNoteString = (id: string, semitones: number): CapturedNoteString[] => {
  const existing = loadCapturedNoteStrings();
  if (!Number.isFinite(semitones) || semitones === 0) return existing;
  const next = existing.map((entry) => {
    if (entry.id !== id) return entry;
    const shiftedTokens = entry.tokens.map((token) => {
      if (token === null) return null;
      const midi = noteNameToMidi(token.note);
      if (midi === null) return token;
      const shifted = midiToNoteName(midi + semitones);
      return { ...token, note: shifted };
    });
    return {
      ...entry,
      tokens: shiftedTokens,
      raw: shiftedTokens
        .map((token) => (token === null ? '.' : token.gate > 1 ? `${token.note}*${token.gate}` : token.note))
        .join(' '),
      updatedAt: new Date().toISOString(),
    };
  });
  return persistCapturedNoteStrings(next);
};

/**
 * Clone an existing shelf entry under a "(copy)" name. Useful when the
 * user wants to keep an original around while tweaking a variation in
 * a session segment, or when they want to apply one string to several
 * lanes in slightly different forms.
 */
export const duplicateCapturedNoteString = (id: string): CapturedNoteString[] => {
  const existing = loadCapturedNoteStrings();
  const source = existing.find((entry) => entry.id === id);
  if (!source) return existing;
  const now = new Date().toISOString();
  const baseName = source.name.replace(/\s*\(copy(\s+\d+)?\)\s*$/i, '');
  // If there is already a "(copy)" of this base, bump the number so we
  // don't pile up identical labels.
  const matchingCopies = existing.filter((entry) => (
    entry.name === `${baseName} (copy)` || /^\(copy\s+\d+\)$/.test(entry.name.replace(baseName, '').trim())
  )).length;
  const copyName = matchingCopies === 0
    ? `${baseName} (copy)`
    : `${baseName} (copy ${matchingCopies + 1})`;
  const clone: CapturedNoteString = {
    ...source,
    id: createId(),
    name: copyName.slice(0, 48),
    tokens: source.tokens.map((token) => (token === null ? null : { ...token })),
    createdAt: now,
    updatedAt: now,
  };
  return persistCapturedNoteStrings([clone, ...existing]);
};

export const clearCapturedNoteStrings = (): CapturedNoteString[] => (
  persistCapturedNoteStrings([])
);

// --- Import / export -----------------------------------------------------

const EXPORT_FORMAT_VERSION = 1;

export interface NoteStringExportEnvelope {
  source: 'sonicstudio';
  kind: 'note-strings';
  exported_at: string;
  version: typeof EXPORT_FORMAT_VERSION;
  items: CapturedNoteString[];
}

/**
 * Pretty-printed JSON of the full shelf for sharing or backing up.
 * Includes the schema version so a future import can branch on shape.
 */
export const serializeCapturedNoteStrings = (
  items: CapturedNoteString[] = loadCapturedNoteStrings(),
): string => {
  const envelope: NoteStringExportEnvelope = {
    source: 'sonicstudio',
    kind: 'note-strings',
    exported_at: new Date().toISOString(),
    version: EXPORT_FORMAT_VERSION,
    items,
  };
  return JSON.stringify(envelope, null, 2);
};

export interface NoteStringImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  items: CapturedNoteString[];
}

/**
 * Merge an exported JSON payload into the existing shelf. New entries
 * keep their original id when there's no collision; collisions are
 * skipped (the existing entry wins so the user can't accidentally clobber
 * an in-flight idea). Returns counts so the caller can toast usefully.
 */
export const importCapturedNoteStringsFromJson = (raw: string): NoteStringImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { imported: 0, skipped: 0, duplicates: 0, items: loadCapturedNoteStrings() };
  }

  const rawItems = isRecord(parsed) && Array.isArray(parsed.items)
    ? parsed.items
    : Array.isArray(parsed)
      ? parsed
      : [];

  const candidates = rawItems
    .map((item) => normalizeCapturedString(item))
    .filter((item): item is CapturedNoteString => item !== null);

  const existing = loadCapturedNoteStrings();
  const existingIds = new Set(existing.map((entry) => entry.id));

  let duplicates = 0;
  const next = [...existing];
  candidates.forEach((entry) => {
    if (existingIds.has(entry.id)) {
      duplicates += 1;
      return;
    }
    existingIds.add(entry.id);
    next.unshift(entry);
  });

  const skipped = rawItems.length - candidates.length;
  const persisted = persistCapturedNoteStrings(next);

  return {
    imported: candidates.length - duplicates,
    skipped,
    duplicates,
    items: persisted,
  };
};

/**
 * Convert a pattern's StepValue[] into a flat CapturedNoteToken
 * sequence. Each step becomes either a token (taking the highest
 * pitch when the step has more than one event, so the result reads
 * like a melodic line rather than a stacked chord) or a rest. We
 * trim trailing rests so a half-empty pattern reads cleanly when it
 * lands on the shelf.
 */
export const tokensFromPatternSteps = (
  steps: Array<Array<{ note: string; gate: number; velocity: number }>>,
): Array<CapturedNoteToken | null> => {
  const tokens: Array<CapturedNoteToken | null> = [];
  for (const step of steps) {
    if (!step || step.length === 0) {
      tokens.push(null);
      continue;
    }
    // The "lead" of a step is the highest-pitched event so a layered
    // pad-style chord still produces a recognisable melody line.
    const lead = [...step].sort((a, b) => a.note.localeCompare(b.note)).pop() ?? step[0];
    tokens.push({
      note: lead.note,
      gate: clampStepGate(lead.gate),
      velocity: clampStepVelocity(lead.velocity),
    });
  }
  while (tokens.length > 0 && tokens[tokens.length - 1] === null) {
    tokens.pop();
  }
  return tokens;
};

export interface TranscriptionNoteLike {
  note: string;
  startStep: number;
  durationSteps: number;
  velocity: number;
}

/**
 * Take the notes a transcription pass produced (humming, singing, a
 * song file) and park them on the shelf as a captured string. Walks
 * notes in start-step order and inserts null rests for any gap so the
 * timing matches what the user just sang.
 *
 * Returns the new list of saved strings, or `null` if there was
 * nothing worth saving.
 */
export const captureNoteStringFromTranscription = (
  notes: TranscriptionNoteLike[],
  options: { name?: string; source?: NoteStringSource } = {},
): CapturedNoteString[] | null => {
  if (notes.length === 0) return null;

  const ordered = [...notes].sort((left, right) => left.startStep - right.startStep);
  const tokens: Array<CapturedNoteToken | null> = [];
  let cursor = 0;

  for (const note of ordered) {
    if (tokens.length >= MAX_NOTES_PER_STRING) break;
    const gap = Math.max(0, Math.round(note.startStep - cursor));
    for (let restIndex = 0; restIndex < gap && tokens.length < MAX_NOTES_PER_STRING; restIndex += 1) {
      tokens.push(null);
    }
    if (tokens.length >= MAX_NOTES_PER_STRING) break;

    const gate = clampStepGate(Math.max(1, Math.round(note.durationSteps)));
    tokens.push({
      note: note.note,
      gate,
      velocity: clampStepVelocity(note.velocity),
    });
    cursor = note.startStep + Math.max(1, Math.round(note.durationSteps));
  }

  // Strip trailing rests so the shelf preview reads cleanly.
  while (tokens.length > 0 && tokens[tokens.length - 1] === null) {
    tokens.pop();
  }
  if (tokens.length === 0) return null;

  const now = new Date().toISOString();
  const next: CapturedNoteString = {
    id: createId(),
    name: (options.name ?? '').trim().slice(0, 48) || defaultNameForTokens(tokens),
    source: options.source ?? 'transcribed',
    tokens,
    raw: tokens
      .map((token) => (token === null ? '.' : token.gate > 1 ? `${token.note}*${token.gate}` : token.note))
      .join(' '),
    createdAt: now,
    updatedAt: now,
  };

  return persistCapturedNoteStrings([next, ...loadCapturedNoteStrings()]);
};

export const subscribeCapturedNoteStrings = (
  listener: (items: CapturedNoteString[]) => void,
) => {
  if (typeof window === 'undefined') return () => {};

  const handleChange = () => listener(loadCapturedNoteStrings());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) handleChange();
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
};

// Build a friendly default name from the first few notes so saved strings
// in the shelf don't all read as "Captured string".
const defaultNameForTokens = (tokens: Array<CapturedNoteToken | null>): string => {
  const named = tokens
    .filter((token): token is CapturedNoteToken => token !== null)
    .slice(0, 4)
    .map((token) => token.note)
    .join(' ');
  return named || 'Captured string';
};

// --- Quick stats ---------------------------------------------------------

export interface CapturedNoteStringStats {
  noteCount: number;
  stepCount: number;
}

export const summarizeCapturedNoteString = (entry: CapturedNoteString): CapturedNoteStringStats => {
  let noteCount = 0;
  let stepCount = 0;
  entry.tokens.forEach((token) => {
    if (token === null) {
      stepCount += 1;
      return;
    }
    noteCount += 1;
    stepCount += Math.max(1, Math.round(token.gate));
  });
  return { noteCount, stepCount };
};
