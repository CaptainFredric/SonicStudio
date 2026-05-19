import type { InstrumentType, SynthParams, TrackSource } from '../project/schema';

export interface InputChannelStripDefinition {
  description: string;
  focus: string;
  id: string;
  label: string;
  params: Partial<SynthParams>;
  source: Partial<TrackSource>;
  trackTypes: InstrumentType[];
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export const INPUT_CHANNEL_STRIP_DEFINITIONS: InputChannelStripDefinition[] = [
  {
    description: 'Quick clean amp shape for DI guitars, picked hooks, and arpeggiated parts that need front-edge detail.',
    focus: 'Clean amp',
    id: 'guitar-clean-amp',
    label: 'Guitar Clean',
    params: {
      attack: 0.006,
      chorusSend: 0.08,
      cutoff: 4200,
      decay: 0.18,
      delaySend: 0.12,
      distortion: 0.08,
      release: 0.54,
      resonance: 1.5,
      reverbSend: 0.18,
      sustain: 0.42,
    },
    source: {
      engine: 'synth',
      octaveShift: -1,
      portamento: 0.01,
      waveform: 'triangle',
    },
    trackTypes: ['lead', 'pluck', 'pad', 'violin', 'piano', 'bell'],
  },
  {
    description: 'Crunchier amp chain for doubled riffs, synth-guitar stabs, and wider chorus guitars.',
    focus: 'Crunch stack',
    id: 'guitar-crunch-stack',
    label: 'Guitar Crunch',
    params: {
      attack: 0.004,
      chorusSend: 0.04,
      cutoff: 3400,
      decay: 0.14,
      delaySend: 0.1,
      distortion: 0.28,
      release: 0.46,
      resonance: 1.9,
      reverbSend: 0.12,
      sustain: 0.36,
    },
    source: {
      engine: 'synth',
      octaveShift: -1,
      portamento: 0,
      waveform: 'sawtooth',
    },
    trackTypes: ['lead', 'pluck', 'fx', 'violin', 'piano', 'bell'],
  },
  {
    description: 'Airy vocal chain for guide takes, doubled hooks, and melodic ideas that need width more than bite.',
    focus: 'Air and width',
    id: 'vocal-air-chain',
    label: 'Vocal Air',
    params: {
      attack: 0.012,
      chorusSend: 0.22,
      cutoff: 6800,
      decay: 0.24,
      delaySend: 0.18,
      release: 1.18,
      resonance: 0.9,
      reverbSend: 0.42,
      sustain: 0.64,
      vibratoDepth: 0.05,
      vibratoRate: 4.2,
    },
    source: {
      engine: 'synth',
      octaveShift: 0,
      portamento: 0.02,
      waveform: 'triangle',
    },
    trackTypes: ['lead', 'pad', 'fx', 'violin', 'piano', 'bell'],
  },
  {
    description: 'More focused vocal strip for spoken ideas, lead lines, and tighter phrase work that needs presence.',
    focus: 'Presence strip',
    id: 'vocal-presence-strip',
    label: 'Vocal Presence',
    params: {
      attack: 0.008,
      chorusSend: 0.1,
      cutoff: 5200,
      decay: 0.2,
      delaySend: 0.08,
      distortion: 0.06,
      filterMode: 'bandpass',
      release: 0.86,
      resonance: 1.2,
      reverbSend: 0.24,
      sustain: 0.58,
      vibratoDepth: 0.03,
      vibratoRate: 4.8,
    },
    source: {
      engine: 'synth',
      octaveShift: 0,
      portamento: 0.03,
      waveform: 'sawtooth',
    },
    trackTypes: ['lead', 'pad', 'fx', 'violin', 'piano', 'bell'],
  },
];

export const getInputChannelStripDefinitions = (trackType: InstrumentType) => (
  INPUT_CHANNEL_STRIP_DEFINITIONS.filter((definition) => definition.trackTypes.includes(trackType))
);

export const buildPerformanceMacroParams = (x: number, y: number): Partial<SynthParams> => {
  const clampedX = clampUnit(x);
  const clampedY = clampUnit(y);
  const openness = clampedX;
  const lift = clampedY;
  const density = 1 - clampedY;

  return {
    bitCrush: Number((density * (1 - openness) * 0.2).toFixed(3)),
    chorusSend: Number((lift * 0.34).toFixed(3)),
    cutoff: Math.round(420 + (openness * 11800)),
    delaySend: Number((0.04 + (openness * 0.42)).toFixed(3)),
    distortion: Number(((openness * density) * 0.42).toFixed(3)),
    release: Number((0.18 + (lift * 2.6)).toFixed(3)),
    resonance: Number((0.7 + (density * 4.4)).toFixed(3)),
    reverbSend: Number((0.06 + (lift * 0.58)).toFixed(3)),
    vibratoDepth: Number(((openness * lift) * 0.18).toFixed(3)),
    vibratoRate: Number((3.2 + (openness * 3.6)).toFixed(3)),
  };
};