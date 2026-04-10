export type AppView = 'SEQUENCER' | 'PIANO_ROLL' | 'MIXER' | 'ARRANGER';
export type InstrumentType = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'pad' | 'pluck' | 'fx';
export type TransportMode = 'PATTERN' | 'SONG';
export type OscillatorShape = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface NoteEvent {
  gate: number;
  note: string;
  velocity: number;
}

export type StepValue = NoteEvent[];

export interface ArrangerSection {
  id: string;
  name: string;
  patternIndex: number;
  duration: number;
  positionInBeats: number;
}

export interface ArrangementClip {
  id: string;
  trackId: string;
  patternIndex: number;
  startBeat: number;
  beatLength: number;
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

export interface TrackSource {
  detune: number;
  octaveShift: number;
  portamento: number;
  waveform: OscillatorShape;
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
  source: TrackSource;
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
  mode: TransportMode;
  patternCount: number;
  stepsPerPattern: number;
}

export interface Project {
  metadata: ProjectMetadata;
  transport: TransportSettings;
  tracks: Track[];
  arrangerClips: ArrangementClip[];
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
export const PROJECT_SCHEMA_VERSION = 4;

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

export const INITIAL_SOURCE: TrackSource = {
  detune: 0,
  octaveShift: 0,
  portamento: 0,
  waveform: 'sawtooth',
};

const TRACK_PRESETS: Record<
  InstrumentType,
  {
    color: string;
    name: string;
    params?: Partial<SynthParams>;
    source?: Partial<TrackSource>;
    volume: number;
  }
> = {
  kick: {
    color: '#f87171',
    name: 'Deep Kick',
    source: { octaveShift: -2, waveform: 'sine' },
    volume: -6,
  },
  snare: {
    color: '#fb923c',
    name: 'Sharp Snare',
    source: { waveform: 'square' },
    volume: -6,
  },
  hihat: {
    color: '#fbbf24',
    name: 'Neon Hat',
    source: { detune: 12, waveform: 'square' },
    volume: -15,
  },
  bass: {
    color: '#60a5fa',
    name: 'Obsidian Bass',
    params: { attack: 0.01, decay: 0.18, release: 0.4, sustain: 0.55 },
    source: { octaveShift: -1, portamento: 0.03, waveform: 'square' },
    volume: -6,
  },
  lead: {
    color: '#7dd3fc',
    name: 'Prism Lead',
    params: { delaySend: 0.4, reverbSend: 0.3, release: 1.3 },
    source: { octaveShift: 0, portamento: 0.05, waveform: 'sawtooth' },
    volume: -12,
  },
  pad: {
    color: '#67e8f9',
    name: 'Glass Pad',
    params: { attack: 0.18, decay: 0.4, delaySend: 0.24, reverbSend: 0.48, release: 2.2, sustain: 0.72 },
    source: { octaveShift: 0, portamento: 0.02, waveform: 'triangle' },
    volume: -16,
  },
  pluck: {
    color: '#c084fc',
    name: 'Pulse Pluck',
    params: { attack: 0.003, decay: 0.16, release: 0.32, sustain: 0.18 },
    source: { octaveShift: 0, portamento: 0, waveform: 'square' },
    volume: -14,
  },
  fx: {
    color: '#fb7185',
    name: 'Motion FX',
    params: { attack: 0.02, decay: 0.6, delaySend: 0.58, distortion: 0.12, release: 1.4, reverbSend: 0.4, sustain: 0.38 },
    source: { detune: 18, octaveShift: 1, portamento: 0.07, waveform: 'sawtooth' },
    volume: -18,
  },
};

const DEMO_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const clampStepVelocity = (velocity: number) => clamp(velocity, 0.1, 1);
const clampStepGate = (gate: number) => clamp(gate, 0.25, 4);
const cloneStep = (step: StepValue): StepValue => step.map((event) => ({ ...event }));

const isInstrumentType = (value: unknown): value is InstrumentType => (
  value === 'kick'
  || value === 'snare'
  || value === 'hihat'
  || value === 'bass'
  || value === 'lead'
  || value === 'pad'
  || value === 'pluck'
  || value === 'fx'
);

const isOscillatorShape = (value: unknown): value is OscillatorShape => (
  value === 'sine'
  || value === 'triangle'
  || value === 'sawtooth'
  || value === 'square'
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const normalizeSource = (
  type: InstrumentType,
  source: unknown,
): TrackSource => {
  const presetSource = TRACK_PRESETS[type].source;
  const candidate = isRecord(source) ? source : {};

  return {
    detune: clamp(
      typeof candidate.detune === 'number' ? candidate.detune : presetSource?.detune ?? INITIAL_SOURCE.detune,
      -2400,
      2400,
    ),
    octaveShift: clamp(
      typeof candidate.octaveShift === 'number' ? Math.round(candidate.octaveShift) : presetSource?.octaveShift ?? INITIAL_SOURCE.octaveShift,
      -3,
      3,
    ),
    portamento: clamp(
      typeof candidate.portamento === 'number' ? candidate.portamento : presetSource?.portamento ?? INITIAL_SOURCE.portamento,
      0,
      0.2,
    ),
    waveform: isOscillatorShape(candidate.waveform)
      ? candidate.waveform
      : presetSource?.waveform ?? INITIAL_SOURCE.waveform,
  };
};

const normalizeArrangerSections = (
  arranger: unknown,
  transport: TransportSettings,
): ArrangerSection[] => {
  if (!Array.isArray(arranger) || arranger.length === 0) {
    return [];
  }

  let cursor = 0;

  return arranger.map((section, index) => {
    const candidate = isRecord(section) ? section : {};
    const duration = clamp(
      typeof candidate.duration === 'number' ? Math.round(candidate.duration) : 16,
      4,
      128,
    );
    const normalized: ArrangerSection = {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('section'),
      name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : `Section ${index + 1}`,
      patternIndex: clamp(
        typeof candidate.patternIndex === 'number' ? Math.round(candidate.patternIndex) : 0,
        0,
        transport.patternCount - 1,
      ),
      duration,
      positionInBeats: cursor,
    };

    cursor += duration;
    return normalized;
  });
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

export const createStepEvent = (
  note: string,
  options: Partial<NoteEvent> = {},
): NoteEvent => ({
  gate: clampStepGate(options.gate ?? 1),
  note,
  velocity: clampStepVelocity(options.velocity ?? 0.82),
});

const normalizeStepValue = (value: unknown): StepValue => {
  if (typeof value === 'string') {
    return [createStepEvent(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.note !== 'string') {
        return [];
      }

      return [createStepEvent(candidate.note, {
        gate: typeof candidate.gate === 'number' ? candidate.gate : 1,
        velocity: typeof candidate.velocity === 'number' ? candidate.velocity : 0.82,
      })];
    });
  }

  if (!isRecord(value) || typeof value.note !== 'string') {
    return [];
  }

  return [createStepEvent(value.note, {
    gate: typeof value.gate === 'number' ? value.gate : 1,
    velocity: typeof value.velocity === 'number' ? value.velocity : 0.82,
  })];
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
      return normalizeStepValue(value);
    });

    nextPatterns[patternIndex] = steps;
  }

  return nextPatterns;
};

const normalizeTransport = (transport: unknown): TransportSettings => {
  const candidate = isRecord(transport) ? transport : {};
  const patternCount = clamp(
    typeof candidate.patternCount === 'number' ? Math.round(candidate.patternCount) : DEFAULT_PATTERN_COUNT,
    MIN_PATTERN_COUNT,
    MAX_PATTERN_COUNT,
  );
  const stepsPerPattern = clamp(
    typeof candidate.stepsPerPattern === 'number' ? Math.round(candidate.stepsPerPattern) : DEFAULT_STEPS_PER_PATTERN,
    MIN_STEPS_PER_PATTERN,
    MAX_STEPS_PER_PATTERN,
  );

  return {
    bpm: clamp(typeof candidate.bpm === 'number' ? candidate.bpm : 128, 40, 240),
    currentPattern: clamp(
      typeof candidate.currentPattern === 'number' ? Math.round(candidate.currentPattern) : 0,
      0,
      patternCount - 1,
    ),
    mode: candidate.mode === 'SONG' ? 'SONG' : 'PATTERN',
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
    source: normalizeSource(type, candidate.source),
  };
};

const normalizeArrangerClips = (
  arrangerClips: unknown,
  tracks: Track[],
  transport: TransportSettings,
): ArrangementClip[] => {
  if (!Array.isArray(arrangerClips) || arrangerClips.length === 0) {
    return [];
  }

  const validTrackIds = new Set(tracks.map((track) => track.id));

  return arrangerClips
    .map((clip) => {
      const candidate = isRecord(clip) ? clip : {};
      const trackId = typeof candidate.trackId === 'string' && validTrackIds.has(candidate.trackId)
        ? candidate.trackId
        : tracks[0]?.id;

      if (!trackId) {
        return null;
      }

      return {
        beatLength: clamp(
          typeof candidate.beatLength === 'number' ? Math.round(candidate.beatLength) : 16,
          4,
          128,
        ),
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('clip'),
        patternIndex: clamp(
          typeof candidate.patternIndex === 'number' ? Math.round(candidate.patternIndex) : 0,
          0,
          transport.patternCount - 1,
        ),
        startBeat: clamp(
          typeof candidate.startBeat === 'number' ? Math.round(candidate.startBeat) : 0,
          0,
          4096,
        ),
        trackId,
      } satisfies ArrangementClip;
    })
    .filter((clip): clip is ArrangementClip => clip !== null)
    .sort((left, right) => left.startBeat - right.startBeat);
};

const legacySectionsToClips = (
  arranger: unknown,
  tracks: Track[],
  transport: TransportSettings,
): ArrangementClip[] => {
  const sections = normalizeArrangerSections(arranger, transport);

  if (sections.length === 0 || tracks.length === 0) {
    return [];
  }

  return sections.flatMap((section) => (
    tracks.map((track) => ({
      beatLength: section.duration,
      id: createId('clip'),
      patternIndex: section.patternIndex,
      startBeat: section.positionInBeats,
      trackId: track.id,
    }))
  ));
};

export const createEmptyPattern = (stepCount: number = DEFAULT_STEPS_PER_PATTERN): StepValue[] => (
  Array.from({ length: stepCount }, () => [])
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

export const buildDefaultArranger = (transport: TransportSettings): ArrangerSection[] => {
  const sections: ArrangerSection[] = [
    {
      id: createId('section'),
      name: 'Intro',
      patternIndex: 0,
      duration: 16,
      positionInBeats: 0,
    },
  ];

  if (transport.patternCount > 1) {
    sections.push({
      id: createId('section'),
      name: 'Lift',
      patternIndex: 1,
      duration: 16,
      positionInBeats: 16,
    });
  }

  return normalizeArrangerSections(sections, transport);
};

export const buildDefaultArrangerClips = (
  transport: TransportSettings,
  tracks: Track[],
): ArrangementClip[] => (
  legacySectionsToClips(buildDefaultArranger(transport), tracks, transport)
);

export const createArrangerClip = (
  trackId: string,
  transport: TransportSettings,
  options: Partial<Omit<ArrangementClip, 'trackId'>> = {},
): ArrangementClip => ({
  beatLength: clamp(Math.round(options.beatLength ?? transport.stepsPerPattern), 4, 128),
  id: options.id ?? createId('clip'),
  patternIndex: clamp(Math.round(options.patternIndex ?? transport.currentPattern), 0, transport.patternCount - 1),
  startBeat: clamp(Math.round(options.startBeat ?? 0), 0, 4096),
  trackId,
});

export const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

export const createTrack = (
  type: InstrumentType,
  options: Partial<Omit<Track, 'type' | 'patterns' | 'params' | 'source'>> & {
    params?: Partial<SynthParams>;
    patternCount?: number;
    patterns?: Record<number, StepValue[]>;
    source?: Partial<TrackSource>;
    stepsPerPattern?: number;
  } = {},
): Track => {
  const preset = TRACK_PRESETS[type];
  const patternCount = options.patternCount ?? DEFAULT_PATTERN_COUNT;
  const stepsPerPattern = options.stepsPerPattern ?? DEFAULT_STEPS_PER_PATTERN;
  const params = normalizeParams(options.params, preset.params);

  return {
    color: options.color ?? preset.color,
    id: options.id ?? createId('track'),
    muted: options.muted ?? false,
    name: options.name ?? preset.name,
    pan: clamp(options.pan ?? 0, -1, 1),
    params,
    patterns: options.patterns
      ? normalizePatterns(options.patterns, patternCount, stepsPerPattern)
      : createPatternBank(patternCount, stepsPerPattern),
    solo: options.solo ?? false,
    source: normalizeSource(type, options.source),
    type,
    volume: clamp(options.volume ?? preset.volume, -60, 6),
  };
};

export const duplicateTrack = (track: Track, transport: TransportSettings): Track => {
  const copyIndexMatch = track.name.match(/\sCopy(?:\s(\d+))?$/);
  const nextCopySuffix = copyIndexMatch?.[1] ? Number(copyIndexMatch[1]) + 1 : 1;
  const copyName = copyIndexMatch
    ? track.name.replace(/\sCopy(?:\s\d+)?$/, ` Copy ${nextCopySuffix}`)
    : `${track.name} Copy`;

  return createTrack(track.type, {
    color: track.color,
    muted: track.muted,
    name: copyName,
    pan: track.pan,
    params: track.params,
    patternCount: transport.patternCount,
    patterns: track.patterns,
    solo: false,
    source: track.source,
    stepsPerPattern: transport.stepsPerPattern,
    volume: track.volume,
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
      return Array.isArray(value) ? cloneStep(value) : [];
    });
  }

  return {
    ...track,
    patterns,
  };
};

export const createDemoProject = (projectName: string = 'Night Transit'): Project => {
  const transport: TransportSettings = {
    bpm: 124,
    currentPattern: 0,
    mode: 'SONG',
    patternCount: DEFAULT_PATTERN_COUNT,
    stepsPerPattern: DEFAULT_STEPS_PER_PATTERN,
  };

  const tracks = DEMO_TRACK_ORDER.map((type) => createTrack(type, {
    patternCount: transport.patternCount,
    stepsPerPattern: transport.stepsPerPattern,
  }));
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack] = tracks;
  const put = (
    track: Track,
    patternIndex: number,
    stepIndex: number,
    note: string,
    options: Partial<NoteEvent> = {},
  ) => {
    track.patterns[patternIndex][stepIndex] = [createStepEvent(note, options)];
  };

  const stack = (
    track: Track,
    patternIndex: number,
    stepIndex: number,
    notes: Array<{ note: string; options?: Partial<NoteEvent> }>,
  ) => {
    track.patterns[patternIndex][stepIndex] = notes.map((entry) => createStepEvent(entry.note, entry.options));
  };

  put(kickTrack, 0, 0, 'C1', { velocity: 0.96 });
  put(kickTrack, 0, 4, 'C1', { velocity: 0.86 });
  put(kickTrack, 0, 8, 'C1', { velocity: 0.94 });
  put(kickTrack, 0, 12, 'C1', { velocity: 0.88 });
  put(kickTrack, 1, 0, 'C1', { velocity: 0.98 });
  put(kickTrack, 1, 6, 'C1', { velocity: 0.82 });
  put(kickTrack, 1, 8, 'C1', { velocity: 0.94 });
  put(kickTrack, 1, 12, 'C1', { velocity: 0.9 });
  put(kickTrack, 2, 0, 'C1', { velocity: 1 });
  put(kickTrack, 2, 4, 'C1', { velocity: 0.86 });
  put(kickTrack, 2, 7, 'C1', { velocity: 0.8 });
  put(kickTrack, 2, 10, 'C1', { velocity: 0.84 });
  put(kickTrack, 2, 12, 'C1', { velocity: 0.96 });

  put(snareTrack, 0, 4, 'C1', { velocity: 0.78 });
  put(snareTrack, 0, 12, 'C1', { velocity: 0.86 });
  put(snareTrack, 1, 4, 'C1', { velocity: 0.78 });
  put(snareTrack, 1, 10, 'C1', { velocity: 0.64 });
  put(snareTrack, 1, 12, 'C1', { velocity: 0.9 });
  put(snareTrack, 2, 4, 'C1', { velocity: 0.8 });
  put(snareTrack, 2, 12, 'C1', { velocity: 0.88 });

  for (const step of [2, 6, 10, 14]) {
    put(hihatTrack, 0, step, 'C1', { gate: 0.5, velocity: 0.56 });
  }
  for (const step of [1, 3, 5, 7, 9, 11, 13, 15]) {
    put(hihatTrack, 1, step, 'C1', { gate: 0.5, velocity: 0.5 });
  }
  for (const step of [0, 3, 6, 9, 12, 15]) {
    put(hihatTrack, 2, step, 'C1', { gate: 0.5, velocity: 0.54 });
  }

  put(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.78 });
  put(bassTrack, 0, 8, 'G1', { gate: 1.5, velocity: 0.72 });
  put(bassTrack, 1, 0, 'A1', { gate: 1.5, velocity: 0.78 });
  put(bassTrack, 1, 4, 'C2', { gate: 1.25, velocity: 0.7 });
  put(bassTrack, 1, 8, 'E2', { gate: 1.5, velocity: 0.76 });
  put(bassTrack, 1, 12, 'G1', { gate: 1.25, velocity: 0.72 });
  put(bassTrack, 2, 0, 'F1', { gate: 1.75, velocity: 0.8 });
  put(bassTrack, 2, 8, 'G1', { gate: 1.5, velocity: 0.76 });

  put(leadTrack, 0, 0, 'C4', { gate: 1.25, velocity: 0.82 });
  put(leadTrack, 0, 3, 'D#4', { gate: 1, velocity: 0.76 });
  put(leadTrack, 0, 8, 'G4', { gate: 1.25, velocity: 0.88 });
  put(leadTrack, 0, 14, 'F4', { gate: 1, velocity: 0.72 });
  put(leadTrack, 1, 0, 'A4', { gate: 1.25, velocity: 0.86 });
  put(leadTrack, 1, 4, 'C5', { gate: 1.25, velocity: 0.8 });
  put(leadTrack, 1, 8, 'E5', { gate: 1.25, velocity: 0.92 });
  put(leadTrack, 1, 12, 'G4', { gate: 1, velocity: 0.74 });
  put(leadTrack, 2, 2, 'F4', { gate: 1, velocity: 0.74 });
  put(leadTrack, 2, 6, 'G4', { gate: 1, velocity: 0.78 });
  put(leadTrack, 2, 10, 'A4', { gate: 1, velocity: 0.84 });
  put(leadTrack, 2, 14, 'C5', { gate: 1.25, velocity: 0.9 });

  stack(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.62 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.56 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.58 } },
  ]);
  stack(padTrack, 0, 8, [
    { note: 'A3', options: { gate: 2.25, velocity: 0.56 } },
    { note: 'C4', options: { gate: 2.25, velocity: 0.54 } },
    { note: 'E4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stack(padTrack, 1, 0, [
    { note: 'A3', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'C4', options: { gate: 2.5, velocity: 0.54 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.56 } },
  ]);
  stack(padTrack, 1, 8, [
    { note: 'G3', options: { gate: 2.25, velocity: 0.58 } },
    { note: 'B3', options: { gate: 2.25, velocity: 0.52 } },
    { note: 'D4', options: { gate: 2.25, velocity: 0.54 } },
  ]);
  stack(padTrack, 2, 0, [
    { note: 'F3', options: { gate: 3, velocity: 0.62 } },
    { note: 'A3', options: { gate: 3, velocity: 0.56 } },
    { note: 'C4', options: { gate: 3, velocity: 0.58 } },
  ]);
  stack(padTrack, 2, 8, [
    { note: 'G3', options: { gate: 3, velocity: 0.58 } },
    { note: 'B3', options: { gate: 3, velocity: 0.54 } },
    { note: 'D4', options: { gate: 3, velocity: 0.56 } },
  ]);

  const timestamp = new Date().toISOString();

  return {
    arrangerClips: [
      createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
      createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
      createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
      createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
      createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 8 }),
      createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
      createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
      createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
      createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
      createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
      createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
      createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
      createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 2, startBeat: 32 }),
    ],
    metadata: {
      createdAt: timestamp,
      id: createId('project'),
      name: projectName,
      updatedAt: timestamp,
      version: PROJECT_SCHEMA_VERSION,
    },
    tracks,
    transport,
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
    : [createTrack('lead', { patternCount: transport.patternCount, stepsPerPattern: transport.stepsPerPattern })];
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const createdAt = typeof metadata.createdAt === 'string' ? metadata.createdAt : new Date().toISOString();
  const updatedAt = typeof metadata.updatedAt === 'string' ? metadata.updatedAt : createdAt;
  const arrangerClips = normalizeArrangerClips(input.arrangerClips, tracks, transport);

  return {
    arrangerClips: arrangerClips.length > 0
      ? arrangerClips
      : legacySectionsToClips(input.arranger, tracks, transport),
    metadata: {
      createdAt,
      id: typeof metadata.id === 'string' && metadata.id ? metadata.id : createId('project'),
      name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : 'Recovered Session',
      updatedAt,
      version: PROJECT_SCHEMA_VERSION,
    },
    tracks,
    transport,
  };
};

export const defaultNoteForTrack = (track: Track): string => {
  switch (track.type) {
    case 'kick':
    case 'snare':
    case 'hihat':
      return 'C1';
    case 'bass':
      return track.source.octaveShift <= -1 ? 'C2' : 'C3';
    case 'pad':
      return 'C4';
    case 'pluck':
      return 'E4';
    case 'fx':
      return 'G4';
    default:
      return 'C4';
  }
};
