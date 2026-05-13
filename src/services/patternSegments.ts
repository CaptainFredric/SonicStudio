import {
  createEmptyPattern,
  type InstrumentType,
  type NoteEvent,
  type PatternAutomation,
  type Track,
} from '../project/schema';

export interface PatternSegment {
  automation: PatternAutomation;
  createdAt: string;
  id: string;
  name: string;
  sourceTrackName: string;
  sourceTrackType: InstrumentType;
  steps: NoteEvent[][];
  stepsPerPattern: number;
}

const STORAGE_KEY = 'sonicstudio:pattern-segments:v1';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const clampSteps = (value: number) => Math.max(8, Math.min(128, Math.round(value)));

const cloneSteps = (steps: NoteEvent[][], stepsPerPattern: number) => {
  const next = createEmptyPattern(stepsPerPattern);

  for (let stepIndex = 0; stepIndex < stepsPerPattern; stepIndex += 1) {
    const step = steps[stepIndex] ?? [];
    next[stepIndex] = step.map((event) => ({
      gate: typeof event.gate === 'number' ? event.gate : 1,
      note: String(event.note),
      velocity: typeof event.velocity === 'number' ? event.velocity : 0.78,
    }));
  }

  return next;
};

const normalizeAutomation = (value: unknown, stepsPerPattern: number): PatternAutomation => {
  const automation = isRecord(value) ? value : {};
  const level = Array.isArray(automation.level) ? automation.level : [];
  const tone = Array.isArray(automation.tone) ? automation.tone : [];

  return {
    level: Array.from({ length: stepsPerPattern }, (_, index) => (
      typeof level[index] === 'number' ? level[index] : 0.5
    )),
    tone: Array.from({ length: stepsPerPattern }, (_, index) => (
      typeof tone[index] === 'number' ? tone[index] : 0.5
    )),
  };
};

const normalizeSegment = (value: unknown): PatternSegment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const stepsPerPattern = clampSteps(
    typeof value.stepsPerPattern === 'number' ? value.stepsPerPattern : 16,
  );
  const steps = Array.isArray(value.steps) ? value.steps : [];

  return {
    automation: normalizeAutomation(value.automation, stepsPerPattern),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
    id: typeof value.id === 'string' ? value.id : `segment-${Date.now()}`,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : 'Pattern piece',
    sourceTrackName: typeof value.sourceTrackName === 'string' ? value.sourceTrackName : 'Track',
    sourceTrackType: typeof value.sourceTrackType === 'string' ? value.sourceTrackType as InstrumentType : 'lead',
    steps: cloneSteps(steps as NoteEvent[][], stepsPerPattern),
    stepsPerPattern,
  };
};

const createSegmentId = () => (
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `segment-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
);

export const createPatternSegment = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  name?: string,
): PatternSegment => {
  const safeStepsPerPattern = clampSteps(stepsPerPattern);
  const label = name?.trim() || `${track.name} ${String.fromCharCode(65 + patternIndex)}`;

  return {
    automation: normalizeAutomation(track.automation?.[patternIndex], safeStepsPerPattern),
    createdAt: new Date().toISOString(),
    id: createSegmentId(),
    name: label,
    sourceTrackName: track.name,
    sourceTrackType: track.type,
    steps: cloneSteps(track.patterns[patternIndex] ?? createEmptyPattern(safeStepsPerPattern), safeStepsPerPattern),
    stepsPerPattern: safeStepsPerPattern,
  };
};

export const loadPatternSegments = (): PatternSegment[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((segment) => normalizeSegment(segment))
      .filter((segment): segment is PatternSegment => segment !== null);
  } catch {
    return [];
  }
};

export const persistPatternSegments = (segments: PatternSegment[]): PatternSegment[] => {
  const normalized = segments
    .map((segment) => normalizeSegment(segment))
    .filter((segment): segment is PatternSegment => segment !== null)
    .slice(0, 24);

  if (typeof window === 'undefined') {
    return normalized;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
};