export type AppView = 'SEQUENCER' | 'PIANO_ROLL' | 'MIXER' | 'ARRANGER';
export type InstrumentType = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'pad' | 'pluck' | 'fx';
export type TransportMode = 'PATTERN' | 'SONG';
export type OscillatorShape = 'sine' | 'triangle' | 'sawtooth' | 'square';
export type FilterMode = 'lowpass' | 'bandpass' | 'highpass';
export type SourceEngine = 'synth' | 'sample';
export type SamplePlaybackMode = 'pitched' | 'oneshot';
export type SampleTriggerMode = 'active-slice' | 'full-source' | 'step-mapped';
export type SamplePreset = 'kick-thud' | 'snare-crack' | 'hat-air' | 'bass-pluck' | 'lead-glass' | 'pad-haze' | 'pluck-mallet' | 'fx-rise';
export type SessionTemplateId = 'blank-grid' | 'night-transit' | 'beat-lab' | 'ambient-drift';

export interface SessionTemplateDefinition {
  description: string;
  focus: string;
  id: SessionTemplateId;
  label: string;
}

export interface SampleSliceMemory {
  end: number;
  gain: number;
  label: string;
  reverse: boolean;
  start: number;
}

export interface NoteEvent {
  gate: number;
  note: string;
  sampleSliceIndex?: number;
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

export interface PatternAutomation {
  level: number[];
  tone: number[];
}

export interface SynthParams {
  cutoff: number;
  resonance: number;
  filterMode: FilterMode;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  chorusSend: number;
  delaySend: number;
  reverbSend: number;
  bitCrush: number;
  distortion: number;
  vibratoDepth: number;
  vibratoRate: number;
}

export interface TrackSource {
  activeSampleSlice: number | null;
  customSampleDataUrl?: string;
  customSampleName?: string;
  detune: number;
  engine: SourceEngine;
  octaveShift: number;
  portamento: number;
  sampleEnd: number;
  sampleGain: number;
  samplePlayback: SamplePlaybackMode;
  samplePreset: SamplePreset;
  sampleReverse: boolean;
  sampleSlices: SampleSliceMemory[];
  sampleStart: number;
  sampleTriggerMode: SampleTriggerMode;
  waveform: OscillatorShape;
}

export interface Track {
  automation: Record<number, PatternAutomation>;
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

export interface MasterSettings {
  glueCompression: number;
  limiterCeiling: number;
  outputGain: number;
  tone: number;
}

export interface Project {
  master: MasterSettings;
  metadata: ProjectMetadata;
  transport: TransportSettings;
  tracks: Track[];
  arrangerClips: ArrangementClip[];
}

export interface StudioUIState {
  activeView: AppView;
  isSettingsOpen: boolean;
  pinnedTrackIds: string[];
  selectedArrangerClipId: string | null;
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
export const PROJECT_SCHEMA_VERSION = 9;

export const INITIAL_MASTER: MasterSettings = {
  glueCompression: 0.42,
  limiterCeiling: -0.2,
  outputGain: 0,
  tone: 0.55,
};

export const INITIAL_PARAMS: SynthParams = {
  cutoff: 2000,
  resonance: 1,
  filterMode: 'lowpass',
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.8,
  chorusSend: 0,
  delaySend: 0,
  reverbSend: 0,
  bitCrush: 0,
  distortion: 0,
  vibratoDepth: 0,
  vibratoRate: 4,
};

export const INITIAL_SOURCE: TrackSource = {
  activeSampleSlice: null,
  detune: 0,
  engine: 'synth',
  octaveShift: 0,
  portamento: 0,
  sampleEnd: 1,
  sampleGain: 1,
  samplePlayback: 'pitched',
  samplePreset: 'lead-glass',
  sampleReverse: false,
  sampleSlices: [],
  sampleStart: 0,
  sampleTriggerMode: 'active-slice',
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
    source: { octaveShift: -2, samplePlayback: 'oneshot', samplePreset: 'kick-thud', sampleTriggerMode: 'step-mapped', waveform: 'sine' },
    volume: -6,
  },
  snare: {
    color: '#fb923c',
    name: 'Sharp Snare',
    source: { samplePlayback: 'oneshot', samplePreset: 'snare-crack', sampleTriggerMode: 'step-mapped', waveform: 'square' },
    volume: -6,
  },
  hihat: {
    color: '#fbbf24',
    name: 'Neon Hat',
    source: { detune: 12, samplePlayback: 'oneshot', samplePreset: 'hat-air', sampleTriggerMode: 'step-mapped', waveform: 'square' },
    volume: -15,
  },
  bass: {
    color: '#60a5fa',
    name: 'Obsidian Bass',
    params: { attack: 0.01, decay: 0.18, release: 0.4, sustain: 0.55 },
    source: { octaveShift: -1, portamento: 0.03, samplePreset: 'bass-pluck', waveform: 'square' },
    volume: -6,
  },
  lead: {
    color: '#7dd3fc',
    name: 'Prism Lead',
    params: { chorusSend: 0.18, delaySend: 0.4, reverbSend: 0.3, release: 1.3, vibratoDepth: 0.1, vibratoRate: 5.2 },
    source: { octaveShift: 0, portamento: 0.05, samplePreset: 'lead-glass', waveform: 'sawtooth' },
    volume: -12,
  },
  pad: {
    color: '#67e8f9',
    name: 'Glass Pad',
    params: { attack: 0.18, chorusSend: 0.24, decay: 0.4, delaySend: 0.24, reverbSend: 0.48, release: 2.2, sustain: 0.72, vibratoDepth: 0.05, vibratoRate: 3.6 },
    source: { octaveShift: 0, portamento: 0.02, samplePreset: 'pad-haze', waveform: 'triangle' },
    volume: -16,
  },
  pluck: {
    color: '#c084fc',
    name: 'Pulse Pluck',
    params: { attack: 0.003, bitCrush: 0.08, decay: 0.16, release: 0.32, sustain: 0.18 },
    source: { octaveShift: 0, portamento: 0, samplePreset: 'pluck-mallet', waveform: 'square' },
    volume: -14,
  },
  fx: {
    color: '#fb7185',
    name: 'Motion FX',
    params: { attack: 0.02, bitCrush: 0.18, chorusSend: 0.16, decay: 0.6, delaySend: 0.58, distortion: 0.12, filterMode: 'bandpass', release: 1.4, reverbSend: 0.4, sustain: 0.38, vibratoDepth: 0.22, vibratoRate: 6.4 },
    source: { detune: 18, octaveShift: 1, portamento: 0.07, samplePlayback: 'oneshot', samplePreset: 'fx-rise', sampleTriggerMode: 'step-mapped', waveform: 'sawtooth' },
    volume: -18,
  },
};

const DEMO_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];
const BLANK_TRACK_ORDER: InstrumentType[] = ['kick', 'bass', 'lead'];
const BEAT_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'fx'];
const AMBIENT_TRACK_ORDER: InstrumentType[] = ['pad', 'pad', 'bass', 'lead', 'fx'];

export const SESSION_TEMPLATE_DEFINITIONS: SessionTemplateDefinition[] = [
  {
    description: 'A stripped studio state with only the lanes most sessions need first.',
    focus: 'Fast blank starting point',
    id: 'blank-grid',
    label: 'Blank Grid',
  },
  {
    description: 'A finished starter sketch with arrangement clips, drums, bass, lead, and pads already in motion.',
    focus: 'Songwriting reference session',
    id: 'night-transit',
    label: 'Night Transit',
  },
  {
    description: 'A tighter beat-first layout with sample-driven drums, bass, and FX ready for loop building.',
    focus: 'Beat writing and loop work',
    id: 'beat-lab',
    label: 'Beat Lab',
  },
  {
    description: 'Longer phrases, softer motion, and wide pad space for ambient or score-like writing.',
    focus: 'Atmosphere and harmony',
    id: 'ambient-drift',
    label: 'Ambient Drift',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampSampleEdge = (value: number, min: number, max: number) => clamp(value, min, max);

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const clampStepVelocity = (velocity: number) => clamp(velocity, 0.1, 1);
const clampStepGate = (gate: number) => clamp(gate, 0.25, 4);
const clampAutomationValue = (value: number) => clamp(value, 0, 1);
const cloneStep = (step: StepValue): StepValue => step.map((event) => ({ ...event }));
const buildProjectMetadata = (projectName: string): ProjectMetadata => {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    id: createId('project'),
    name: projectName,
    updatedAt: timestamp,
    version: PROJECT_SCHEMA_VERSION,
  };
};

const createProjectFrame = (
  projectName: string,
  {
    bpm,
    mode,
    patternCount = DEFAULT_PATTERN_COUNT,
    stepsPerPattern = DEFAULT_STEPS_PER_PATTERN,
    trackOrder,
  }: {
    bpm: number;
    mode: TransportMode;
    patternCount?: number;
    stepsPerPattern?: number;
    trackOrder: InstrumentType[];
  },
) => {
  const transport: TransportSettings = {
    bpm,
    currentPattern: 0,
    mode,
    patternCount,
    stepsPerPattern,
  };
  const tracks = trackOrder.map((type) => createTrack(type, {
    patternCount: transport.patternCount,
    stepsPerPattern: transport.stepsPerPattern,
  }));

  return {
    buildProject: (arrangerClips: ArrangementClip[]): Project => ({
      arrangerClips,
      master: INITIAL_MASTER,
      metadata: buildProjectMetadata(projectName),
      tracks,
      transport,
    }),
    tracks,
    transport,
  };
};

const putStep = (
  track: Track,
  patternIndex: number,
  stepIndex: number,
  note: string,
  options: Partial<NoteEvent> = {},
) => {
  track.patterns[patternIndex][stepIndex] = [createStepEvent(note, options)];
};

const stackStep = (
  track: Track,
  patternIndex: number,
  stepIndex: number,
  notes: Array<{ note: string; options?: Partial<NoteEvent> }>,
) => {
  track.patterns[patternIndex][stepIndex] = notes.map((entry) => createStepEvent(entry.note, entry.options));
};

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

const isSourceEngine = (value: unknown): value is SourceEngine => (
  value === 'synth'
  || value === 'sample'
);

const isSamplePlaybackMode = (value: unknown): value is SamplePlaybackMode => (
  value === 'pitched'
  || value === 'oneshot'
);

const isSampleTriggerMode = (value: unknown): value is SampleTriggerMode => (
  value === 'active-slice'
  || value === 'full-source'
  || value === 'step-mapped'
);

const isSamplePreset = (value: unknown): value is SamplePreset => (
  value === 'kick-thud'
  || value === 'snare-crack'
  || value === 'hat-air'
  || value === 'bass-pluck'
  || value === 'lead-glass'
  || value === 'pad-haze'
  || value === 'pluck-mallet'
  || value === 'fx-rise'
);

const isFilterMode = (value: unknown): value is FilterMode => (
  value === 'lowpass'
  || value === 'bandpass'
  || value === 'highpass'
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const normalizeSampleSliceMemory = (
  candidate: unknown,
  index: number,
): SampleSliceMemory | null => {
  if (!isRecord(candidate)) {
    return null;
  }

  const start = clampSampleEdge(
    typeof candidate.start === 'number' ? candidate.start : 0,
    0,
    0.95,
  );
  const end = Math.max(
    start + 0.05,
    clampSampleEdge(
      typeof candidate.end === 'number' ? candidate.end : 1,
      0.05,
      1,
    ),
  );

  return {
    end,
    gain: clamp(
      typeof candidate.gain === 'number' ? candidate.gain : 1,
      0.25,
      2,
    ),
    label: typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label.trim().slice(0, 16)
      : `Slice ${index + 1}`,
    reverse: Boolean(candidate.reverse),
    start,
  };
};

const normalizeSource = (
  type: InstrumentType,
  source: unknown,
): TrackSource => {
  const presetSource = TRACK_PRESETS[type].source;
  const candidate = isRecord(source) ? source : {};
  const sampleStart = clamp(
    typeof candidate.sampleStart === 'number' ? candidate.sampleStart : presetSource?.sampleStart ?? INITIAL_SOURCE.sampleStart,
    0,
    0.95,
  );
  const sampleEnd = Math.max(
    sampleStart + 0.05,
    clamp(
      typeof candidate.sampleEnd === 'number' ? candidate.sampleEnd : presetSource?.sampleEnd ?? INITIAL_SOURCE.sampleEnd,
      0.05,
      1,
    ),
  );
  const sampleSlices = Array.isArray(candidate.sampleSlices)
    ? candidate.sampleSlices
      .slice(0, 8)
      .map((slice, index) => normalizeSampleSliceMemory(slice, index))
      .filter((slice): slice is SampleSliceMemory => slice !== null)
    : [];
  const activeSampleSlice = typeof candidate.activeSampleSlice === 'number'
    && Number.isInteger(candidate.activeSampleSlice)
    && candidate.activeSampleSlice >= 0
    && candidate.activeSampleSlice < sampleSlices.length
    ? candidate.activeSampleSlice
    : INITIAL_SOURCE.activeSampleSlice;

  return {
    activeSampleSlice,
    customSampleDataUrl: typeof candidate.customSampleDataUrl === 'string' && candidate.customSampleDataUrl.startsWith('data:audio/')
      ? candidate.customSampleDataUrl
      : undefined,
    customSampleName: typeof candidate.customSampleName === 'string' && candidate.customSampleName.trim()
      ? candidate.customSampleName.trim()
      : undefined,
    detune: clamp(
      typeof candidate.detune === 'number' ? candidate.detune : presetSource?.detune ?? INITIAL_SOURCE.detune,
      -2400,
      2400,
    ),
    engine: isSourceEngine(candidate.engine)
      ? candidate.engine
      : presetSource?.engine ?? INITIAL_SOURCE.engine,
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
    sampleEnd,
    sampleGain: clamp(
      typeof candidate.sampleGain === 'number' ? candidate.sampleGain : presetSource?.sampleGain ?? INITIAL_SOURCE.sampleGain,
      0.25,
      2,
    ),
    samplePlayback: isSamplePlaybackMode(candidate.samplePlayback)
      ? candidate.samplePlayback
      : presetSource?.samplePlayback ?? INITIAL_SOURCE.samplePlayback,
    samplePreset: isSamplePreset(candidate.samplePreset)
      ? candidate.samplePreset
      : presetSource?.samplePreset ?? INITIAL_SOURCE.samplePreset,
    sampleReverse: Boolean(candidate.sampleReverse),
    sampleSlices,
    sampleStart,
    sampleTriggerMode: isSampleTriggerMode(candidate.sampleTriggerMode)
      ? candidate.sampleTriggerMode
      : presetSource?.sampleTriggerMode ?? INITIAL_SOURCE.sampleTriggerMode,
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
    filterMode: isFilterMode(candidate.filterMode) ? candidate.filterMode : presetParams?.filterMode ?? INITIAL_PARAMS.filterMode,
    attack: clamp(typeof candidate.attack === 'number' ? candidate.attack : presetParams?.attack ?? INITIAL_PARAMS.attack, 0.001, 2),
    decay: clamp(typeof candidate.decay === 'number' ? candidate.decay : presetParams?.decay ?? INITIAL_PARAMS.decay, 0.01, 4),
    sustain: clamp(typeof candidate.sustain === 'number' ? candidate.sustain : presetParams?.sustain ?? INITIAL_PARAMS.sustain, 0, 1),
    release: clamp(typeof candidate.release === 'number' ? candidate.release : presetParams?.release ?? INITIAL_PARAMS.release, 0.01, 8),
    chorusSend: clamp(typeof candidate.chorusSend === 'number' ? candidate.chorusSend : presetParams?.chorusSend ?? INITIAL_PARAMS.chorusSend, 0, 1),
    delaySend: clamp(typeof candidate.delaySend === 'number' ? candidate.delaySend : presetParams?.delaySend ?? INITIAL_PARAMS.delaySend, 0, 1),
    reverbSend: clamp(typeof candidate.reverbSend === 'number' ? candidate.reverbSend : presetParams?.reverbSend ?? INITIAL_PARAMS.reverbSend, 0, 1),
    bitCrush: clamp(typeof candidate.bitCrush === 'number' ? candidate.bitCrush : presetParams?.bitCrush ?? INITIAL_PARAMS.bitCrush, 0, 1),
    distortion: clamp(typeof candidate.distortion === 'number' ? candidate.distortion : presetParams?.distortion ?? INITIAL_PARAMS.distortion, 0, 1),
    vibratoDepth: clamp(typeof candidate.vibratoDepth === 'number' ? candidate.vibratoDepth : presetParams?.vibratoDepth ?? INITIAL_PARAMS.vibratoDepth, 0, 1),
    vibratoRate: clamp(typeof candidate.vibratoRate === 'number' ? candidate.vibratoRate : presetParams?.vibratoRate ?? INITIAL_PARAMS.vibratoRate, 0.1, 12),
  };
};

export const createStepEvent = (
  note: string,
  options: Partial<NoteEvent> = {},
): NoteEvent => ({
  gate: clampStepGate(options.gate ?? 1),
  note,
  sampleSliceIndex: typeof options.sampleSliceIndex === 'number' && Number.isInteger(options.sampleSliceIndex)
    ? Math.max(0, options.sampleSliceIndex)
    : undefined,
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
        sampleSliceIndex: typeof candidate.sampleSliceIndex === 'number' ? candidate.sampleSliceIndex : undefined,
        velocity: typeof candidate.velocity === 'number' ? candidate.velocity : 0.82,
      })];
    });
  }

  if (!isRecord(value) || typeof value.note !== 'string') {
    return [];
  }

  return [createStepEvent(value.note, {
    gate: typeof value.gate === 'number' ? value.gate : 1,
    sampleSliceIndex: typeof value.sampleSliceIndex === 'number' ? value.sampleSliceIndex : undefined,
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

const createAutomationPattern = (stepCount: number): PatternAutomation => ({
  level: Array.from({ length: stepCount }, () => 0.5),
  tone: Array.from({ length: stepCount }, () => 0.5),
});

const normalizeAutomation = (
  automation: unknown,
  patternCount: number,
  stepCount: number,
): Record<number, PatternAutomation> => {
  const candidate = isRecord(automation) ? automation : {};
  const nextAutomation: Record<number, PatternAutomation> = {};

  for (let patternIndex = 0; patternIndex < patternCount; patternIndex += 1) {
    const rawPatternCandidate = candidate[patternIndex];
    const rawPattern = isRecord(rawPatternCandidate) ? rawPatternCandidate : {};
    const rawLevel = Array.isArray(rawPattern.level) ? rawPattern.level : [];
    const rawTone = Array.isArray(rawPattern.tone) ? rawPattern.tone : [];
    const fallbackPattern = createAutomationPattern(stepCount);

    nextAutomation[patternIndex] = {
      level: Array.from({ length: stepCount }, (_, stepIndex) => clampAutomationValue(
        typeof rawLevel[stepIndex] === 'number'
          ? rawLevel[stepIndex]
          : fallbackPattern.level[stepIndex],
      )),
      tone: Array.from({ length: stepCount }, (_, stepIndex) => clampAutomationValue(
        typeof rawTone[stepIndex] === 'number'
          ? rawTone[stepIndex]
          : fallbackPattern.tone[stepIndex],
      )),
    };
  }

  return nextAutomation;
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

const normalizeMaster = (master: unknown): MasterSettings => {
  const candidate = isRecord(master) ? master : {};

  return {
    glueCompression: clamp(
      typeof candidate.glueCompression === 'number' ? candidate.glueCompression : INITIAL_MASTER.glueCompression,
      0,
      1,
    ),
    limiterCeiling: clamp(
      typeof candidate.limiterCeiling === 'number' ? candidate.limiterCeiling : INITIAL_MASTER.limiterCeiling,
      -1.2,
      0,
    ),
    outputGain: clamp(
      typeof candidate.outputGain === 'number' ? candidate.outputGain : INITIAL_MASTER.outputGain,
      -12,
      12,
    ),
    tone: clamp(
      typeof candidate.tone === 'number' ? candidate.tone : INITIAL_MASTER.tone,
      0,
      1,
    ),
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
    automation: normalizeAutomation(candidate.automation, transport.patternCount, transport.stepsPerPattern),
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

export const createAutomationBank = (
  patternCount: number = DEFAULT_PATTERN_COUNT,
  stepCount: number = DEFAULT_STEPS_PER_PATTERN,
): Record<number, PatternAutomation> => {
  const automation: Record<number, PatternAutomation> = {};

  for (let index = 0; index < patternCount; index += 1) {
    automation[index] = createAutomationPattern(stepCount);
  }

  return automation;
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
    automation?: Record<number, PatternAutomation>;
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
    automation: options.automation
      ? normalizeAutomation(options.automation, patternCount, stepsPerPattern)
      : createAutomationBank(patternCount, stepsPerPattern),
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
    automation: track.automation,
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
  const automation: Record<number, PatternAutomation> = {};

  for (let patternIndex = 0; patternIndex < patternCount; patternIndex += 1) {
    const sourceSteps = track.patterns[patternIndex] ?? [];
    patterns[patternIndex] = Array.from({ length: stepsPerPattern }, (_, stepIndex) => {
    const value = sourceSteps[stepIndex];
      return Array.isArray(value) ? cloneStep(value) : [];
    });
    const sourceAutomation = track.automation?.[patternIndex] ?? createAutomationPattern(stepsPerPattern);
    automation[patternIndex] = {
      level: Array.from({ length: stepsPerPattern }, (_, stepIndex) => clampAutomationValue(sourceAutomation.level[stepIndex] ?? 0.5)),
      tone: Array.from({ length: stepsPerPattern }, (_, stepIndex) => clampAutomationValue(sourceAutomation.tone[stepIndex] ?? 0.5)),
    };
  }

  return {
    automation,
    ...track,
    patterns,
  };
};

export const createDemoProject = (projectName: string = 'Night Transit'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 124,
    mode: 'SONG',
    trackOrder: DEMO_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack] = tracks;
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.96 });
  putStep(kickTrack, 0, 4, 'C1', { velocity: 0.86 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.94 });
  putStep(kickTrack, 0, 12, 'C1', { velocity: 0.88 });
  putStep(kickTrack, 1, 0, 'C1', { velocity: 0.98 });
  putStep(kickTrack, 1, 6, 'C1', { velocity: 0.82 });
  putStep(kickTrack, 1, 8, 'C1', { velocity: 0.94 });
  putStep(kickTrack, 1, 12, 'C1', { velocity: 0.9 });
  putStep(kickTrack, 2, 0, 'C1', { velocity: 1 });
  putStep(kickTrack, 2, 4, 'C1', { velocity: 0.86 });
  putStep(kickTrack, 2, 7, 'C1', { velocity: 0.8 });
  putStep(kickTrack, 2, 10, 'C1', { velocity: 0.84 });
  putStep(kickTrack, 2, 12, 'C1', { velocity: 0.96 });

  putStep(snareTrack, 0, 4, 'C1', { velocity: 0.78 });
  putStep(snareTrack, 0, 12, 'C1', { velocity: 0.86 });
  putStep(snareTrack, 1, 4, 'C1', { velocity: 0.78 });
  putStep(snareTrack, 1, 10, 'C1', { velocity: 0.64 });
  putStep(snareTrack, 1, 12, 'C1', { velocity: 0.9 });
  putStep(snareTrack, 2, 4, 'C1', { velocity: 0.8 });
  putStep(snareTrack, 2, 12, 'C1', { velocity: 0.88 });

  for (const step of [2, 6, 10, 14]) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.5, velocity: 0.56 });
  }
  for (const step of [1, 3, 5, 7, 9, 11, 13, 15]) {
    putStep(hihatTrack, 1, step, 'C1', { gate: 0.5, velocity: 0.5 });
  }
  for (const step of [0, 3, 6, 9, 12, 15]) {
    putStep(hihatTrack, 2, step, 'C1', { gate: 0.5, velocity: 0.54 });
  }

  putStep(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.78 });
  putStep(bassTrack, 0, 8, 'G1', { gate: 1.5, velocity: 0.72 });
  putStep(bassTrack, 1, 0, 'A1', { gate: 1.5, velocity: 0.78 });
  putStep(bassTrack, 1, 4, 'C2', { gate: 1.25, velocity: 0.7 });
  putStep(bassTrack, 1, 8, 'E2', { gate: 1.5, velocity: 0.76 });
  putStep(bassTrack, 1, 12, 'G1', { gate: 1.25, velocity: 0.72 });
  putStep(bassTrack, 2, 0, 'F1', { gate: 1.75, velocity: 0.8 });
  putStep(bassTrack, 2, 8, 'G1', { gate: 1.5, velocity: 0.76 });

  putStep(leadTrack, 0, 0, 'C4', { gate: 1.25, velocity: 0.82 });
  putStep(leadTrack, 0, 3, 'D#4', { gate: 1, velocity: 0.76 });
  putStep(leadTrack, 0, 8, 'G4', { gate: 1.25, velocity: 0.88 });
  putStep(leadTrack, 0, 14, 'F4', { gate: 1, velocity: 0.72 });
  putStep(leadTrack, 1, 0, 'A4', { gate: 1.25, velocity: 0.86 });
  putStep(leadTrack, 1, 4, 'C5', { gate: 1.25, velocity: 0.8 });
  putStep(leadTrack, 1, 8, 'E5', { gate: 1.25, velocity: 0.92 });
  putStep(leadTrack, 1, 12, 'G4', { gate: 1, velocity: 0.74 });
  putStep(leadTrack, 2, 2, 'F4', { gate: 1, velocity: 0.74 });
  putStep(leadTrack, 2, 6, 'G4', { gate: 1, velocity: 0.78 });
  putStep(leadTrack, 2, 10, 'A4', { gate: 1, velocity: 0.84 });
  putStep(leadTrack, 2, 14, 'C5', { gate: 1.25, velocity: 0.9 });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.62 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.56 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.58 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A3', options: { gate: 2.25, velocity: 0.56 } },
    { note: 'C4', options: { gate: 2.25, velocity: 0.54 } },
    { note: 'E4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 1, 0, [
    { note: 'A3', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'C4', options: { gate: 2.5, velocity: 0.54 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.56 } },
  ]);
  stackStep(padTrack, 1, 8, [
    { note: 'G3', options: { gate: 2.25, velocity: 0.58 } },
    { note: 'B3', options: { gate: 2.25, velocity: 0.52 } },
    { note: 'D4', options: { gate: 2.25, velocity: 0.54 } },
  ]);
  stackStep(padTrack, 2, 0, [
    { note: 'F3', options: { gate: 3, velocity: 0.62 } },
    { note: 'A3', options: { gate: 3, velocity: 0.56 } },
    { note: 'C4', options: { gate: 3, velocity: 0.58 } },
  ]);
  stackStep(padTrack, 2, 8, [
    { note: 'G3', options: { gate: 3, velocity: 0.58 } },
    { note: 'B3', options: { gate: 3, velocity: 0.54 } },
    { note: 'D4', options: { gate: 3, velocity: 0.56 } },
  ]);

  return buildProject([
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
    ]);
};

export const createBlankProject = (projectName: string = 'Blank Grid'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 120,
    mode: 'PATTERN',
    trackOrder: BLANK_TRACK_ORDER,
  });
  const [kickTrack, bassTrack, leadTrack] = tracks;

  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.9 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.86 });
  putStep(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.72 });
  putStep(leadTrack, 0, 8, 'G4', { gate: 1, velocity: 0.74 });

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ]);
};

export const createBeatLabProject = (projectName: string = 'Beat Lab'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 136,
    mode: 'SONG',
    trackOrder: BEAT_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, fxTrack] = tracks;

  for (const step of [0, 3, 8, 11]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: step === 0 || step === 8 ? 0.96 : 0.78 });
  }
  for (const step of [4, 12]) {
    putStep(snareTrack, 0, step, 'C1', { velocity: 0.84 });
    putStep(snareTrack, 1, step, 'C1', { velocity: 0.88 });
  }
  for (const step of [1, 5, 9, 13]) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.5, velocity: 0.52, sampleSliceIndex: 0 });
  }
  for (const step of [2, 6, 10, 14]) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.5, velocity: 0.62, sampleSliceIndex: 1 });
  }
  putStep(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.76 });
  putStep(bassTrack, 0, 6, 'D#2', { gate: 1, velocity: 0.7 });
  putStep(bassTrack, 0, 8, 'F2', { gate: 1.25, velocity: 0.74 });
  putStep(bassTrack, 0, 14, 'G2', { gate: 1.25, velocity: 0.68 });
  putStep(fxTrack, 1, 12, 'G4', { gate: 2, velocity: 0.7 });

  hihatTrack.source.engine = 'sample';
  hihatTrack.source.sampleTriggerMode = 'step-mapped';
  hihatTrack.source.samplePlayback = 'oneshot';
  hihatTrack.source.sampleSlices = [
    { end: 0.22, gain: 0.94, label: 'Hat Tight', reverse: false, start: 0 },
    { end: 0.5, gain: 1, label: 'Hat Body', reverse: false, start: 0.22 },
    { end: 1, gain: 1.04, label: 'Hat Tail', reverse: false, start: 0.5 },
  ];
  hihatTrack.source.activeSampleSlice = 1;
  fxTrack.source.engine = 'sample';
  fxTrack.source.samplePlayback = 'oneshot';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 16 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 16 }),
    createArrangerClip(fxTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
  ]);
};

export const createAmbientProject = (projectName: string = 'Ambient Drift'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 94,
    mode: 'SONG',
    trackOrder: AMBIENT_TRACK_ORDER,
  });
  const [padTrackA, padTrackB, bassTrack, leadTrack, fxTrack] = tracks;

  stackStep(padTrackA, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.48 } },
    { note: 'G4', options: { gate: 4, velocity: 0.42 } },
    { note: 'D5', options: { gate: 4, velocity: 0.4 } },
  ]);
  stackStep(padTrackA, 1, 0, [
    { note: 'A3', options: { gate: 4, velocity: 0.46 } },
    { note: 'E4', options: { gate: 4, velocity: 0.42 } },
    { note: 'B4', options: { gate: 4, velocity: 0.38 } },
  ]);
  stackStep(padTrackB, 0, 8, [
    { note: 'E4', options: { gate: 3, velocity: 0.42 } },
    { note: 'A4', options: { gate: 3, velocity: 0.38 } },
  ]);
  stackStep(padTrackB, 1, 8, [
    { note: 'D4', options: { gate: 3, velocity: 0.4 } },
    { note: 'G4', options: { gate: 3, velocity: 0.36 } },
  ]);
  putStep(bassTrack, 0, 0, 'C2', { gate: 3.5, velocity: 0.56 });
  putStep(bassTrack, 1, 0, 'A1', { gate: 3.5, velocity: 0.52 });
  putStep(leadTrack, 0, 12, 'G4', { gate: 1.75, velocity: 0.62 });
  putStep(leadTrack, 1, 12, 'A4', { gate: 1.75, velocity: 0.6 });
  putStep(fxTrack, 0, 15, 'C5', { gate: 2.5, velocity: 0.5 });

  padTrackA.params.reverbSend = 0.62;
  padTrackA.params.delaySend = 0.34;
  padTrackB.params.reverbSend = 0.72;
  padTrackB.params.chorusSend = 0.32;
  fxTrack.source.engine = 'sample';
  fxTrack.source.samplePlayback = 'oneshot';
  fxTrack.source.sampleTriggerMode = 'active-slice';

  return buildProject([
    createArrangerClip(padTrackA.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrackB.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(fxTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrackA.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(padTrackB.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(fxTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 16 }),
  ]);
};

export const createProjectFromTemplate = (
  templateId: SessionTemplateId,
): Project => {
  switch (templateId) {
    case 'blank-grid':
      return createBlankProject();
    case 'beat-lab':
      return createBeatLabProject();
    case 'ambient-drift':
      return createAmbientProject();
    case 'night-transit':
    default:
      return createDemoProject();
  }
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
    master: normalizeMaster(input.master),
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
