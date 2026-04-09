export type AppView = 'SEQUENCER' | 'PIANO_ROLL' | 'MIXER' | 'ARRANGER';
export type InstrumentType = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead';
export type StepValue = string | null;

export interface ArrangerSection {
  id: string;
  name: string;
  patternIndex: number;
  duration: number;
  positionInBeats: number;
}

export interface SynthParams {
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  delaySend: number;
  reverbSend: number;
  distortion: number;
}

export interface Track {
  id: string;
  name: string;
  type: InstrumentType;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  patterns: Record<number, StepValue[]>;
  params: SynthParams;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransportSettings {
  bpm: number;
  currentPattern: number;
  patternCount: number;
  stepsPerPattern: number;
}

export interface Project {
  metadata: ProjectMetadata;
  transport: TransportSettings;
  tracks: Track[];
  arranger?: ArrangerSection[];
}

export interface StudioUIState {
  activeView: AppView;
  isSettingsOpen: boolean;
  selectedTrackId: string | null;
}

export interface StudioSession {
  project: Project;
  ui: StudioUIState;
}

export const DEFAULT_PATTERN_COUNT = 4;
export const DEFAULT_STEPS_PER_PATTERN = 16;
export const MAX_PATTERN_COUNT = 8;
export const MAX_STEPS_PER_PATTERN = 64;
export const MIN_PATTERN_COUNT = 1;
export const MIN_STEPS_PER_PATTERN = 8;
export const PROJECT_SCHEMA_VERSION = 1;

export const INITIAL_PARAMS: SynthParams = {
  cutoff: 2000,
  resonance: 1,
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.8,
  delaySend: 0,
  reverbSend: 0,
  distortion: 0,
};

const TRACK_PRESETS: Record<InstrumentType, {
  name: string;
  color: string;
  volume: number;
  params?: Partial<SynthParams>;
}> = {
  kick: { name: 'Deep Kick', color: '#f87171', volume: -6 },
  snare: { name: 'Sharp Snare', color: '#fb923c', volume: -6 },
  hihat: { name: 'Neon Hat', color: '#fbbf24', volume: -15 },
  bass: { name: 'Obsidian Bass', color: '#60a5fa', volume: -6 },
  lead: {
    name: 'Void Lead',
    color: '#a78bfa',
    volume: -12,
    params: { delaySend: 0.4, reverbSend: 0.3 },
  },
};

const DEMO_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const isInstrumentType = (value: unknown): value is InstrumentType => (
  value === 'kick' || value === 'snare' || value === 'hihat' || value === 'bass' || value === 'lead'
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const createEmptyPattern = (stepCount: number = DEFAULT_STEPS_PER_PATTERN): StepValue[] => (
  Array.from({ length: stepCount }, () => null)
);

export const createPatternBank = (
  patternCount: number = DEFAULT_PATTERN_COUNT,
  stepCount: number = DEFAULT_STEPS_PER_PATTERN,
): Record<number, StepValue[]> => {
  const patterns: Record<number, StepValue[]> = {};

  for (let index = 0; index < patternCount; index += 1) {
    patterns[index] = createEmptyPattern(stepCount);
  }

  return patterns;
};

const normalizeParams = (
  params: unknown,
  presetParams?: Partial<SynthParams>,
): SynthParams => {
  const candidate = isRecord(params) ? params : {};

  return {
    cutoff: clamp(typeof candidate.cutoff === 'number' ? candidate.cutoff : presetParams?.cutoff ?? INITIAL_PARAMS.cutoff, 20, 18000),
    resonance: clamp(typeof candidate.resonance === 'number' ? candidate.resonance : presetParams?.resonance ?? INITIAL_PARAMS.resonance, 0.1, 20),
    attack: clamp(typeof candidate.attack === 'number' ? candidate.attack : presetParams?.attack ?? INITIAL_PARAMS.attack, 0.001, 2),
    decay: clamp(typeof candidate.decay === 'number' ? candidate.decay : presetParams?.decay ?? INITIAL_PARAMS.decay, 0.01, 4),
    sustain: clamp(typeof candidate.sustain === 'number' ? candidate.sustain : presetParams?.sustain ?? INITIAL_PARAMS.sustain, 0, 1),
    release: clamp(typeof candidate.release === 'number' ? candidate.release : presetParams?.release ?? INITIAL_PARAMS.release, 0.01, 8),
    delaySend: clamp(typeof candidate.delaySend === 'number' ? candidate.delaySend : presetParams?.delaySend ?? INITIAL_PARAMS.delaySend, 0, 1),
    reverbSend: clamp(typeof candidate.reverbSend === 'number' ? candidate.reverbSend : presetParams?.reverbSend ?? INITIAL_PARAMS.reverbSend, 0, 1),
    distortion: clamp(typeof candidate.distortion === 'number' ? candidate.distortion : presetParams?.distortion ?? INITIAL_PARAMS.distortion, 0, 1),
  };
};

const normalizePatterns = (
  patterns: unknown,
  patternCount: number,
  stepCount: number,
): Record<number, StepValue[]> => {
  const candidate = isRecord(patterns) ? patterns : {};
  const nextPatterns: Record<number, StepValue[]> = {};

  for (let patternIndex = 0; patternIndex < patternCount; patternIndex += 1) {
    const rawPattern = Array.isArray(candidate[patternIndex]) ? candidate[patternIndex] as unknown[] : [];
    const steps = Array.from({ length: stepCount }, (_, stepIndex) => {
      const value = rawPattern[stepIndex];
      return typeof value === 'string' ? value : null;
    });

    nextPatterns[patternIndex] = steps;
  }

  return nextPatterns;
};

const normalizeTransport = (transport: unknown): TransportSettings => {
  const candidate = isRecord(transport) ? transport : {};
  const patternCount = clamp(
    typeof candidate.patternCount === 'number' ? Math.round(candidate.patternCount) : DEFAULT_PATTERN_COUNT,
    1,
    8,
  );
  const stepsPerPattern = clamp(
    typeof candidate.stepsPerPattern === 'number' ? Math.round(candidate.stepsPerPattern) : DEFAULT_STEPS_PER_PATTERN,
    8,
    64,
  );

  return {
    bpm: clamp(typeof candidate.bpm === 'number' ? candidate.bpm : 128, 40, 240),
    currentPattern: clamp(
      typeof candidate.currentPattern === 'number' ? Math.round(candidate.currentPattern) : 0,
      0,
      patternCount - 1,
    ),
    patternCount,
    stepsPerPattern,
  };
};

const normalizeTrack = (
  track: unknown,
  transport: TransportSettings,
  fallbackType: InstrumentType = 'lead',
): Track => {
  const candidate = isRecord(track) ? track : {};
  const type = isInstrumentType(candidate.type) ? candidate.type : fallbackType;
  const preset = TRACK_PRESETS[type];

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('track'),
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : preset.name,
    type,
    color: typeof candidate.color === 'string' && candidate.color ? candidate.color : preset.color,
    muted: Boolean(candidate.muted),
    solo: Boolean(candidate.solo),
    volume: clamp(typeof candidate.volume === 'number' ? candidate.volume : preset.volume, -60, 6),
    pan: clamp(typeof candidate.pan === 'number' ? candidate.pan : 0, -1, 1),
    patterns: normalizePatterns(candidate.patterns, transport.patternCount, transport.stepsPerPattern),
    params: normalizeParams(candidate.params, preset.params),
  };
};

export const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

export const createTrack = (
  type: InstrumentType,
  options: Partial<Omit<Track, 'type' | 'patterns' | 'params'>> & {
    params?: Partial<SynthParams>;
    patterns?: Record<number, StepValue[]>;
    patternCount?: number;
    stepsPerPattern?: number;
  } = {},
): Track => {
  const preset = TRACK_PRESETS[type];
  const patternCount = options.patternCount ?? DEFAULT_PATTERN_COUNT;
  const stepsPerPattern = options.stepsPerPattern ?? DEFAULT_STEPS_PER_PATTERN;
  const params = normalizeParams(options.params, preset.params);

  return {
    id: options.id ?? createId('track'),
    name: options.name ?? preset.name,
    type,
    color: options.color ?? preset.color,
    muted: options.muted ?? false,
    solo: options.solo ?? false,
    volume: clamp(options.volume ?? preset.volume, -60, 6),
    pan: clamp(options.pan ?? 0, -1, 1),
    patterns: options.patterns
      ? normalizePatterns(options.patterns, patternCount, stepsPerPattern)
      : createPatternBank(patternCount, stepsPerPattern),
    params,
  };
};

export const duplicateTrack = (track: Track, transport: TransportSettings): Track => {
  const copyIndexMatch = track.name.match(/\sCopy(?:\s(\d+))?$/);
  const nextCopySuffix = copyIndexMatch?.[1] ? Number(copyIndexMatch[1]) + 1 : 1;
  const copyName = copyIndexMatch
    ? track.name.replace(/\sCopy(?:\s\d+)?$/, ` Copy ${nextCopySuffix}`)
    : `${track.name} Copy`;

  return createTrack(track.type, {
    name: copyName,
    color: track.color,
    volume: track.volume,
    pan: track.pan,
    muted: track.muted,
    solo: false,
    params: track.params,
    patterns: track.patterns,
    patternCount: transport.patternCount,
    stepsPerPattern: transport.stepsPerPattern,
  });
};

export const resizeTrackPatterns = (
  track: Track,
  patternCount: number,
  stepsPerPattern: number,
): Track => {
  const patterns: Record<number, StepValue[]> = {};

  for (let patternIndex = 0; patternIndex < patternCount; patternIndex += 1) {
    const sourceSteps = track.patterns[patternIndex] ?? [];
    patterns[patternIndex] = Array.from({ length: stepsPerPattern }, (_, stepIndex) => {
      const value = sourceSteps[stepIndex];
      return typeof value === 'string' ? value : null;
    });
  }

  return {
    ...track,
    patterns,
  };
};

export const createDemoProject = (projectName: string = 'Midnight Sketch'): Project => {
  const transport: TransportSettings = {
    bpm: 128,
    currentPattern: 0,
    patternCount: DEFAULT_PATTERN_COUNT,
    stepsPerPattern: DEFAULT_STEPS_PER_PATTERN,
  };

  const tracks = DEMO_TRACK_ORDER.map((type) => createTrack(type, transport));
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack] = tracks;

  kickTrack.patterns[0][0] = 'C1';
  kickTrack.patterns[0][4] = 'C1';
  kickTrack.patterns[0][8] = 'C1';
  kickTrack.patterns[0][12] = 'C1';

  snareTrack.patterns[0][4] = 'C1';
  snareTrack.patterns[0][12] = 'C1';

  hihatTrack.patterns[0][2] = 'C1';
  hihatTrack.patterns[0][6] = 'C1';
  hihatTrack.patterns[0][10] = 'C1';
  hihatTrack.patterns[0][14] = 'C1';

  bassTrack.patterns[0][0] = 'C2';
  bassTrack.patterns[0][8] = 'G1';

  leadTrack.patterns[0][0] = 'C4';
  leadTrack.patterns[0][3] = 'D#4';
  leadTrack.patterns[0][8] = 'G4';
  leadTrack.patterns[0][14] = 'F4';

  const timestamp = new Date().toISOString();

  return {
    metadata: {
      id: createId('project'),
      name: projectName,
      version: PROJECT_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    transport,
    tracks,
  };
};

export const normalizeProject = (input: unknown): Project | null => {
  if (!isRecord(input)) {
    return null;
  }

  const transport = normalizeTransport(input.transport);
  const rawTracks = Array.isArray(input.tracks) ? input.tracks : [];
  const tracks = rawTracks.length > 0
    ? rawTracks.map((track, index) => normalizeTrack(track, transport, DEMO_TRACK_ORDER[index] ?? 'lead'))
    : [createTrack('lead', transport)];

  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const createdAt = typeof metadata.createdAt === 'string' ? metadata.createdAt : new Date().toISOString();
  const updatedAt = typeof metadata.updatedAt === 'string' ? metadata.updatedAt : createdAt;

  return {
    metadata: {
      id: typeof metadata.id === 'string' && metadata.id ? metadata.id : createId('project'),
      name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : 'Recovered Session',
      version: PROJECT_SCHEMA_VERSION,
      createdAt,
      updatedAt,
    },
    transport,
    tracks,
  };
};

export const defaultNoteForTrack = (track: Track): string => {
  switch (track.type) {
    case 'kick':
    case 'snare':
    case 'hihat':
      return 'C1';
    case 'bass':
      return 'C2';
    default:
      return 'C4';
  }
};
