import { NOTE_GATE_MAX, NOTE_GATE_MIN, clampNoteGate } from '../utils/noteEditing';
import { runSchemaMigrations } from './migrations';
// Used at call time inside the scene builders below. schema and sceneBuilder
// reference each other only from inside functions, so the cycle is inert at
// module load.
import { arrangeSections } from './sceneBuilder';

export type AppView = 'SEQUENCER' | 'MIXER';

// Canonical left-to-right order of the workspace view tabs. The nav rail and
// the Alt+1..2 shortcuts both read this so the numbering always matches what
// is on screen.
export const APP_VIEW_ORDER: readonly AppView[] = ['SEQUENCER', 'MIXER'];
export type InstrumentType = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'pad' | 'pluck' | 'fx' | 'violin' | 'piano' | 'bell';
export type TransportMode = 'PATTERN' | 'SONG';
export type OscillatorShape =
  | 'sine'
  | 'triangle'
  | 'sawtooth'
  | 'square'
  | 'pulse'
  | 'pwm'
  | 'fatsawtooth'
  | 'fatsquare'
  | 'fattriangle'
  | 'fatsine';
export type FilterMode = 'lowpass' | 'bandpass' | 'highpass';
export type SourceEngine = 'synth' | 'sample';
export type SamplePlaybackMode = 'pitched' | 'oneshot';
export type SampleTriggerMode = 'active-slice' | 'full-source' | 'step-mapped';
export type SamplePreset = 'kick-thud' | 'snare-crack' | 'hat-air' | 'bass-pluck' | 'lead-glass' | 'pad-haze' | 'pluck-mallet' | 'fx-rise';
export type SessionTemplateId = 'blank-grid' | 'night-transit' | 'beat-lab' | 'ambient-drift' | 'lofi-sunday' | 'synthwave-drive' | 'club-horizon' | 'starlight-parade' | 'velvet-suite' | 'crystal-garden' | 'twilight-frame' | 'late-hours' | 'pulse-rider' | 'midnight-trap' | 'neon-breaks' | 'sunset-house' | 'palm-hour' | 'pirate-radio';

export interface SessionTemplateDefinition {
  description: string;
  focus: string;
  id: SessionTemplateId;
  label: string;
}

export interface TrackVoicePresetDefinition {
  description: string;
  focus: string;
  id: string;
  label: string;
  params?: Partial<SynthParams>;
  source?: Partial<TrackSource>;
  trackTypes: InstrumentType[];
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

export interface SongMarker {
  beat: number;
  id: string;
  name: string;
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
  /** Supersaw width for the fat* oscillator shapes (0 = mono, 1 = widest). */
  unison: number;
  /** Filter envelope depth: how far the cutoff opens on each note attack (0..1). */
  filterEnvAmount: number;
  /** Filter envelope fall time back to the base cutoff, in seconds. */
  filterEnvDecay: number;
  /** Per-lane looseness: velocity and micro-timing jitter (0 = locked to the grid, 1 = loosest). */
  humanize: number;
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
  countInBars: number;
  currentPattern: number;
  metronomeEnabled: boolean;
  mode: TransportMode;
  patternCount: number;
  stepsPerPattern: number;
}

export interface MasterSettings {
  glueCompression: number;
  highCutHz: number;
  limiterCeiling: number;
  lowCutHz: number;
  outputGain: number;
  stereoWidth: number;
  tone: number;
}

export interface MasterSnapshot {
  id: string;
  name: string;
  settings: MasterSettings;
  updatedAt: string;
}

export interface TrackSnapshot {
  id: string;
  name: string;
  pan: number;
  params: SynthParams;
  source: TrackSource;
  trackType: InstrumentType;
  updatedAt: string;
  volume: number;
}

export interface MasterPresetDefinition {
  description: string;
  id: 'balanced' | 'club' | 'open-air';
  label: string;
  settings: MasterSettings;
}

export interface BounceHistoryEntry {
  crestDb?: number;
  durationSeconds?: number;
  estimatedLufs?: number;
  exportedAt: string;
  id: string;
  label: string;
  masterSnapshotName: string | null;
  mode: 'mix' | 'stems';
  normalization: 'none' | 'peak' | 'target';
  peakDb?: number;
  quality?: 'clean' | 'hot' | 'quiet' | 'silent';
  recommendation?: string;
  rmsDb?: number;
  sampleRate?: number;
  scope: 'pattern' | 'song' | 'clip-window' | 'loop-window';
  tailMode: 'short' | 'standard' | 'long';
  targetDeltaDb?: number;
  targetLabel?: string;
  targetLufs?: number;
  targetLufsDelta?: number;
  targetProfileId?: 'draft' | 'streaming' | 'club' | 'open';
  targetVerdict?: 'aligned' | 'loud' | 'soft' | 'flat' | 'spiky';
}

export interface Project {
  bounceHistory: BounceHistoryEntry[];
  master: MasterSettings;
  masterSnapshots: MasterSnapshot[];
  metadata: ProjectMetadata;
  trackSnapshots: TrackSnapshot[];
  transport: TransportSettings;
  tracks: Track[];
  arrangerClips: ArrangementClip[];
  markers: SongMarker[];
}

export interface StudioUIState {
  activeView: AppView;
  isSettingsOpen: boolean;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
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
export const MAX_PATTERN_COUNT = 16;
export const MAX_STEPS_PER_PATTERN = 4096;
export const MIN_PATTERN_COUNT = 1;
export const MIN_STEPS_PER_PATTERN = 8;
export const PROJECT_SCHEMA_VERSION = 12;

const MAX_ARRANGER_BEAT_POSITION = 99999;

export const INITIAL_MASTER: MasterSettings = {
  glueCompression: 0.42,
  highCutHz: 18000,
  limiterCeiling: -0.2,
  lowCutHz: 28,
  outputGain: 0,
  stereoWidth: 0.5,
  tone: 0.55,
};

export const MASTER_PRESET_DEFINITIONS: MasterPresetDefinition[] = [
  {
    description: 'Even output contour for general songwriting and revision prints.',
    id: 'balanced',
    label: 'Balanced',
    settings: {
      glueCompression: 0.42,
      highCutHz: 18000,
      limiterCeiling: -0.2,
      lowCutHz: 28,
      outputGain: 0,
      stereoWidth: 0.5,
      tone: 0.55,
    },
  },
  {
    description: 'Tighter glue and firmer output for rhythm-heavy reference mixes.',
    id: 'club',
    label: 'Club',
    settings: {
      glueCompression: 0.64,
      highCutHz: 16800,
      limiterCeiling: -0.1,
      lowCutHz: 42,
      outputGain: 1.5,
      stereoWidth: 0.44,
      tone: 0.48,
    },
  },
  {
    description: 'Lighter glue and more air for spacious sketches and melodic work.',
    id: 'open-air',
    label: 'Open Air',
    settings: {
      glueCompression: 0.24,
      highCutHz: 19600,
      limiterCeiling: -0.35,
      lowCutHz: 24,
      outputGain: -0.5,
      stereoWidth: 0.68,
      tone: 0.68,
    },
  },
];

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
  unison: 0,
  filterEnvAmount: 0,
  filterEnvDecay: 0.2,
  humanize: 0,
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
    source: { detune: 12, engine: 'sample', sampleGain: 1.08, samplePlayback: 'oneshot', samplePreset: 'hat-air', sampleTriggerMode: 'full-source', waveform: 'square' },
    volume: -13,
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
    source: { engine: 'sample', octaveShift: 0, portamento: 0.01, sampleGain: 1.04, samplePlayback: 'pitched', samplePreset: 'pad-haze', sampleTriggerMode: 'full-source', waveform: 'triangle' },
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
  violin: {
    color: '#e0a86b',
    name: 'Velvet Violin',
    params: { attack: 0.085, chorusSend: 0.12, decay: 0.22, release: 0.7, reverbSend: 0.34, sustain: 0.88, vibratoDepth: 0.13, vibratoRate: 5.6 },
    source: { octaveShift: 0, portamento: 0.04, samplePreset: 'lead-glass', waveform: 'sawtooth' },
    volume: -13,
  },
  piano: {
    color: '#83c995',
    name: 'Felt Piano',
    params: { attack: 0.006, chorusSend: 0.08, decay: 0.9, release: 0.85, reverbSend: 0.22, sustain: 0.2 },
    source: { octaveShift: 0, portamento: 0, samplePreset: 'lead-glass', waveform: 'sine' },
    volume: -11,
  },
  bell: {
    color: '#b9c2da',
    name: 'Crystal Bell',
    params: { attack: 0.002, decay: 0.7, delaySend: 0.18, release: 1.6, reverbSend: 0.42, sustain: 0.12 },
    source: { octaveShift: 0, portamento: 0, samplePreset: 'lead-glass', waveform: 'sine' },
    volume: -14,
  },
};

const DEMO_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];
const BLANK_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];
const BEAT_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'fx'];
const AMBIENT_TRACK_ORDER: InstrumentType[] = ['pad', 'pad', 'bass', 'lead', 'fx'];
const LOFI_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'pad', 'lead'];
const SYNTHWAVE_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];
const CLUB_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'pluck', 'pad', 'fx'];
const TRAP_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'bell', 'pad'];
const DNB_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad'];
const HOUSE_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'pad', 'pluck'];
const PULSE_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'fx'];
const STARLIGHT_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck'];
const VELVET_SUITE_TRACK_ORDER: InstrumentType[] = ['bass', 'piano', 'pad', 'violin'];
const CRYSTAL_GARDEN_TRACK_ORDER: InstrumentType[] = ['kick', 'bass', 'piano', 'pad', 'bell'];
const TWILIGHT_FRAME_TRACK_ORDER: InstrumentType[] = ['kick', 'bass', 'piano', 'pad', 'violin', 'bell'];
const LATE_HOURS_TRACK_ORDER: InstrumentType[] = ['kick', 'bass', 'pad', 'violin', 'lead', 'bell'];
const PALM_HOUR_TRACK_ORDER: InstrumentType[] = ['kick', 'snare', 'hihat', 'bass', 'piano', 'pad'];

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
  {
    description: 'Slow drums, soft chords, and a sparse lead line at 78 BPM. Easy to start writing over.',
    focus: 'Lo-fi hip hop sketch',
    id: 'lofi-sunday',
    label: 'Lo-Fi Sunday',
  },
  {
    description: 'Four-on-the-floor kick, syncopated bass, melodic lead, and a wide pad. 108 BPM.',
    focus: 'Synthwave drive',
    id: 'synthwave-drive',
    label: 'Synthwave Drive',
  },
  {
    description: 'Club-ready kick, bright pluck stabs, a pumping bass lane, and a lift FX track already in motion.',
    focus: 'Club lift and stabs',
    id: 'club-horizon',
    label: 'Club Horizon',
  },
  {
    description: 'Four-on-the-floor drive in E major at 125 BPM. A clean pad-and-hats intro, then the full groove with a bright lead hook and a lift.',
    focus: 'Driving electronic groove',
    id: 'pulse-rider',
    label: 'Pulse Rider',
  },
  {
    description: 'Bright pop drums, melodic bass, glossy lead hooks, and a counter-pluck for fast topline writing.',
    focus: 'Bright pop motion',
    id: 'starlight-parade',
    label: 'Starlight Parade',
  },
  {
    description: 'A chamber sketch in C: held bass, piano triads, a soft pad bed, and a singing violin line. No drums, just air.',
    focus: 'Strings and piano',
    id: 'velvet-suite',
    label: 'Velvet Suite',
  },
  {
    description: 'A bright I-IV-V loop with a soft kick anchor, piano stabs, a wide pad, and a bell sparkling on the offbeats.',
    focus: 'Bell-led sparkle',
    id: 'crystal-garden',
    label: 'Crystal Garden',
  },
  {
    description: 'Cinematic A-minor loop. Soft kick anchor, walking bass, piano triads, a held pad, a singing violin line, and bell sparkles on the changes.',
    focus: 'Cinematic strings and bell',
    id: 'twilight-frame',
    label: 'Twilight Frame',
  },
  {
    description: 'Slow D-minor cycle that leans on the new voice presets: tape-warmed pad, bowed violin, glass bell, whistled lead, and a round sub bass.',
    focus: 'New voices showcase',
    id: 'late-hours',
    label: 'Late Hours',
  },
  {
    description: 'Halftime trap in G minor at 140 BPM: a booming 808, rattling triplet hats, a backbeat clap, a dark bell hook, and a low pad.',
    focus: 'Halftime trap',
    id: 'midnight-trap',
    label: 'Midnight Trap',
  },
  {
    description: 'Drum and bass at 174 BPM in A minor: a two-step break, a growling reese sub, a stabbed lead, and a wide atmosphere pad.',
    focus: 'Drum and bass roller',
    id: 'neon-breaks',
    label: 'Neon Breaks',
  },
  {
    description: 'Deep house in A minor at 122 BPM: four-on-the-floor kick, offbeat open hats, a round bassline, lush ninth-chord pads, and an organ pluck.',
    focus: 'Deep house groove',
    id: 'sunset-house',
    label: 'Sunset House',
  },
  {
    description: 'Amapiano at 112 BPM in A minor: a soft four-on-the-floor kick, shuffled shakers, a bouncing log-drum bass, warm piano chords, and a wide pad.',
    focus: 'Amapiano log-drum groove',
    id: 'palm-hour',
    label: 'Palm Hour',
  },
  {
    description: 'UK garage at 133 BPM in A minor: a skippy two-step kick, crisp backbeat snares, shuffled hats, a bouncing sub, and chopped stabs over a warm pad.',
    focus: 'UK garage two-step',
    id: 'pirate-radio',
    label: 'Pirate Radio',
  },
];

export const TRACK_VOICE_PRESET_DEFINITIONS: TrackVoicePresetDefinition[] = [
  {
    description: 'Pure sine core with low harmonics. Start here for sub basses, clean keys, and gentle modulation builds.',
    focus: 'Primary sine',
    id: 'foundation-sine-core',
    label: 'Foundation Sine Core',
    params: { attack: 0.006, cutoff: 1800, decay: 0.22, distortion: 0, release: 0.55, resonance: 1, sustain: 0.42 },
    source: { detune: 0, engine: 'synth', octaveShift: 0, portamento: 0, waveform: 'sine' },
    trackTypes: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  },
  {
    description: 'Triangle balance between clean and rich. Good all-purpose base for musical lines that need body without harshness.',
    focus: 'Primary triangle',
    id: 'foundation-triangle-core',
    label: 'Foundation Triangle Core',
    params: { attack: 0.008, cutoff: 2600, decay: 0.24, distortion: 0.02, release: 0.72, resonance: 1.1, sustain: 0.5 },
    source: { detune: 0, engine: 'synth', octaveShift: 0, portamento: 0.01, waveform: 'triangle' },
    trackTypes: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  },
  {
    description: 'Saw foundation with full harmonic stack. Ideal for bold leads, animated pads, and filter-driven motion design.',
    focus: 'Primary saw',
    id: 'foundation-saw-core',
    label: 'Foundation Saw Core',
    params: { attack: 0.01, cutoff: 3400, decay: 0.28, distortion: 0.06, release: 0.88, resonance: 1.25, sustain: 0.54 },
    source: { detune: 4, engine: 'synth', octaveShift: 0, portamento: 0.02, waveform: 'sawtooth' },
    trackTypes: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  },
  {
    description: 'Bright detuned saw with delay and air. Built for driving leads and hooks that cut over a four-on-the-floor groove.',
    focus: 'Driving lead',
    id: 'neon-drive',
    label: 'Neon Drive',
    params: { attack: 0.008, cutoff: 4200, decay: 0.3, delaySend: 0.2, distortion: 0.08, release: 0.5, resonance: 1.45, reverbSend: 0.16, sustain: 0.5, unison: 0.55 },
    source: { detune: 14, engine: 'synth', octaveShift: 0, portamento: 0, waveform: 'fatsawtooth' },
    trackTypes: ['lead', 'pluck', 'pad'],
  },
  {
    description: 'Tight, gritty sub with a fast decay. Punchy house and electronic low end that locks to the kick.',
    focus: 'Punchy club sub',
    id: 'pulse-sub',
    label: 'Pulse Sub',
    params: { attack: 0.004, cutoff: 1500, decay: 0.16, distortion: 0.12, release: 0.3, resonance: 1.5, sustain: 0.3 },
    source: { detune: 0, engine: 'synth', octaveShift: 0, portamento: 0.02, waveform: 'sawtooth' },
    trackTypes: ['bass'],
  },
  {
    description: 'Square-wave harmonic core for hollow, assertive tones. Useful for plucks, chiptone colors, and punchy rhythmic lines.',
    focus: 'Primary square',
    id: 'foundation-square-core',
    label: 'Foundation Square Core',
    params: { attack: 0.005, cutoff: 3000, decay: 0.2, distortion: 0.04, release: 0.5, resonance: 1.15, sustain: 0.36 },
    source: { detune: 0, engine: 'synth', octaveShift: 0, portamento: 0, waveform: 'square' },
    trackTypes: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  },
  {
    description: 'Noise-centric transient source for hats, snares, rises, and impact layers. Treat it as the fifth color for percussive design.',
    focus: 'Primary noise',
    id: 'foundation-noise-core',
    label: 'Foundation Noise Core',
    params: { attack: 0.002, cutoff: 5600, decay: 0.1, filterMode: 'highpass', release: 0.14, resonance: 1.8, sustain: 0.08 },
    source: { detune: 0, engine: 'sample', samplePlayback: 'oneshot', samplePreset: 'hat-air', sampleTriggerMode: 'full-source', waveform: 'square' },
    trackTypes: ['snare', 'hihat', 'fx', 'pluck'],
  },
  {
    description: 'Tighter low end and shorter body for kicks or bass lines that need to sit forward.',
    focus: 'Punch and control',
    id: 'tight-impact',
    label: 'Tight Impact',
    params: { attack: 0.004, cutoff: 1600, decay: 0.14, distortion: 0.08, release: 0.26, resonance: 1.3, sustain: 0.22 },
    source: { octaveShift: -1, samplePlayback: 'oneshot', waveform: 'sine' },
    trackTypes: ['kick', 'bass'],
  },
  {
    description: 'Sharper transient and brighter noise contour for snare, hat, or FX punctuation.',
    focus: 'Edge and bite',
    id: 'bright-snap',
    label: 'Bright Snap',
    params: { bitCrush: 0.12, cutoff: 4800, decay: 0.12, filterMode: 'highpass', release: 0.18, resonance: 1.9 },
    source: { detune: 8, samplePlayback: 'oneshot', sampleTriggerMode: 'step-mapped', waveform: 'square' },
    trackTypes: ['snare', 'hihat', 'fx'],
  },
  {
    description: 'More glide, midrange body, and motion for bass or melodic hooks that need to lead the phrase.',
    focus: 'Movement and phrasing',
    id: 'glide-current',
    label: 'Glide Current',
    params: { cutoff: 2200, delaySend: 0.16, release: 0.62, resonance: 1.4, vibratoDepth: 0.08, vibratoRate: 4.6 },
    source: { detune: 3, octaveShift: 0, portamento: 0.09, samplePlayback: 'pitched', waveform: 'sawtooth' },
    trackTypes: ['bass', 'lead', 'pluck'],
  },
  {
    description: 'Wide, airy sustain with softer tone shaping for pad beds and slower harmonic movement.',
    focus: 'Width and wash',
    id: 'air-canopy',
    label: 'Air Canopy',
    params: { attack: 0.26, chorusSend: 0.3, cutoff: 2600, delaySend: 0.18, reverbSend: 0.62, release: 3.2, sustain: 0.84, vibratoDepth: 0.04, vibratoRate: 2.8 },
    source: { portamento: 0.01, samplePlayback: 'pitched', waveform: 'triangle' },
    trackTypes: ['pad', 'lead'],
  },
  {
    description: 'Shorter envelope and brighter top for plucks, hats, and small rhythmic accents.',
    focus: 'Fast articulation',
    id: 'needle-pluck',
    label: 'Needle Pluck',
    params: { attack: 0.002, bitCrush: 0.04, cutoff: 4200, decay: 0.1, release: 0.18, sustain: 0.12 },
    source: { detune: 0, portamento: 0, samplePlayback: 'pitched', waveform: 'square' },
    trackTypes: ['pluck', 'hihat', 'lead'],
  },
  {
    description: 'Longer wash and more dramatic modulation for FX beds, transitions, and spacious hooks.',
    focus: 'Texture and lift',
    id: 'drift-bloom',
    label: 'Drift Bloom',
    params: { attack: 0.08, chorusSend: 0.24, cutoff: 3400, delaySend: 0.52, distortion: 0.08, reverbSend: 0.56, release: 1.9, vibratoDepth: 0.18, vibratoRate: 5.8 },
    source: { detune: 12, samplePlayback: 'oneshot', sampleTriggerMode: 'active-slice', waveform: 'sawtooth' },
    trackTypes: ['fx', 'pad', 'lead'],
  },
  {
    description: 'Slow attack, gentle saturation, and a chorused bed. Sits behind a vocal or a lead without crowding it.',
    focus: 'Tape-warmed pad',
    id: 'tape-warmth',
    label: 'Tape Warmth',
    params: { attack: 0.32, chorusSend: 0.38, cutoff: 2100, decay: 0.34, delaySend: 0.18, distortion: 0.16, release: 2.4, resonance: 1.05, reverbSend: 0.52, sustain: 0.78 },
    source: { detune: 5, octaveShift: 0, portamento: 0.04, samplePlayback: 'pitched', waveform: 'triangle' },
    trackTypes: ['pad', 'lead', 'fx'],
  },
  {
    description: 'Long bowed attack, breathing vibrato, and a sustained body for melodic lines that need expressive phrasing.',
    focus: 'Bowed ribbon',
    id: 'bowed-ribbon',
    label: 'Bowed Ribbon',
    params: { attack: 0.42, cutoff: 2800, decay: 0.5, delaySend: 0.22, release: 1.5, resonance: 1.4, reverbSend: 0.44, sustain: 0.82, vibratoDepth: 0.22, vibratoRate: 5.4 },
    source: { detune: 2, octaveShift: 0, portamento: 0.08, samplePlayback: 'pitched', waveform: 'sawtooth' },
    trackTypes: ['violin', 'lead', 'bass'],
  },
  {
    description: 'Sine fundamental with a thin bitcrushed top edge and a long reverb tail. Use it for bells, music boxes, and crystalline hooks.',
    focus: 'Glass bell shimmer',
    id: 'glass-bell',
    label: 'Glass Bell',
    params: { attack: 0.004, bitCrush: 0.08, cutoff: 5400, decay: 0.28, delaySend: 0.32, release: 2.6, resonance: 1.15, reverbSend: 0.62, sustain: 0.32 },
    source: { detune: 0, octaveShift: 1, portamento: 0, samplePlayback: 'pitched', waveform: 'sine' },
    trackTypes: ['bell', 'pluck', 'lead'],
  },
  {
    description: 'Quick attack, soft sustain, and a small slap delay. Reads as a hummed or whistled topline rather than a synth.',
    focus: 'Whistle breath',
    id: 'whistle-breath',
    label: 'Whistle Breath',
    params: { attack: 0.012, cutoff: 4400, decay: 0.22, delaySend: 0.28, release: 0.42, resonance: 1.2, reverbSend: 0.36, sustain: 0.46, vibratoDepth: 0.06, vibratoRate: 5.0 },
    source: { detune: 0, octaveShift: 0, portamento: 0.05, samplePlayback: 'pitched', waveform: 'sine' },
    trackTypes: ['lead', 'pluck'],
  },
  {
    description: 'Round low body with a soft transient and a tiny bit of grit. Sits forward in the mix without fighting the kick.',
    focus: 'Round sub bass',
    id: 'round-sub',
    label: 'Round Sub',
    params: { attack: 0.018, cutoff: 1100, decay: 0.22, distortion: 0.1, release: 0.42, resonance: 1.1, sustain: 0.7 },
    source: { detune: 0, octaveShift: -1, portamento: 0.02, samplePlayback: 'pitched', waveform: 'sine' },
    trackTypes: ['bass'],
  },
  {
    description: 'Short plucked strings with a woody snap and almost no tail. Bright and rhythmic, made for staccato lines and counter-melodies.',
    focus: 'Pizzicato strings',
    id: 'pizzicato-strings',
    label: 'Pizzicato Strings',
    params: { attack: 0.004, cutoff: 3200, decay: 0.16, delaySend: 0.12, release: 0.26, resonance: 1.25, reverbSend: 0.3, sustain: 0.12 },
    source: { detune: 4, octaveShift: 0, portamento: 0, samplePlayback: 'pitched', waveform: 'triangle' },
    trackTypes: ['violin', 'pluck', 'lead'],
  },
  {
    description: 'A wide string section: detuned unison, a slow swell, and a long hall tail. Fills the back of a cinematic mix with warmth.',
    focus: 'String ensemble',
    id: 'string-ensemble',
    label: 'String Ensemble',
    params: { attack: 0.34, chorusSend: 0.5, cutoff: 2600, decay: 0.5, delaySend: 0.16, release: 2.2, resonance: 1.1, reverbSend: 0.58, sustain: 0.86, vibratoDepth: 0.14, vibratoRate: 4.6 },
    source: { detune: 14, octaveShift: 0, portamento: 0.06, samplePlayback: 'pitched', waveform: 'sawtooth' },
    trackTypes: ['violin', 'pad', 'lead'],
  },
];

export const getTrackVoicePresetDefinitions = (trackType: InstrumentType) => (
  TRACK_VOICE_PRESET_DEFINITIONS.filter((preset) => preset.trackTypes.includes(trackType))
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampSampleEdge = (value: number, min: number, max: number) => clamp(value, min, max);

export const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const clampStepVelocity = (velocity: number) => clamp(velocity, 0.1, 1);
const clampStepGate = (gate: number) => clampNoteGate(clamp(gate, NOTE_GATE_MIN, NOTE_GATE_MAX));
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
    countInBars: 0,
    currentPattern: 0,
    metronomeEnabled: false,
    mode,
    patternCount,
    stepsPerPattern,
  };
  const tracks = trackOrder.map((type) => createTrack(type, {
    patternCount: transport.patternCount,
    stepsPerPattern: transport.stepsPerPattern,
  }));

  return {
    buildProject: (arrangerClips: ArrangementClip[], markers: SongMarker[] = []): Project => ({
      arrangerClips,
      bounceHistory: [],
      master: INITIAL_MASTER,
      masterSnapshots: [],
      markers,
      metadata: buildProjectMetadata(projectName),
      trackSnapshots: [],
      tracks,
      transport,
    }),
    tracks,
    transport,
  };
};

const normalizeSongMarkers = (
  input: unknown,
  fallbackMaxBeat: number,
): SongMarker[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((marker, index) => {
      if (!isRecord(marker)) {
        return null;
      }

      return {
        beat: clamp(
          typeof marker.beat === 'number' ? Math.round(marker.beat) : 0,
          0,
          Math.max(fallbackMaxBeat, 0),
        ),
        id: typeof marker.id === 'string' && marker.id ? marker.id : createId('marker'),
        name: typeof marker.name === 'string' && marker.name.trim()
          ? marker.name.trim().slice(0, 24)
          : `Marker ${index + 1}`,
      } satisfies SongMarker;
    })
    .filter((marker): marker is SongMarker => marker !== null)
    .sort((left, right) => left.beat - right.beat);
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
  || value === 'violin'
  || value === 'piano'
  || value === 'bell'
);

const OSCILLATOR_SHAPES: OscillatorShape[] = [
  'sine', 'triangle', 'sawtooth', 'square', 'pulse', 'pwm', 'fatsawtooth', 'fatsquare', 'fattriangle', 'fatsine',
];

const isOscillatorShape = (value: unknown): value is OscillatorShape => (
  typeof value === 'string' && (OSCILLATOR_SHAPES as string[]).includes(value)
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
    unison: clamp(typeof candidate.unison === 'number' ? candidate.unison : presetParams?.unison ?? INITIAL_PARAMS.unison, 0, 1),
    filterEnvAmount: clamp(typeof candidate.filterEnvAmount === 'number' ? candidate.filterEnvAmount : presetParams?.filterEnvAmount ?? INITIAL_PARAMS.filterEnvAmount, 0, 1),
    filterEnvDecay: clamp(typeof candidate.filterEnvDecay === 'number' ? candidate.filterEnvDecay : presetParams?.filterEnvDecay ?? INITIAL_PARAMS.filterEnvDecay, 0.01, 2),
    humanize: clamp(typeof candidate.humanize === 'number' ? candidate.humanize : presetParams?.humanize ?? INITIAL_PARAMS.humanize, 0, 1),
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
    const normalizedStepCount = Math.max(stepCount, rawPattern.length);
    const steps = Array.from({ length: normalizedStepCount }, (_, stepIndex) => {
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
    const normalizedStepCount = Math.max(stepCount, rawLevel.length, rawTone.length);
    const fallbackPattern = createAutomationPattern(normalizedStepCount);

    nextAutomation[patternIndex] = {
      level: Array.from({ length: normalizedStepCount }, (_, stepIndex) => clampAutomationValue(
        typeof rawLevel[stepIndex] === 'number'
          ? rawLevel[stepIndex]
          : fallbackPattern.level[stepIndex],
      )),
      tone: Array.from({ length: normalizedStepCount }, (_, stepIndex) => clampAutomationValue(
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
    countInBars: clamp(typeof candidate.countInBars === 'number' ? Math.round(candidate.countInBars) : 0, 0, 2),
    currentPattern: clamp(
      typeof candidate.currentPattern === 'number' ? Math.round(candidate.currentPattern) : 0,
      0,
      patternCount - 1,
    ),
    metronomeEnabled: candidate.metronomeEnabled === true,
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
    highCutHz: clamp(
      typeof candidate.highCutHz === 'number' ? candidate.highCutHz : INITIAL_MASTER.highCutHz,
      6000,
      20000,
    ),
    limiterCeiling: clamp(
      typeof candidate.limiterCeiling === 'number' ? candidate.limiterCeiling : INITIAL_MASTER.limiterCeiling,
      -1.2,
      0,
    ),
    lowCutHz: clamp(
      typeof candidate.lowCutHz === 'number' ? candidate.lowCutHz : INITIAL_MASTER.lowCutHz,
      20,
      240,
    ),
    outputGain: clamp(
      typeof candidate.outputGain === 'number' ? candidate.outputGain : INITIAL_MASTER.outputGain,
      -12,
      12,
    ),
    stereoWidth: clamp(
      typeof candidate.stereoWidth === 'number' ? candidate.stereoWidth : INITIAL_MASTER.stereoWidth,
      0,
      1,
    ),
    tone: clamp(
      typeof candidate.tone === 'number' ? candidate.tone : INITIAL_MASTER.tone,
      0,
      1,
    ),
  };
};

const normalizeMasterSnapshots = (input: unknown): MasterSnapshot[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((snapshot, index) => {
      if (!isRecord(snapshot)) {
        return null;
      }

      return {
        id: typeof snapshot.id === 'string' && snapshot.id ? snapshot.id : createId('master-snapshot'),
        name: typeof snapshot.name === 'string' && snapshot.name.trim()
          ? snapshot.name.trim().slice(0, 28)
          : `Snapshot ${index + 1}`,
        settings: normalizeMaster(snapshot.settings),
        updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString(),
      } satisfies MasterSnapshot;
    })
    .filter((snapshot): snapshot is MasterSnapshot => snapshot !== null)
    .slice(0, 8);
};

const normalizeTrackSnapshots = (input: unknown): TrackSnapshot[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((snapshot, index) => {
      if (!isRecord(snapshot)) {
        return null;
      }

      const trackType = isInstrumentType(snapshot.trackType) ? snapshot.trackType : 'lead';
      return {
        id: typeof snapshot.id === 'string' && snapshot.id ? snapshot.id : createId('track-snapshot'),
        name: typeof snapshot.name === 'string' && snapshot.name.trim()
          ? snapshot.name.trim().slice(0, 28)
          : `Sound ${index + 1}`,
        pan: clamp(typeof snapshot.pan === 'number' ? snapshot.pan : 0, -1, 1),
        params: normalizeParams(snapshot.params),
        source: normalizeSource(trackType, snapshot.source),
        trackType,
        updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString(),
        volume: clamp(typeof snapshot.volume === 'number' ? snapshot.volume : 0, -60, 6),
      } satisfies TrackSnapshot;
    })
    .filter((snapshot): snapshot is TrackSnapshot => snapshot !== null)
    .slice(-16);
};

const normalizeBounceHistory = (input: unknown): BounceHistoryEntry[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry): BounceHistoryEntry | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const mode = entry.mode === 'stems' ? 'stems' : entry.mode === 'mix' ? 'mix' : null;
      const scope = entry.scope === 'pattern'
        || entry.scope === 'song'
        || entry.scope === 'clip-window'
        || entry.scope === 'loop-window'
        ? entry.scope
        : null;
      const normalization = entry.normalization === 'peak'
        ? 'peak'
        : entry.normalization === 'none'
          ? 'none'
          : entry.normalization === 'target'
            ? 'target'
            : null;
      const tailMode = entry.tailMode === 'short'
        || entry.tailMode === 'standard'
        || entry.tailMode === 'long'
        ? entry.tailMode
        : null;

      if (!mode || !scope || !normalization || !tailMode) {
        return null;
      }

      return {
        crestDb: typeof entry.crestDb === 'number' ? clamp(entry.crestDb, 0, 48) : undefined,
        durationSeconds: typeof entry.durationSeconds === 'number' ? clamp(entry.durationSeconds, 0, 7200) : undefined,
        estimatedLufs: typeof entry.estimatedLufs === 'number' ? clamp(entry.estimatedLufs, -96, 3) : undefined,
        exportedAt: typeof entry.exportedAt === 'string' ? entry.exportedAt : new Date().toISOString(),
        id: typeof entry.id === 'string' && entry.id ? entry.id : createId('bounce-history'),
        label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim().slice(0, 40) : 'Reference print',
        masterSnapshotName: typeof entry.masterSnapshotName === 'string' && entry.masterSnapshotName.trim()
          ? entry.masterSnapshotName.trim().slice(0, 28)
          : null,
        mode,
        normalization,
        peakDb: typeof entry.peakDb === 'number' ? clamp(entry.peakDb, -96, 3) : undefined,
        quality: entry.quality === 'clean' || entry.quality === 'hot' || entry.quality === 'quiet' || entry.quality === 'silent' ? entry.quality : undefined,
        recommendation: typeof entry.recommendation === 'string' && entry.recommendation.trim()
          ? entry.recommendation.trim().slice(0, 180)
          : undefined,
        rmsDb: typeof entry.rmsDb === 'number' ? clamp(entry.rmsDb, -96, 0) : undefined,
        sampleRate: typeof entry.sampleRate === 'number' ? clamp(Math.round(entry.sampleRate), 8000, 192000) : undefined,
        scope,
        tailMode,
        targetDeltaDb: typeof entry.targetDeltaDb === 'number' ? clamp(entry.targetDeltaDb, -24, 24) : undefined,
        targetLabel: typeof entry.targetLabel === 'string' && entry.targetLabel.trim()
          ? entry.targetLabel.trim().slice(0, 20)
          : undefined,
        targetLufs: typeof entry.targetLufs === 'number' ? clamp(entry.targetLufs, -96, 0) : undefined,
        targetLufsDelta: typeof entry.targetLufsDelta === 'number' ? clamp(entry.targetLufsDelta, -24, 24) : undefined,
        targetProfileId: entry.targetProfileId === 'draft'
          || entry.targetProfileId === 'streaming'
          || entry.targetProfileId === 'club'
          || entry.targetProfileId === 'open'
          ? entry.targetProfileId
          : undefined,
        targetVerdict: entry.targetVerdict === 'aligned'
          || entry.targetVerdict === 'loud'
          || entry.targetVerdict === 'soft'
          || entry.targetVerdict === 'flat'
          || entry.targetVerdict === 'spiky'
          ? entry.targetVerdict
          : undefined,
      } satisfies BounceHistoryEntry;
    })
    .filter((entry): entry is BounceHistoryEntry => entry !== null)
    .slice(-12)
    .reverse();
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
          99999,
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
          MAX_ARRANGER_BEAT_POSITION,
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
  beatLength: clamp(Math.round(options.beatLength ?? transport.stepsPerPattern), 4, MAX_ARRANGER_BEAT_POSITION),
  id: options.id ?? createId('clip'),
  patternIndex: clamp(Math.round(options.patternIndex ?? transport.currentPattern), 0, transport.patternCount - 1),
  startBeat: clamp(Math.round(options.startBeat ?? 0), 0, MAX_ARRANGER_BEAT_POSITION),
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
    const sourceAutomation = track.automation?.[patternIndex] ?? createAutomationPattern(stepsPerPattern);
    const preservedStepCount = Math.max(
      stepsPerPattern,
      sourceSteps.length,
      sourceAutomation.level.length,
      sourceAutomation.tone.length,
    );

    patterns[patternIndex] = Array.from({ length: preservedStepCount }, (_, stepIndex) => {
    const value = sourceSteps[stepIndex];
      return Array.isArray(value) ? cloneStep(value) : [];
    });
    automation[patternIndex] = {
      level: Array.from({ length: preservedStepCount }, (_, stepIndex) => clampAutomationValue(sourceAutomation.level[stepIndex] ?? 0.5)),
      tone: Array.from({ length: preservedStepCount }, (_, stepIndex) => clampAutomationValue(sourceAutomation.tone[stepIndex] ?? 0.5)),
    };
  }

  return {
    automation,
    ...track,
    patterns,
  };
};

export const createNightTransitProject = (projectName: string = 'Night Transit'): Project => {
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

  putStep(snareTrack, 0, 4, 'C1', { velocity: 0.76 });
  putStep(snareTrack, 0, 10, 'C1', { velocity: 0.38 });
  putStep(snareTrack, 0, 12, 'C1', { velocity: 0.88 });
  putStep(snareTrack, 1, 4, 'C1', { velocity: 0.78 });
  putStep(snareTrack, 1, 10, 'C1', { velocity: 0.52 });
  putStep(snareTrack, 1, 12, 'C1', { velocity: 0.9 });
  putStep(snareTrack, 2, 4, 'C1', { velocity: 0.8 });
  putStep(snareTrack, 2, 11, 'C1', { velocity: 0.44 });
  putStep(snareTrack, 2, 12, 'C1', { velocity: 0.9 });

  for (const step of [2, 6, 10, 14]) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.42, velocity: step === 14 ? 0.62 : 0.54 });
  }
  putStep(hihatTrack, 0, 15, 'C1', { gate: 0.78, velocity: 0.48 });
  [1, 3, 5, 7, 9, 11, 13, 15].forEach((step, index) => {
    putStep(hihatTrack, 1, step, 'C1', { gate: step === 15 ? 0.72 : 0.46, velocity: index % 2 === 0 ? 0.46 : 0.58 });
  });
  for (const step of [0, 2, 3, 6, 8, 9, 11, 12, 14, 15]) {
    putStep(hihatTrack, 2, step, 'C1', {
      gate: step === 15 ? 0.8 : 0.38,
      velocity: [3, 9, 15].includes(step) ? 0.6 : [0, 8, 12].includes(step) ? 0.5 : 0.42,
    });
  }

  putStep(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.8 });
  putStep(bassTrack, 0, 4, 'G1', { gate: 1.1, velocity: 0.66 });
  putStep(bassTrack, 0, 8, 'D#2', { gate: 1.25, velocity: 0.76 });
  putStep(bassTrack, 0, 12, 'C2', { gate: 1.5, velocity: 0.72 });
  putStep(bassTrack, 1, 0, 'A#1', { gate: 1.5, velocity: 0.78 });
  putStep(bassTrack, 1, 4, 'F2', { gate: 1.25, velocity: 0.72 });
  putStep(bassTrack, 1, 8, 'D2', { gate: 1.25, velocity: 0.74 });
  putStep(bassTrack, 1, 12, 'G1', { gate: 1.4, velocity: 0.7 });
  putStep(bassTrack, 2, 0, 'F1', { gate: 1.75, velocity: 0.82 });
  putStep(bassTrack, 2, 4, 'C2', { gate: 1.2, velocity: 0.72 });
  putStep(bassTrack, 2, 8, 'G1', { gate: 1.5, velocity: 0.78 });
  putStep(bassTrack, 2, 12, 'D2', { gate: 1.25, velocity: 0.74 });

  putStep(leadTrack, 0, 0, 'C5', { gate: 1, velocity: 0.84 });
  putStep(leadTrack, 0, 3, 'D#5', { gate: 0.9, velocity: 0.76 });
  putStep(leadTrack, 0, 8, 'D5', { gate: 1.25, velocity: 0.82 });
  putStep(leadTrack, 0, 11, 'A#4', { gate: 1, velocity: 0.78 });
  putStep(leadTrack, 0, 14, 'C5', { gate: 1.2, velocity: 0.78 });
  putStep(leadTrack, 1, 0, 'D#5', { gate: 1, velocity: 0.84 });
  putStep(leadTrack, 1, 4, 'F5', { gate: 1.1, velocity: 0.8 });
  putStep(leadTrack, 1, 8, 'G5', { gate: 1.1, velocity: 0.88 });
  putStep(leadTrack, 1, 12, 'D5', { gate: 1, velocity: 0.74 });
  putStep(leadTrack, 1, 15, 'A#4', { gate: 0.85, velocity: 0.72 });
  putStep(leadTrack, 2, 2, 'F4', { gate: 1, velocity: 0.74 });
  putStep(leadTrack, 2, 6, 'G4', { gate: 1, velocity: 0.78 });
  putStep(leadTrack, 2, 10, 'A#4', { gate: 1, velocity: 0.84 });
  putStep(leadTrack, 2, 12, 'C5', { gate: 1, velocity: 0.86 });
  putStep(leadTrack, 2, 15, 'D5', { gate: 0.9, velocity: 0.8 });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.62 } },
    { note: 'D#4', options: { gate: 2.5, velocity: 0.56 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.58 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'G3', options: { gate: 2.25, velocity: 0.54 } },
    { note: 'A#3', options: { gate: 2.25, velocity: 0.5 } },
    { note: 'D4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A#3', options: { gate: 2.25, velocity: 0.56 } },
    { note: 'D4', options: { gate: 2.25, velocity: 0.54 } },
    { note: 'F4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.56 } },
    { note: 'D#4', options: { gate: 2.5, velocity: 0.5 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 1, 0, [
    { note: 'A#3', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'D4', options: { gate: 2.5, velocity: 0.54 } },
    { note: 'F4', options: { gate: 2.5, velocity: 0.56 } },
  ]);
  stackStep(padTrack, 1, 4, [
    { note: 'F3', options: { gate: 2.25, velocity: 0.56 } },
    { note: 'A3', options: { gate: 2.25, velocity: 0.5 } },
    { note: 'C4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 1, 8, [
    { note: 'D#4', options: { gate: 2.25, velocity: 0.58 } },
    { note: 'G4', options: { gate: 2.25, velocity: 0.52 } },
    { note: 'A#4', options: { gate: 2.25, velocity: 0.54 } },
  ]);
  stackStep(padTrack, 1, 12, [
    { note: 'G3', options: { gate: 2.25, velocity: 0.54 } },
    { note: 'A#3', options: { gate: 2.25, velocity: 0.5 } },
    { note: 'D4', options: { gate: 2.25, velocity: 0.52 } },
  ]);
  stackStep(padTrack, 2, 0, [
    { note: 'F3', options: { gate: 3, velocity: 0.62 } },
    { note: 'G#3', options: { gate: 3, velocity: 0.56 } },
    { note: 'C4', options: { gate: 3, velocity: 0.58 } },
  ]);
  stackStep(padTrack, 2, 4, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.58 } },
    { note: 'D#4', options: { gate: 2.5, velocity: 0.54 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.56 } },
  ]);
  stackStep(padTrack, 2, 8, [
    { note: 'G3', options: { gate: 3, velocity: 0.58 } },
    { note: 'A#3', options: { gate: 3, velocity: 0.54 } },
    { note: 'D4', options: { gate: 3, velocity: 0.56 } },
  ]);
  stackStep(padTrack, 2, 12, [
    { note: 'A#3', options: { gate: 2.5, velocity: 0.56 } },
    { note: 'D4', options: { gate: 2.5, velocity: 0.52 } },
    { note: 'F4', options: { gate: 2.5, velocity: 0.54 } },
  ]);

  kickTrack.source.samplePlayback = 'oneshot';
  snareTrack.source.samplePlayback = 'oneshot';
  hihatTrack.source.samplePlayback = 'oneshot';
  bassTrack.params.cutoff = 1840;
  bassTrack.params.distortion = 0.1;
  bassTrack.params.release = 0.42;
  bassTrack.source.portamento = 0.04;
  leadTrack.params.delaySend = 0.34;
  leadTrack.params.reverbSend = 0.28;
  leadTrack.params.chorusSend = 0.16;
  leadTrack.source.portamento = 0.07;
  leadTrack.source.waveform = 'sawtooth';
  padTrack.params.reverbSend = 0.58;
  padTrack.params.delaySend = 0.22;
  padTrack.params.chorusSend = 0.28;

  // A fuller arc that reuses the three patterns as a journey rather than a
  // single pass: the groove eases in, builds, drives, pulls back for a breath,
  // hits its peak, then lands. Roughly twice the length of the old loop, so
  // Night Transit reads as a proper medium-length scene next to the long
  // Pulse Rider and the short one-bar loops.
  const nightTransitTracks = [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack];
  const nightTransitSections: Array<{ start: number; pattern: number; name: string }> = [
    { start: 0, pattern: 0, name: 'Intro' },
    { start: 16, pattern: 1, name: 'Lift' },
    { start: 32, pattern: 2, name: 'Drive' },
    { start: 48, pattern: 0, name: 'Breath' },
    { start: 64, pattern: 2, name: 'Peak' },
    { start: 80, pattern: 0, name: 'Outro' },
  ];
  const outroStart = nightTransitSections[nightTransitSections.length - 1].start;
  const nightTransitClips = nightTransitSections.flatMap((section) => (
    nightTransitTracks.flatMap((track) => {
      // Keep the original intro nuance: the lead drifts in halfway through bar one.
      if (section.start === 0 && track === leadTrack) {
        return [createArrangerClip(track.id, transport, { beatLength: 8, patternIndex: 0, startBeat: 8 })];
      }
      // Let the outro breathe: drop the hi-hat in the final section so the piece
      // lands on the resolved chord instead of ticking out at full density.
      if (section.start === outroStart && track === hihatTrack) {
        return [];
      }
      return [createArrangerClip(track.id, transport, { beatLength: 16, patternIndex: section.pattern, startBeat: section.start })];
    })
  ));
  return buildProject(
    nightTransitClips,
    nightTransitSections.map((section) => ({ beat: section.start, id: createId('marker'), name: section.name })),
  );
};

export const createBlankProject = (projectName: string = 'Blank Grid'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 120,
    mode: 'PATTERN',
    trackOrder: BLANK_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack] = tracks;

  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.9 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.86 });
  putStep(snareTrack, 0, 4, 'C1', { velocity: 0.72 });
  putStep(snareTrack, 0, 12, 'C1', { velocity: 0.8 });
  for (const step of [2, 6, 10, 14]) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.38, velocity: step === 14 ? 0.6 : 0.48 });
  }
  putStep(bassTrack, 0, 0, 'C2', { gate: 1.5, velocity: 0.72 });
  putStep(leadTrack, 0, 8, 'G4', { gate: 1, velocity: 0.74 });
  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.38 } },
    { note: 'G4', options: { gate: 4, velocity: 0.34 } },
    { note: 'A#4', options: { gate: 4, velocity: 0.32 } },
  ]);

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
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
  ], [
    { beat: 0, id: createId('marker'), name: 'Drop seed' },
    { beat: 16, id: createId('marker'), name: 'Variation' },
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
  ], [
    { beat: 0, id: createId('marker'), name: 'Bloom' },
    { beat: 16, id: createId('marker'), name: 'Drift' },
  ]);
};

export const createLoFiSundayProject = (projectName: string = 'Lo-Fi Sunday'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 78,
    mode: 'SONG',
    trackOrder: LOFI_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, padTrack, leadTrack] = tracks;

  for (const step of [0, 7, 10]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: step === 0 ? 0.92 : 0.74 });
  }
  for (const step of [4, 12]) {
    putStep(snareTrack, 0, step, 'C1', { velocity: 0.7 });
  }
  for (let step = 0; step < 16; step += 2) {
    const isOff = step % 4 === 2;
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.4, velocity: isOff ? 0.42 : 0.58 });
  }
  putStep(bassTrack, 0, 0, 'C2', { gate: 2.5, velocity: 0.68 });
  putStep(bassTrack, 0, 6, 'A1', { gate: 1.5, velocity: 0.62 });
  putStep(bassTrack, 0, 10, 'F1', { gate: 2, velocity: 0.62 });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.42 } },
    { note: 'E4', options: { gate: 4, velocity: 0.38 } },
    { note: 'G4', options: { gate: 4, velocity: 0.38 } },
    { note: 'B4', options: { gate: 4, velocity: 0.34 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A3', options: { gate: 4, velocity: 0.42 } },
    { note: 'C4', options: { gate: 4, velocity: 0.4 } },
    { note: 'E4', options: { gate: 4, velocity: 0.36 } },
    { note: 'G4', options: { gate: 4, velocity: 0.34 } },
  ]);

  putStep(leadTrack, 0, 4, 'E5', { gate: 1, velocity: 0.6 });
  putStep(leadTrack, 0, 11, 'D5', { gate: 1.25, velocity: 0.58 });
  putStep(leadTrack, 0, 14, 'G4', { gate: 1.5, velocity: 0.54 });

  padTrack.params.reverbSend = 0.52;
  padTrack.params.delaySend = 0.22;
  padTrack.params.chorusSend = 0.28;
  leadTrack.params.reverbSend = 0.46;
  leadTrack.params.delaySend = 0.36;
  hihatTrack.source.engine = 'sample';
  hihatTrack.source.samplePlayback = 'oneshot';
  hihatTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Sunday loop' },
  ]);
};

export const createSynthwaveDriveProject = (projectName: string = 'Synthwave Drive'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 108,
    mode: 'SONG',
    trackOrder: SYNTHWAVE_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack] = tracks;

  for (const step of [0, 4, 8, 12]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: 0.94 });
  }
  for (const step of [4, 12]) {
    putStep(snareTrack, 0, step, 'C1', { velocity: 0.82 });
  }
  for (let step = 0; step < 16; step += 1) {
    if (step % 4 === 0) continue;
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.35, velocity: step % 2 === 0 ? 0.55 : 0.42 });
  }

  const bassPattern = ['C2', 'C2', 'G2', 'C2', 'A1', 'A1', 'E2', 'A1', 'F2', 'F2', 'C3', 'F2', 'G2', 'G2', 'D3', 'G2'];
  bassPattern.forEach((note, step) => {
    putStep(bassTrack, 0, step, note, { gate: 0.85, velocity: step % 4 === 0 ? 0.82 : 0.66 });
  });

  const leadPattern = [
    { step: 0, note: 'E5' },
    { step: 2, note: 'G5' },
    { step: 4, note: 'B5' },
    { step: 6, note: 'A5' },
    { step: 8, note: 'G5' },
    { step: 10, note: 'E5' },
    { step: 12, note: 'D5' },
    { step: 14, note: 'C5' },
  ];
  leadPattern.forEach(({ step, note }) => {
    putStep(leadTrack, 0, step, note, { gate: 1.25, velocity: 0.7 });
  });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.4 } },
    { note: 'G4', options: { gate: 4, velocity: 0.36 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A3', options: { gate: 4, velocity: 0.4 } },
    { note: 'E4', options: { gate: 4, velocity: 0.36 } },
  ]);

  leadTrack.params.delaySend = 0.46;
  leadTrack.params.reverbSend = 0.36;
  leadTrack.params.chorusSend = 0.24;
  padTrack.params.reverbSend = 0.58;
  padTrack.params.chorusSend = 0.32;

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Drive' },
  ]);
};

export const createClubHorizonProject = (projectName: string = 'Club Horizon'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 122,
    mode: 'SONG',
    trackOrder: CLUB_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, pluckTrack, padTrack, fxTrack] = tracks;

  for (const step of [0, 4, 8, 12]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: step === 0 || step === 8 ? 0.96 : 0.88 });
    putStep(kickTrack, 1, step, 'C1', { velocity: step === 0 || step === 8 ? 0.98 : 0.9 });
  }
  for (const step of [4, 12]) {
    putStep(snareTrack, 0, step, 'C1', { velocity: 0.82 });
    putStep(snareTrack, 1, step, 'C1', { velocity: 0.86 });
  }
  putStep(snareTrack, 1, 15, 'C1', { velocity: 0.42 });

  for (const [index, step] of [2, 6, 10, 14].entries()) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.34, velocity: index % 2 === 0 ? 0.5 : 0.62 });
  }
  for (const [index, step] of [1, 3, 5, 7, 9, 11, 13, 15].entries()) {
    putStep(hihatTrack, 1, step, 'C1', { gate: 0.32, velocity: index % 2 === 0 ? 0.44 : 0.58 });
  }

  const bassPatternA = [
    { note: 'C2', step: 0 },
    { note: 'G1', step: 4 },
    { note: 'A#1', step: 8 },
    { note: 'F1', step: 12 },
  ];
  const bassPatternB = [
    { note: 'C2', step: 0 },
    { note: 'D#2', step: 4 },
    { note: 'F1', step: 8 },
    { note: 'G1', step: 12 },
  ];
  bassPatternA.forEach(({ note, step }) => {
    putStep(bassTrack, 0, step, note, { gate: 1.25, velocity: 0.76 });
  });
  bassPatternB.forEach(({ note, step }) => {
    putStep(bassTrack, 1, step, note, { gate: 1.2, velocity: 0.8 });
  });

  [
    { note: 'C5', step: 2 },
    { note: 'G4', step: 6 },
    { note: 'A#4', step: 10 },
    { note: 'G4', step: 14 },
  ].forEach(({ note, step }) => {
    putStep(pluckTrack, 0, step, note, { gate: 0.88, velocity: 0.72 });
  });
  [
    { note: 'D5', step: 0 },
    { note: 'F5', step: 4 },
    { note: 'G5', step: 8 },
    { note: 'F5', step: 12 },
  ].forEach(({ note, step }) => {
    putStep(pluckTrack, 1, step, note, { gate: 0.84, velocity: 0.74 });
  });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.34 } },
    { note: 'G4', options: { gate: 4, velocity: 0.3 } },
    { note: 'A#4', options: { gate: 4, velocity: 0.28 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A#3', options: { gate: 4, velocity: 0.32 } },
    { note: 'D4', options: { gate: 4, velocity: 0.3 } },
    { note: 'F4', options: { gate: 4, velocity: 0.28 } },
  ]);
  stackStep(padTrack, 1, 0, [
    { note: 'F3', options: { gate: 4, velocity: 0.34 } },
    { note: 'C4', options: { gate: 4, velocity: 0.32 } },
    { note: 'G4', options: { gate: 4, velocity: 0.28 } },
  ]);
  stackStep(padTrack, 1, 8, [
    { note: 'G3', options: { gate: 4, velocity: 0.34 } },
    { note: 'D4', options: { gate: 4, velocity: 0.3 } },
    { note: 'A#4', options: { gate: 4, velocity: 0.28 } },
  ]);

  putStep(fxTrack, 1, 12, 'C5', { gate: 2, velocity: 0.64 });

  pluckTrack.params.delaySend = 0.24;
  pluckTrack.params.reverbSend = 0.18;
  padTrack.params.reverbSend = 0.54;
  padTrack.params.chorusSend = 0.22;
  fxTrack.source.engine = 'sample';
  fxTrack.source.samplePlayback = 'oneshot';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(fxTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Warm up' },
    { beat: 16, id: createId('marker'), name: 'Lift' },
  ]);
};

// Driving four-on-the-floor groove in E major at 125 BPM, recreated from a
// reference track. The original's intro wandered, so this opens with a clean
// pad-and-hats build that drops into the main beat, then lifts.
export const createPulseRiderProject = (projectName: string = 'Pulse Rider'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 125,
    mode: 'SONG',
    patternCount: 7,
    trackOrder: PULSE_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack, fxTrack] = tracks;

  // Match the reference timbre with the voices authored for this sound.
  applyVoicePresetById(leadTrack, 'neon-drive');
  applyVoicePresetById(bassTrack, 'pulse-sub');

  // Sustained pad chords (E - B - C#m - G#m), reused across patterns. This I-V-vi-iii
  // progression matches the reference's harmony: E is home, and the B and G#m chords
  // carry the prominent D#/F# the reference leans on. (Its earlier A chord was the one
  // chord the reference barely touches, so it is gone.)
  const padChords = [
    { step: 0, notes: ['E3', 'G#3', 'B3'] },   // E  (I)
    { step: 4, notes: ['B2', 'D#3', 'F#3'] },  // B  (V)
    { step: 8, notes: ['C#3', 'E3', 'G#3'] },  // C#m (vi)
    { step: 12, notes: ['G#2', 'B2', 'D#3'] }, // G#m (iii)
  ];
  // The intro and build lean into the relative minor (C#m), then lift up to E so
  // the drop lands bright. This mirrors the reference's dark-to-bright arc: its
  // intro sits on D#/F#/C#/G# and only resolves to E major when the beat drops.
  const introChords = [
    { step: 0, notes: ['C#3', 'E3', 'G#3'] },  // C#m (vi)
    { step: 4, notes: ['G#2', 'B2', 'D#3'] },  // G#m (iii)
    { step: 8, notes: ['B2', 'D#3', 'F#3'] },  // B  (V)
    { step: 12, notes: ['E3', 'G#3', 'B3'] },  // E  (I) - lifts toward the drop
  ];
  const bassMain = [
    { root: 'E2', steps: [0, 2], pass: { note: 'B1', step: 3 } },
    { root: 'B1', steps: [4, 6], pass: { note: 'F#2', step: 7 } },
    { root: 'C#2', steps: [8, 10], pass: { note: 'G#1', step: 11 } },
    { root: 'G#1', steps: [12, 14], pass: { note: 'D#2', step: 15 } },
  ];
  type LeadNote = { note: string; step: number; gate?: number; velocity?: number };

  // Per-part layer helpers, so the six patterns stay short and consistent.
  const layPad = (p: number, velocity: number, chords = padChords) => chords.forEach(({ step, notes }) => {
    stackStep(padTrack, p, step, notes.map((note) => ({ note, options: { gate: 4, velocity } })));
  });
  const layBusyHats = (p: number, lift: number) => {
    // Open hats on the offbeat 8ths give the four-on-the-floor its house "skip";
    // the closed 16th fills sit tight and quiet underneath them.
    for (const step of [2, 6, 10, 14]) putStep(hihatTrack, p, step, 'E1', { gate: 1.4, velocity: 0.6 + lift });
    for (const [i, step] of [1, 3, 5, 7, 9, 11, 13, 15].entries()) {
      putStep(hihatTrack, p, step, 'E1', { gate: 0.2, velocity: (i % 2 === 0 ? 0.36 : 0.46) + lift });
    }
  };
  const layKick = (p: number, hot = 0) => {
    for (const step of [0, 4, 8, 12]) putStep(kickTrack, p, step, 'E1', { velocity: (step % 8 === 0 ? 0.97 : 0.9) + hot });
  };
  const layClap = (p: number, ghost = false) => {
    for (const step of [4, 12]) putStep(snareTrack, p, step, 'E1', { velocity: 0.84 });
    if (ghost) putStep(snareTrack, p, 14, 'E1', { velocity: 0.44 });
  };
  const layMainBass = (p: number) => bassMain.forEach(({ root, steps, pass }) => {
    steps.forEach((step) => putStep(bassTrack, p, step, root, { gate: 0.45, velocity: 0.82 }));
    putStep(bassTrack, p, pass.step, pass.note, { gate: 0.4, velocity: 0.64 });
  });
  const layRollBass = (p: number) => [{ note: 'E2', at: 0 }, { note: 'B1', at: 4 }, { note: 'C#2', at: 8 }, { note: 'G#1', at: 12 }].forEach(({ note, at }) => {
    [at, at + 1, at + 2, at + 3].forEach((step) => putStep(bassTrack, p, step, note, { gate: 0.3, velocity: 0.82 }));
  });
  const layLead = (p: number, notes: LeadNote[], velocity = 0.74) => notes.forEach((entry) => {
    putStep(leadTrack, p, entry.step, entry.note, { gate: entry.gate ?? 0.7, velocity: entry.velocity ?? velocity });
  });

  const hookBase: LeadNote[] = [
    { note: 'E4', step: 0 }, { note: 'B4', step: 3 }, { note: 'G#4', step: 6 },
    { note: 'C#5', step: 8 }, { note: 'B4', step: 10 }, { note: 'G#4', step: 12 }, { note: 'F#4', step: 14 },
  ];
  const hookHigh: LeadNote[] = [
    { note: 'E5', step: 0 }, { note: 'B5', step: 3 }, { note: 'G#5', step: 6 }, { note: 'C#6', step: 8 },
    { note: 'B5', step: 10 }, { note: 'G#5', step: 12 }, { note: 'E5', step: 14 }, { note: 'F#5', step: 15 },
  ];
  const hookVar: LeadNote[] = [
    { note: 'G#4', step: 0 }, { note: 'E4', step: 2 }, { note: 'B4', step: 4 }, { note: 'C#5', step: 7 },
    { note: 'B4', step: 8 }, { note: 'A4', step: 10 }, { note: 'G#4', step: 12 }, { note: 'F#4', step: 15 },
  ];

  // Pattern 0 - main groove.
  layKick(0); layClap(0); layBusyHats(0, 0); layMainBass(0); layLead(0, hookBase); layPad(0, 0.32);
  putStep(fxTrack, 0, 12, 'E5', { gate: 2, velocity: 0.5 });

  // Pattern 1 - lift (fuller, rolling bass, lead up an octave).
  layKick(1, 0.02); layClap(1, true); layBusyHats(1, 0.04); layRollBass(1); layLead(1, hookHigh, 0.76); layPad(1, 0.34);
  putStep(fxTrack, 1, 0, 'E5', { gate: 2, velocity: 0.6 });
  putStep(fxTrack, 1, 12, 'B4', { gate: 2, velocity: 0.56 });

  // Pattern 2 - clean build/intro (no kick): darker C#m-leaning pad, pulsing sub, light hats, pickup, riser.
  layPad(2, 0.5, introChords);
  for (const [i, step] of [2, 6, 10, 14].entries()) putStep(hihatTrack, 2, step, 'E1', { gate: 0.3, velocity: 0.46 + i * 0.04 });
  [{ note: 'C#2', step: 0 }, { note: 'G#1', step: 4 }, { note: 'B1', step: 8 }, { note: 'E2', step: 12 }, { note: 'E2', step: 14 }].forEach(({ note, step }) => {
    putStep(bassTrack, 2, step, note, { gate: 0.7, velocity: 0.66 });
  });
  layLead(2, [{ note: 'B4', step: 12, gate: 0.5, velocity: 0.6 }, { note: 'C#5', step: 14, gate: 0.5, velocity: 0.68 }]);
  putStep(fxTrack, 2, 8, 'E4', { gate: 4, velocity: 0.52 });

  // Pattern 3 - breakdown: just pad, an emotive lead, and soft hats. No kick or bass.
  layPad(3, 0.46);
  for (const step of [2, 6, 10, 14]) putStep(hihatTrack, 3, step, 'E1', { gate: 0.3, velocity: 0.34 });
  layLead(3, [
    { note: 'E5', step: 0, gate: 3, velocity: 0.6 },
    { note: 'B4', step: 6, gate: 2, velocity: 0.54 },
    { note: 'G#5', step: 10, gate: 2.5, velocity: 0.6 },
  ]);
  putStep(fxTrack, 3, 0, 'E5', { gate: 4, velocity: 0.4 });

  // Pattern 4 - peak (busiest): rolling bass, lead up high with extra accents, more FX.
  layKick(4, 0.02); layClap(4, true); layBusyHats(4, 0.08); layRollBass(4);
  layLead(4, [...hookHigh, { note: 'B5', step: 1, velocity: 0.6 }, { note: 'C#6', step: 5, velocity: 0.6 }], 0.78);
  layPad(4, 0.36);
  putStep(fxTrack, 4, 0, 'E5', { gate: 2, velocity: 0.62 });
  putStep(fxTrack, 4, 8, 'B4', { gate: 2, velocity: 0.5 });
  putStep(fxTrack, 4, 12, 'E5', { gate: 2, velocity: 0.56 });

  // Pattern 5 - main variation: same drive, a different lead phrase.
  layKick(5); layClap(5); layBusyHats(5, 0); layMainBass(5); layLead(5, hookVar); layPad(5, 0.32);
  putStep(fxTrack, 5, 12, 'C#5', { gate: 2, velocity: 0.5 });

  // Pattern 6 - final climax (biggest): rolling bass, the supersaw lead up top
  // with extra accents, fullest hats and FX. The back-third payoff.
  layKick(6, 0.03); layClap(6, true); layBusyHats(6, 0.1); layRollBass(6);
  layLead(6, [...hookHigh, { note: 'E6', step: 1, velocity: 0.6 }, { note: 'G#5', step: 9, velocity: 0.62 }], 0.8);
  layPad(6, 0.4);
  putStep(fxTrack, 6, 0, 'E5', { gate: 2, velocity: 0.66 });
  putStep(fxTrack, 6, 4, 'B4', { gate: 2, velocity: 0.5 });
  putStep(fxTrack, 6, 8, 'E5', { gate: 2, velocity: 0.58 });
  putStep(fxTrack, 6, 12, 'G#5', { gate: 2, velocity: 0.56 });

  padTrack.params.reverbSend = 0.5;
  padTrack.params.chorusSend = 0.22;
  // A little room on the clap so the backbeat sits in space instead of dead center.
  snareTrack.params.reverbSend = 0.16;
  fxTrack.source.engine = 'sample';
  fxTrack.source.samplePlayback = 'oneshot';

  // Full-length arrangement (~92 bars, ~2:57) following the reference's
  // dark-to-bright arc and its late, biggest peak. Declared once as ordered
  // sections; arrangeSections derives the clips and timeline markers from this
  // single list, so the two can never drift apart. Each clip loops its 16-step
  // pattern across the section length.
  const full = [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack, fxTrack];
  const ambient = [padTrack, leadTrack, hihatTrack, fxTrack];
  const lift = [padTrack, bassTrack, hihatTrack, leadTrack, fxTrack];
  const { clips, markers } = arrangeSections(transport, [
    { name: 'Intro', bars: 8, pattern: 2, lanes: [padTrack, bassTrack, hihatTrack] },
    { name: 'Build', bars: 8, pattern: 2, lanes: lift },
    { name: 'Drop', bars: 8, pattern: 0, lanes: full },
    { name: 'Drop B', bars: 8, pattern: 5, lanes: full },
    { name: 'Breakdown', bars: 8, pattern: 3, lanes: ambient },
    { name: 'Rebuild', bars: 4, pattern: 2, lanes: lift },
    { name: 'Peak', bars: 8, pattern: 1, lanes: full },
    { name: 'Peak B', bars: 8, pattern: 4, lanes: full },
    { name: 'Bridge', bars: 8, pattern: 3, lanes: [...ambient, bassTrack] },
    { name: 'Re-lift', bars: 4, pattern: 2, lanes: lift },
    { name: 'Climax', bars: 12, pattern: 6, lanes: full },
    { name: 'Outro', bars: 8, pattern: 2, lanes: [padTrack, bassTrack] },
  ]);

  return buildProject(clips, markers);
};

export const createStarlightParadeProject = (projectName: string = 'Starlight Parade'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 110,
    mode: 'SONG',
    trackOrder: STARLIGHT_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hihatTrack, bassTrack, leadTrack, padTrack, pluckTrack] = tracks;

  for (const step of [0, 4, 8, 12]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: step === 0 ? 0.94 : 0.86 });
    putStep(kickTrack, 1, step, 'C1', { velocity: step === 0 ? 0.96 : 0.88 });
  }
  for (const step of [4, 12]) {
    putStep(snareTrack, 0, step, 'C1', { velocity: 0.78 });
    putStep(snareTrack, 1, step, 'C1', { velocity: 0.82 });
  }
  for (const [index, step] of [2, 6, 10, 14].entries()) {
    putStep(hihatTrack, 0, step, 'C1', { gate: 0.36, velocity: index % 2 === 0 ? 0.54 : 0.44 });
  }
  for (const [index, step] of [1, 3, 5, 7, 9, 11, 13, 15].entries()) {
    putStep(hihatTrack, 1, step, 'C1', { gate: 0.32, velocity: index % 2 === 0 ? 0.5 : 0.62 });
  }

  const bassPatternA = [
    { note: 'C2', step: 0 },
    { note: 'G1', step: 4 },
    { note: 'A1', step: 8 },
    { note: 'F1', step: 12 },
  ];
  const bassPatternB = [
    { note: 'F1', step: 0 },
    { note: 'A1', step: 4 },
    { note: 'C2', step: 8 },
    { note: 'G1', step: 12 },
  ];
  bassPatternA.forEach(({ note, step }) => {
    putStep(bassTrack, 0, step, note, { gate: 1.2, velocity: 0.72 });
  });
  bassPatternB.forEach(({ note, step }) => {
    putStep(bassTrack, 1, step, note, { gate: 1.2, velocity: 0.74 });
  });

  [
    { note: 'G4', step: 0 },
    { note: 'A4', step: 3 },
    { note: 'C5', step: 6 },
    { note: 'D5', step: 8 },
    { note: 'C5', step: 12 },
    { note: 'A4', step: 15 },
  ].forEach(({ note, step }) => {
    putStep(leadTrack, 0, step, note, { gate: 1, velocity: 0.7 });
  });
  [
    { note: 'F4', step: 0 },
    { note: 'A4', step: 4 },
    { note: 'C5', step: 8 },
    { note: 'D5', step: 12 },
    { note: 'C5', step: 15 },
  ].forEach(({ note, step }) => {
    putStep(leadTrack, 1, step, note, { gate: 1, velocity: 0.72 });
  });

  stackStep(padTrack, 0, 0, [
    { note: 'C4', options: { gate: 4, velocity: 0.4 } },
    { note: 'E4', options: { gate: 4, velocity: 0.36 } },
    { note: 'G4', options: { gate: 4, velocity: 0.34 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'A3', options: { gate: 4, velocity: 0.38 } },
    { note: 'C4', options: { gate: 4, velocity: 0.34 } },
    { note: 'E4', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 1, 0, [
    { note: 'F3', options: { gate: 4, velocity: 0.4 } },
    { note: 'A3', options: { gate: 4, velocity: 0.36 } },
    { note: 'C4', options: { gate: 4, velocity: 0.34 } },
  ]);
  stackStep(padTrack, 1, 8, [
    { note: 'G3', options: { gate: 4, velocity: 0.38 } },
    { note: 'B3', options: { gate: 4, velocity: 0.34 } },
    { note: 'D4', options: { gate: 4, velocity: 0.32 } },
  ]);

  [
    { note: 'E5', step: 2 },
    { note: 'G5', step: 10 },
    { note: 'A5', step: 14 },
  ].forEach(({ note, step }) => {
    putStep(pluckTrack, 0, step, note, { gate: 0.82, velocity: 0.68 });
  });
  [
    { note: 'A4', step: 2 },
    { note: 'C5', step: 6 },
    { note: 'E5', step: 10 },
    { note: 'D5', step: 14 },
  ].forEach(({ note, step }) => {
    putStep(pluckTrack, 1, step, note, { gate: 0.82, velocity: 0.7 });
  });

  leadTrack.params.delaySend = 0.34;
  leadTrack.params.reverbSend = 0.28;
  padTrack.params.reverbSend = 0.52;
  padTrack.params.chorusSend = 0.24;
  pluckTrack.params.delaySend = 0.2;
  pluckTrack.params.cutoff = 3800;

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(hihatTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 1, startBeat: 16 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Verse' },
    { beat: 16, id: createId('marker'), name: 'Lift' },
  ]);
};

export const createVelvetSuiteProject = (projectName: string = 'Velvet Suite'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 86,
    mode: 'SONG',
    trackOrder: VELVET_SUITE_TRACK_ORDER,
  });
  const [bassTrack, pianoTrack, padTrack, violinTrack] = tracks;

  // I – vi – IV – V in C major: one held bass note per bar.
  [
    { step: 0, note: 'C2' },
    { step: 4, note: 'A1' },
    { step: 8, note: 'F1' },
    { step: 12, note: 'G1' },
  ].forEach(({ step, note }) => {
    putStep(bassTrack, 0, step, note, { gate: 3.5, velocity: 0.62 });
  });

  // Piano triads on each downbeat.
  stackStep(pianoTrack, 0, 0, [
    { note: 'C4', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.5 } },
    { note: 'G4', options: { gate: 2.5, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 4, [
    { note: 'A3', options: { gate: 2.5, velocity: 0.58 } },
    { note: 'C4', options: { gate: 2.5, velocity: 0.5 } },
    { note: 'E4', options: { gate: 2.5, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 8, [
    { note: 'F3', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'A3', options: { gate: 2.5, velocity: 0.5 } },
    { note: 'C4', options: { gate: 2.5, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 12, [
    { note: 'G3', options: { gate: 2.5, velocity: 0.6 } },
    { note: 'B3', options: { gate: 2.5, velocity: 0.5 } },
    { note: 'D4', options: { gate: 2.5, velocity: 0.5 } },
  ]);

  // Pad — same chords, lower octave, held long for the bed.
  stackStep(padTrack, 0, 0, [
    { note: 'C3', options: { gate: 4, velocity: 0.34 } },
    { note: 'G3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'A2', options: { gate: 4, velocity: 0.34 } },
    { note: 'E3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'F2', options: { gate: 4, velocity: 0.36 } },
    { note: 'C3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'G2', options: { gate: 4, velocity: 0.36 } },
    { note: 'D3', options: { gate: 4, velocity: 0.32 } },
  ]);

  // Violin — a lyrical line floating over the changes.
  [
    { step: 0, note: 'E5', gate: 1.4 },
    { step: 2, note: 'G5', gate: 1.2 },
    { step: 4, note: 'A5', gate: 1.4 },
    { step: 6, note: 'E5', gate: 1.2 },
    { step: 8, note: 'F5', gate: 1.4 },
    { step: 10, note: 'A5', gate: 1.2 },
    { step: 12, note: 'G5', gate: 1.4 },
    { step: 14, note: 'B4', gate: 1.6 },
  ].forEach(({ step, note, gate }) => {
    putStep(violinTrack, 0, step, note, { gate, velocity: 0.66 });
  });

  padTrack.params.reverbSend = 0.56;
  padTrack.params.chorusSend = 0.22;
  // A wide string section gives the chamber sketch its "just air" lift.
  applyVoicePresetById(violinTrack, 'string-ensemble');
  pianoTrack.params.reverbSend = 0.28;

  return buildProject([
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pianoTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(violinTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Suite' },
  ]);
};

export const createCrystalGardenProject = (projectName: string = 'Crystal Garden'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 92,
    mode: 'SONG',
    trackOrder: CRYSTAL_GARDEN_TRACK_ORDER,
  });
  const [kickTrack, bassTrack, pianoTrack, padTrack, bellTrack] = tracks;

  // Soft anchor kick on the two downbeats only — keeps it gentle.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.68 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.7 });

  // I – IV – V – I in C: C, F, G, C.
  [
    { step: 0, note: 'C2' },
    { step: 4, note: 'F2' },
    { step: 8, note: 'G2' },
    { step: 12, note: 'C2' },
  ].forEach(({ step, note }) => {
    putStep(bassTrack, 0, step, note, { gate: 1.8, velocity: 0.6 });
  });

  stackStep(pianoTrack, 0, 0, [
    { note: 'C4', options: { gate: 2.2, velocity: 0.6 } },
    { note: 'E4', options: { gate: 2.2, velocity: 0.5 } },
    { note: 'G4', options: { gate: 2.2, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 4, [
    { note: 'F4', options: { gate: 2.2, velocity: 0.6 } },
    { note: 'A4', options: { gate: 2.2, velocity: 0.5 } },
    { note: 'C5', options: { gate: 2.2, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 8, [
    { note: 'G3', options: { gate: 2.2, velocity: 0.6 } },
    { note: 'B3', options: { gate: 2.2, velocity: 0.5 } },
    { note: 'D4', options: { gate: 2.2, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 12, [
    { note: 'C4', options: { gate: 2.2, velocity: 0.6 } },
    { note: 'E4', options: { gate: 2.2, velocity: 0.5 } },
    { note: 'G4', options: { gate: 2.2, velocity: 0.5 } },
  ]);

  stackStep(padTrack, 0, 0, [
    { note: 'C3', options: { gate: 4, velocity: 0.34 } },
    { note: 'G3', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'F3', options: { gate: 4, velocity: 0.34 } },
    { note: 'C4', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'G3', options: { gate: 4, velocity: 0.34 } },
    { note: 'D4', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'C3', options: { gate: 4, velocity: 0.34 } },
    { note: 'G3', options: { gate: 4, velocity: 0.3 } },
  ]);

  // Bell — bright accents on the offbeats and downbeats.
  [
    { step: 0, note: 'C6' },
    { step: 6, note: 'E6' },
    { step: 8, note: 'G6' },
    { step: 11, note: 'F6' },
    { step: 14, note: 'D6' },
  ].forEach(({ step, note }) => {
    putStep(bellTrack, 0, step, note, { gate: 1, velocity: 0.6 });
  });

  padTrack.params.reverbSend = 0.52;
  padTrack.params.chorusSend = 0.26;
  pianoTrack.params.reverbSend = 0.3;
  bellTrack.params.reverbSend = 0.46;
  bellTrack.params.delaySend = 0.28;

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pianoTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bellTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Garden' },
  ]);
};

export const createTwilightFrameProject = (projectName: string = 'Twilight Frame'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 88,
    mode: 'SONG',
    trackOrder: TWILIGHT_FRAME_TRACK_ORDER,
  });
  const [kickTrack, bassTrack, pianoTrack, padTrack, violinTrack, bellTrack] = tracks;

  // Soft kick anchor — just the downbeats so the cinematic feel stays.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.6 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.62 });

  // i – VI – III – VII in A minor: Am, F, C, G.
  [
    { step: 0, note: 'A1' },
    { step: 4, note: 'F1' },
    { step: 8, note: 'C2' },
    { step: 12, note: 'G1' },
  ].forEach(({ step, note }) => {
    putStep(bassTrack, 0, step, note, { gate: 3, velocity: 0.6 });
  });

  stackStep(pianoTrack, 0, 0, [
    { note: 'A3', options: { gate: 2.4, velocity: 0.6 } },
    { note: 'C4', options: { gate: 2.4, velocity: 0.5 } },
    { note: 'E4', options: { gate: 2.4, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 4, [
    { note: 'F3', options: { gate: 2.4, velocity: 0.6 } },
    { note: 'A3', options: { gate: 2.4, velocity: 0.5 } },
    { note: 'C4', options: { gate: 2.4, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 8, [
    { note: 'C4', options: { gate: 2.4, velocity: 0.6 } },
    { note: 'E4', options: { gate: 2.4, velocity: 0.5 } },
    { note: 'G4', options: { gate: 2.4, velocity: 0.5 } },
  ]);
  stackStep(pianoTrack, 0, 12, [
    { note: 'G3', options: { gate: 2.4, velocity: 0.6 } },
    { note: 'B3', options: { gate: 2.4, velocity: 0.5 } },
    { note: 'D4', options: { gate: 2.4, velocity: 0.5 } },
  ]);

  stackStep(padTrack, 0, 0, [
    { note: 'A2', options: { gate: 4, velocity: 0.34 } },
    { note: 'E3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'F2', options: { gate: 4, velocity: 0.34 } },
    { note: 'C3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'C3', options: { gate: 4, velocity: 0.34 } },
    { note: 'G3', options: { gate: 4, velocity: 0.32 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'G2', options: { gate: 4, velocity: 0.34 } },
    { note: 'D3', options: { gate: 4, velocity: 0.32 } },
  ]);

  // Violin — singing line through the changes.
  [
    { step: 0, note: 'A4', gate: 1.4 },
    { step: 2, note: 'C5', gate: 1.2 },
    { step: 4, note: 'F5', gate: 1.4 },
    { step: 6, note: 'A4', gate: 1.2 },
    { step: 8, note: 'G5', gate: 1.4 },
    { step: 10, note: 'E5', gate: 1.2 },
    { step: 12, note: 'D5', gate: 1.4 },
    { step: 14, note: 'B4', gate: 1.6 },
  ].forEach(({ step, note, gate }) => {
    putStep(violinTrack, 0, step, note, { gate, velocity: 0.62 });
  });

  // Bell — bright accents on each chord change.
  [
    { step: 0, note: 'A5' },
    { step: 4, note: 'C6' },
    { step: 8, note: 'E6' },
    { step: 12, note: 'D6' },
  ].forEach(({ step, note }) => {
    putStep(bellTrack, 0, step, note, { gate: 1.2, velocity: 0.5 });
  });

  padTrack.params.reverbSend = 0.54;
  padTrack.params.chorusSend = 0.24;
  // The expressive bowed voice for this scene's singing violin line.
  applyVoicePresetById(violinTrack, 'bowed-ribbon');
  pianoTrack.params.reverbSend = 0.3;
  bellTrack.params.reverbSend = 0.46;
  bellTrack.params.delaySend = 0.24;

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pianoTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(violinTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bellTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Frame' },
  ]);
};

// Late Hours: showcase template for the new voice presets added to
// TRACK_VOICE_PRESET_DEFINITIONS. Slow D-minor cycle that puts each
// preset on the lane it was authored for: tape-warmed pad, bowed
// violin, whistled sine lead, glass bell, round sub bass.
const applyVoicePresetById = (track: Track, presetId: string): void => {
  const preset = TRACK_VOICE_PRESET_DEFINITIONS.find((entry) => entry.id === presetId);
  if (!preset) return;
  if (preset.params) {
    track.params = normalizeParams({ ...track.params, ...preset.params }, undefined);
  }
  if (preset.source) {
    track.source = normalizeSource(track.type, { ...track.source, ...preset.source });
  }
};

export const createLateHoursProject = (projectName: string = 'Late Hours'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 72,
    mode: 'SONG',
    trackOrder: LATE_HOURS_TRACK_ORDER,
  });
  const [kickTrack, bassTrack, padTrack, violinTrack, leadTrack, bellTrack] = tracks;

  // Voice presets seed the lanes with the new sounds so a fresh
  // listener hears them on first play.
  applyVoicePresetById(bassTrack, 'round-sub');
  applyVoicePresetById(padTrack, 'tape-warmth');
  applyVoicePresetById(violinTrack, 'bowed-ribbon');
  applyVoicePresetById(leadTrack, 'whistle-breath');
  applyVoicePresetById(bellTrack, 'glass-bell');

  // Soft kick on the downbeats only, just to anchor the pulse.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.5 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.48 });

  // i, VI, III, VII in D minor: Dm, Bb, F, C.
  [
    { step: 0, note: 'D1' },
    { step: 4, note: 'A#1' },
    { step: 8, note: 'F1' },
    { step: 12, note: 'C2' },
  ].forEach(({ step, note }) => {
    putStep(bassTrack, 0, step, note, { gate: 4, velocity: 0.62 });
  });

  // Pad bed holds each chord for the full four steps.
  stackStep(padTrack, 0, 0, [
    { note: 'D3', options: { gate: 4, velocity: 0.36 } },
    { note: 'F3', options: { gate: 4, velocity: 0.32 } },
    { note: 'A3', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'A#2', options: { gate: 4, velocity: 0.36 } },
    { note: 'D3', options: { gate: 4, velocity: 0.32 } },
    { note: 'F3', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'F3', options: { gate: 4, velocity: 0.36 } },
    { note: 'A3', options: { gate: 4, velocity: 0.32 } },
    { note: 'C4', options: { gate: 4, velocity: 0.3 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'C3', options: { gate: 4, velocity: 0.36 } },
    { note: 'E3', options: { gate: 4, velocity: 0.32 } },
    { note: 'G3', options: { gate: 4, velocity: 0.3 } },
  ]);

  // Violin sings through the changes with longer gates so the bowed
  // attack of the Bowed Ribbon preset reads cleanly.
  [
    { step: 0, note: 'A4', gate: 2 },
    { step: 4, note: 'F4', gate: 2 },
    { step: 8, note: 'A4', gate: 2 },
    { step: 12, note: 'G4', gate: 2 },
  ].forEach(({ step, note, gate }) => {
    putStep(violinTrack, 0, step, note, { gate, velocity: 0.58 });
  });

  // Whistled lead countermelody, sparser so it sits behind the violin.
  [
    { step: 2, note: 'D5', gate: 1 },
    { step: 6, note: 'F5', gate: 1.4 },
    { step: 10, note: 'A5', gate: 1.4 },
    { step: 14, note: 'G5', gate: 1.6 },
  ].forEach(({ step, note, gate }) => {
    putStep(leadTrack, 0, step, note, { gate, velocity: 0.5 });
  });

  // Bell sparkles on each chord change.
  [
    { step: 0, note: 'D5' },
    { step: 4, note: 'A#5' },
    { step: 8, note: 'F5' },
    { step: 12, note: 'C6' },
  ].forEach(({ step, note }) => {
    putStep(bellTrack, 0, step, note, { gate: 2, velocity: 0.48 });
  });

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(violinTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bellTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Hours' },
  ]);
};

export const createMidnightTrapProject = (projectName: string = 'Midnight Trap'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 140,
    mode: 'SONG',
    trackOrder: TRAP_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hatTrack, bassTrack, bellTrack, padTrack] = tracks;

  // Sparse halftime kick with a syncopated pickup.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.96 });
  putStep(kickTrack, 0, 6, 'C1', { velocity: 0.7 });
  putStep(kickTrack, 0, 10, 'C1', { velocity: 0.82 });
  // Backbeat clap on beat 3.
  putStep(snareTrack, 0, 8, 'C1', { velocity: 0.82 });
  // Rattling hats: straight 16ths with a triplet-feel roll into the bar end.
  for (let step = 0; step < 16; step += 1) {
    if (step === 13 || step === 15) continue;
    putStep(hatTrack, 0, step, 'C1', { gate: 0.3, velocity: step % 4 === 0 ? 0.6 : 0.4 });
  }
  for (const step of [13, 15]) {
    putStep(hatTrack, 0, step, 'C1', { gate: 0.18, velocity: 0.5 });
  }
  // 808 bass walking Gm - Bb - Eb - F with long glides.
  putStep(bassTrack, 0, 0, 'G1', { gate: 5.5, velocity: 0.92 });
  putStep(bassTrack, 0, 6, 'A#1', { gate: 2, velocity: 0.78 });
  putStep(bassTrack, 0, 8, 'D#1', { gate: 3.5, velocity: 0.82 });
  putStep(bassTrack, 0, 12, 'F1', { gate: 3.5, velocity: 0.8 });
  // Dark bell hook in G minor.
  putStep(bellTrack, 0, 0, 'G4', { gate: 1.2, velocity: 0.6 });
  putStep(bellTrack, 0, 3, 'A#4', { gate: 1, velocity: 0.52 });
  putStep(bellTrack, 0, 6, 'D5', { gate: 1.5, velocity: 0.58 });
  putStep(bellTrack, 0, 10, 'F5', { gate: 1, velocity: 0.5 });
  putStep(bellTrack, 0, 12, 'D5', { gate: 2, velocity: 0.54 });
  // Low held pad chord.
  stackStep(padTrack, 0, 0, [
    { note: 'G2', options: { gate: 8, velocity: 0.34 } },
    { note: 'A#2', options: { gate: 8, velocity: 0.3 } },
    { note: 'D3', options: { gate: 8, velocity: 0.3 } },
  ]);

  bassTrack.source.octaveShift = -1;
  bassTrack.params.distortion = 0.18;
  bellTrack.params.reverbSend = 0.4;
  bellTrack.params.delaySend = 0.42;
  padTrack.params.reverbSend = 0.5;
  hatTrack.source.engine = 'sample';
  hatTrack.source.samplePlayback = 'oneshot';
  hatTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bellTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Trap loop' },
  ]);
};

export const createNeonBreaksProject = (projectName: string = 'Neon Breaks'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 174,
    mode: 'SONG',
    trackOrder: DNB_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hatTrack, bassTrack, leadTrack, padTrack] = tracks;

  // Classic two-step break: kick on 1 and the and-of-3, snare on 2 and 4.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.95 });
  putStep(kickTrack, 0, 10, 'C1', { velocity: 0.82 });
  putStep(snareTrack, 0, 4, 'C1', { velocity: 0.85 });
  putStep(snareTrack, 0, 12, 'C1', { velocity: 0.85 });
  // Busy hats with ghosted offbeats.
  for (let step = 2; step < 16; step += 2) {
    putStep(hatTrack, 0, step, 'C1', { gate: 0.28, velocity: step % 4 === 0 ? 0.5 : 0.32 });
  }
  // Reese sub in A minor, long and growling.
  putStep(bassTrack, 0, 0, 'A1', { gate: 6, velocity: 0.9 });
  putStep(bassTrack, 0, 8, 'G1', { gate: 3.5, velocity: 0.82 });
  putStep(bassTrack, 0, 12, 'F1', { gate: 3.5, velocity: 0.82 });
  // Stabbed lead riff.
  putStep(leadTrack, 0, 0, 'A4', { gate: 0.75, velocity: 0.6 });
  putStep(leadTrack, 0, 3, 'C5', { gate: 0.75, velocity: 0.56 });
  putStep(leadTrack, 0, 6, 'E5', { gate: 1, velocity: 0.62 });
  putStep(leadTrack, 0, 11, 'D5', { gate: 0.75, velocity: 0.54 });
  putStep(leadTrack, 0, 14, 'A4', { gate: 1, velocity: 0.5 });
  // Wide atmosphere pad.
  stackStep(padTrack, 0, 0, [
    { note: 'A3', options: { gate: 8, velocity: 0.32 } },
    { note: 'C4', options: { gate: 8, velocity: 0.28 } },
    { note: 'E4', options: { gate: 8, velocity: 0.28 } },
    { note: 'G4', options: { gate: 8, velocity: 0.26 } },
  ]);

  bassTrack.source.octaveShift = -1;
  bassTrack.source.waveform = 'fatsawtooth';
  bassTrack.params.distortion = 0.14;
  leadTrack.params.delaySend = 0.34;
  leadTrack.params.reverbSend = 0.3;
  padTrack.params.reverbSend = 0.58;
  padTrack.params.chorusSend = 0.3;
  hatTrack.source.engine = 'sample';
  hatTrack.source.samplePlayback = 'oneshot';
  hatTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(leadTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Breaks roller' },
  ]);
};

export const createSunsetHouseProject = (projectName: string = 'Sunset House'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 122,
    mode: 'SONG',
    trackOrder: HOUSE_TRACK_ORDER,
  });
  const [kickTrack, clapTrack, hatTrack, bassTrack, padTrack, pluckTrack] = tracks;

  // Four-on-the-floor with an offbeat-open-hat house groove.
  for (const step of [0, 4, 8, 12]) {
    putStep(kickTrack, 0, step, 'C1', { velocity: step === 0 ? 0.94 : 0.86 });
  }
  for (const step of [4, 12]) {
    putStep(clapTrack, 0, step, 'C1', { velocity: 0.74 });
  }
  for (const step of [2, 6, 10, 14]) {
    putStep(hatTrack, 0, step, 'C1', { gate: 0.5, velocity: 0.56 });
  }
  // Round offbeat bass outlining Am - F - C - G.
  putStep(bassTrack, 0, 2, 'A1', { gate: 0.8, velocity: 0.78 });
  putStep(bassTrack, 0, 6, 'F1', { gate: 0.8, velocity: 0.74 });
  putStep(bassTrack, 0, 10, 'C2', { gate: 0.8, velocity: 0.74 });
  putStep(bassTrack, 0, 14, 'G1', { gate: 0.8, velocity: 0.74 });
  // Lush ninth-chord pad bed.
  stackStep(padTrack, 0, 0, [
    { note: 'A3', options: { gate: 8, velocity: 0.36 } },
    { note: 'C4', options: { gate: 8, velocity: 0.32 } },
    { note: 'E4', options: { gate: 8, velocity: 0.3 } },
    { note: 'G4', options: { gate: 8, velocity: 0.3 } },
    { note: 'B4', options: { gate: 8, velocity: 0.26 } },
  ]);
  // Organ pluck comping on the offbeats.
  for (const step of [1, 5, 9, 13]) {
    stackStep(pluckTrack, 0, step, [
      { note: 'C5', options: { gate: 0.5, velocity: 0.5 } },
      { note: 'E5', options: { gate: 0.5, velocity: 0.46 } },
    ]);
  }

  bassTrack.source.octaveShift = -1;
  padTrack.params.reverbSend = 0.5;
  padTrack.params.chorusSend = 0.32;
  pluckTrack.params.delaySend = 0.3;
  pluckTrack.params.reverbSend = 0.34;
  hatTrack.source.engine = 'sample';
  hatTrack.source.samplePlayback = 'oneshot';
  hatTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(clapTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'House groove' },
  ]);
};

export const createPalmHourProject = (projectName: string = 'Palm Hour'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 112,
    mode: 'SONG',
    trackOrder: PALM_HOUR_TRACK_ORDER,
  });
  const [kickTrack, clapTrack, shakerTrack, logTrack, pianoTrack, padTrack] = tracks;

  // Soft four-on-the-floor kick, beat 1 leading.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.9 });
  putStep(kickTrack, 0, 4, 'C1', { velocity: 0.8 });
  putStep(kickTrack, 0, 8, 'C1', { velocity: 0.82 });
  putStep(kickTrack, 0, 12, 'C1', { velocity: 0.8 });
  // Clap on the backbeat (beats 2 and 4).
  putStep(clapTrack, 0, 4, 'C1', { velocity: 0.66 });
  putStep(clapTrack, 0, 12, 'C1', { velocity: 0.66 });
  // Shuffled shakers: busy sixteenths with the offbeats pushed for the swing.
  for (let step = 0; step < 16; step += 1) {
    if (step === 7) continue; // a small breath before beat 3
    const onBeat = step % 4 === 0;
    const offbeat = step % 2 === 1;
    putStep(shakerTrack, 0, step, 'C1', { gate: 0.22, velocity: offbeat ? 0.5 : onBeat ? 0.34 : 0.3 });
  }
  // Log drum: a bouncing sub that walks the Am - F - C - G roots and their fifths.
  putStep(logTrack, 0, 0, 'A1', { gate: 0.9, velocity: 0.92 });
  putStep(logTrack, 0, 2, 'A1', { gate: 0.5, velocity: 0.7 });
  putStep(logTrack, 0, 3, 'E2', { gate: 0.5, velocity: 0.66 });
  putStep(logTrack, 0, 6, 'F1', { gate: 0.9, velocity: 0.82 });
  putStep(logTrack, 0, 8, 'C2', { gate: 0.7, velocity: 0.8 });
  putStep(logTrack, 0, 10, 'C2', { gate: 0.5, velocity: 0.64 });
  putStep(logTrack, 0, 11, 'G1', { gate: 0.5, velocity: 0.62 });
  putStep(logTrack, 0, 12, 'G1', { gate: 0.9, velocity: 0.84 });
  putStep(logTrack, 0, 14, 'D2', { gate: 0.6, velocity: 0.66 });
  // Warm piano triads on each change.
  stackStep(pianoTrack, 0, 0, [
    { note: 'A3', options: { gate: 3, velocity: 0.44 } },
    { note: 'C4', options: { gate: 3, velocity: 0.4 } },
    { note: 'E4', options: { gate: 3, velocity: 0.4 } },
  ]);
  stackStep(pianoTrack, 0, 4, [
    { note: 'F3', options: { gate: 3, velocity: 0.42 } },
    { note: 'A3', options: { gate: 3, velocity: 0.38 } },
    { note: 'C4', options: { gate: 3, velocity: 0.38 } },
  ]);
  stackStep(pianoTrack, 0, 8, [
    { note: 'C4', options: { gate: 3, velocity: 0.42 } },
    { note: 'E4', options: { gate: 3, velocity: 0.38 } },
    { note: 'G4', options: { gate: 3, velocity: 0.38 } },
  ]);
  stackStep(pianoTrack, 0, 12, [
    { note: 'G3', options: { gate: 3, velocity: 0.42 } },
    { note: 'B3', options: { gate: 3, velocity: 0.38 } },
    { note: 'D4', options: { gate: 3, velocity: 0.38 } },
  ]);
  // Offbeat top-note echoes for the amapiano piano skip.
  putStep(pianoTrack, 0, 2, 'E4', { gate: 0.6, velocity: 0.26 });
  putStep(pianoTrack, 0, 6, 'C4', { gate: 0.6, velocity: 0.26 });
  putStep(pianoTrack, 0, 10, 'G4', { gate: 0.6, velocity: 0.26 });
  putStep(pianoTrack, 0, 14, 'D4', { gate: 0.6, velocity: 0.26 });
  // Wide pad bed following the same changes, soft and sustained.
  stackStep(padTrack, 0, 0, [
    { note: 'A2', options: { gate: 4, velocity: 0.26 } },
    { note: 'E3', options: { gate: 4, velocity: 0.22 } },
  ]);
  stackStep(padTrack, 0, 4, [
    { note: 'F2', options: { gate: 4, velocity: 0.26 } },
    { note: 'C3', options: { gate: 4, velocity: 0.22 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'C3', options: { gate: 4, velocity: 0.26 } },
    { note: 'G3', options: { gate: 4, velocity: 0.22 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'G2', options: { gate: 4, velocity: 0.26 } },
    { note: 'D3', options: { gate: 4, velocity: 0.22 } },
  ]);

  logTrack.source.octaveShift = -1;
  logTrack.source.waveform = 'triangle';
  logTrack.source.portamento = 0.04;
  logTrack.params.distortion = 0.12;
  pianoTrack.params.reverbSend = 0.26;
  padTrack.params.reverbSend = 0.52;
  padTrack.params.chorusSend = 0.3;
  shakerTrack.source.engine = 'sample';
  shakerTrack.source.samplePlayback = 'oneshot';
  shakerTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(clapTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(shakerTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(logTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pianoTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Palm Hour groove' },
  ]);
};

export const createPirateRadioProject = (projectName: string = 'Pirate Radio'): Project => {
  const { buildProject, tracks, transport } = createProjectFrame(projectName, {
    bpm: 133,
    mode: 'SONG',
    trackOrder: HOUSE_TRACK_ORDER,
  });
  const [kickTrack, snareTrack, hatTrack, bassTrack, padTrack, pluckTrack] = tracks;

  // Two-step kick: beat 1, the and-of-2, and a lighter push before beat 3.
  // No four-on-the-floor; the missing beats are what makes it skip.
  putStep(kickTrack, 0, 0, 'C1', { velocity: 0.95 });
  putStep(kickTrack, 0, 6, 'C1', { velocity: 0.8 });
  putStep(kickTrack, 0, 10, 'C1', { velocity: 0.72 });
  // Crisp snares on the backbeat with a ghost skipping into the next bar.
  putStep(snareTrack, 0, 4, 'C1', { velocity: 0.78 });
  putStep(snareTrack, 0, 12, 'C1', { velocity: 0.85 });
  putStep(snareTrack, 0, 15, 'C1', { gate: 0.5, velocity: 0.38 });
  // Shuffled hats: uneven 16th placements and a longer open hat read as swing
  // on the straight grid.
  putStep(hatTrack, 0, 2, 'C1', { gate: 0.3, velocity: 0.5 });
  putStep(hatTrack, 0, 3, 'C1', { gate: 0.18, velocity: 0.32 });
  putStep(hatTrack, 0, 5, 'C1', { gate: 0.22, velocity: 0.36 });
  putStep(hatTrack, 0, 7, 'C1', { gate: 0.6, velocity: 0.55 });
  putStep(hatTrack, 0, 11, 'C1', { gate: 0.18, velocity: 0.34 });
  putStep(hatTrack, 0, 13, 'C1', { gate: 0.3, velocity: 0.5 });
  putStep(hatTrack, 0, 14, 'C1', { gate: 0.22, velocity: 0.4 });
  // Bouncing sub walking Am - F - G with a pickup back to A.
  putStep(bassTrack, 0, 0, 'A1', { gate: 1.25, velocity: 0.9 });
  putStep(bassTrack, 0, 3, 'E2', { gate: 0.5, velocity: 0.68 });
  putStep(bassTrack, 0, 6, 'A1', { gate: 0.9, velocity: 0.82 });
  putStep(bassTrack, 0, 8, 'F1', { gate: 1.25, velocity: 0.85 });
  putStep(bassTrack, 0, 11, 'C2', { gate: 0.5, velocity: 0.66 });
  putStep(bassTrack, 0, 12, 'G1', { gate: 1.5, velocity: 0.84 });
  putStep(bassTrack, 0, 15, 'A1', { gate: 0.5, velocity: 0.6 });
  // Chopped stabs: short offbeat hits with a heavy delay send for the
  // cut-up-vocal feel.
  putStep(pluckTrack, 0, 2, 'A4', { gate: 0.5, velocity: 0.6 });
  putStep(pluckTrack, 0, 5, 'C5', { gate: 0.45, velocity: 0.54 });
  putStep(pluckTrack, 0, 7, 'E5', { gate: 0.5, velocity: 0.6 });
  putStep(pluckTrack, 0, 10, 'D5', { gate: 0.4, velocity: 0.52 });
  putStep(pluckTrack, 0, 14, 'C5', { gate: 0.5, velocity: 0.56 });
  // Warm pad bed following the same changes.
  stackStep(padTrack, 0, 0, [
    { note: 'A2', options: { gate: 8, velocity: 0.3 } },
    { note: 'C3', options: { gate: 8, velocity: 0.26 } },
    { note: 'E3', options: { gate: 8, velocity: 0.26 } },
  ]);
  stackStep(padTrack, 0, 8, [
    { note: 'F2', options: { gate: 4, velocity: 0.3 } },
    { note: 'A2', options: { gate: 4, velocity: 0.26 } },
    { note: 'C3', options: { gate: 4, velocity: 0.26 } },
  ]);
  stackStep(padTrack, 0, 12, [
    { note: 'G2', options: { gate: 4, velocity: 0.3 } },
    { note: 'B2', options: { gate: 4, velocity: 0.26 } },
    { note: 'D3', options: { gate: 4, velocity: 0.26 } },
  ]);

  bassTrack.source.octaveShift = -1;
  bassTrack.source.waveform = 'sine';
  bassTrack.source.portamento = 0.03;
  bassTrack.params.distortion = 0.08;
  pluckTrack.params.delaySend = 0.38;
  pluckTrack.params.reverbSend = 0.22;
  padTrack.params.reverbSend = 0.55;
  padTrack.params.chorusSend = 0.28;
  kickTrack.source.samplePlayback = 'oneshot';
  snareTrack.source.samplePlayback = 'oneshot';
  hatTrack.source.engine = 'sample';
  hatTrack.source.samplePlayback = 'oneshot';
  hatTrack.source.sampleTriggerMode = 'step-mapped';

  return buildProject([
    createArrangerClip(kickTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(snareTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(hatTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(bassTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(padTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
    createArrangerClip(pluckTrack.id, transport, { beatLength: 16, patternIndex: 0, startBeat: 0 }),
  ], [
    { beat: 0, id: createId('marker'), name: 'Two-step loop' },
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
    case 'lofi-sunday':
      return createLoFiSundayProject();
    case 'synthwave-drive':
      return createSynthwaveDriveProject();
    case 'club-horizon':
      return createClubHorizonProject();
    case 'pulse-rider':
      return createPulseRiderProject();
    case 'starlight-parade':
      return createStarlightParadeProject();
    case 'velvet-suite':
      return createVelvetSuiteProject();
    case 'crystal-garden':
      return createCrystalGardenProject();
    case 'twilight-frame':
      return createTwilightFrameProject();
    case 'late-hours':
      return createLateHoursProject();
    case 'midnight-trap':
      return createMidnightTrapProject();
    case 'neon-breaks':
      return createNeonBreaksProject();
    case 'sunset-house':
      return createSunsetHouseProject();
    case 'palm-hour':
      return createPalmHourProject();
    case 'pirate-radio':
      return createPirateRadioProject();
    case 'night-transit':
    default:
      return createNightTransitProject();
  }
};

export const normalizeProject = (rawInput: unknown): Project | null => {
  // Upgrade older saved shapes to the current schema before normalizing, so a
  // structural change is an explicit, ordered migration rather than a silent
  // reinterpretation. With no migrations registered this is the identity.
  const input = runSchemaMigrations(rawInput, PROJECT_SCHEMA_VERSION);
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
  const resolvedArrangerClips = arrangerClips.length > 0
    ? arrangerClips
    : legacySectionsToClips(input.arranger, tracks, transport);
  const maxMarkerBeat = resolvedArrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    transport.stepsPerPattern,
  );

  return {
    arrangerClips: resolvedArrangerClips,
    bounceHistory: normalizeBounceHistory(input.bounceHistory),
    master: normalizeMaster(input.master),
    masterSnapshots: normalizeMasterSnapshots(input.masterSnapshots),
    markers: normalizeSongMarkers(input.markers, maxMarkerBeat),
    metadata: {
      createdAt,
      id: typeof metadata.id === 'string' && metadata.id ? metadata.id : createId('project'),
      name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : 'Recovered Session',
      updatedAt,
      version: PROJECT_SCHEMA_VERSION,
    },
    trackSnapshots: normalizeTrackSnapshots(input.trackSnapshots),
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
    case 'violin':
      return 'A4';
    case 'piano':
      return 'C4';
    case 'bell':
      return 'C5';
    default:
      return 'C4';
  }
};
