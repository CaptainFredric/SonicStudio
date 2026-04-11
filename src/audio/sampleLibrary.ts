import type { InstrumentType, SamplePreset } from '../project/schema';

interface SamplePresetMeta {
  description: string;
  label: string;
  path: string;
  rootNote: string;
  trackTypes: InstrumentType[];
}

export const SAMPLE_LIBRARY: Record<SamplePreset, SamplePresetMeta> = {
  'kick-thud': {
    description: 'Short analog-style kick with weighty decay.',
    label: 'Kick Thud',
    path: 'samples/kick-thud.wav',
    rootNote: 'C1',
    trackTypes: ['kick'],
  },
  'snare-crack': {
    description: 'Tight noise snare with a clipped body.',
    label: 'Snare Crack',
    path: 'samples/snare-crack.wav',
    rootNote: 'C1',
    trackTypes: ['snare'],
  },
  'hat-air': {
    description: 'Bright airy hat burst for tops and motion.',
    label: 'Hat Air',
    path: 'samples/hat-air.wav',
    rootNote: 'C1',
    trackTypes: ['hihat'],
  },
  'bass-pluck': {
    description: 'Plucked electric bass source with short body.',
    label: 'Bass Pluck',
    path: 'samples/bass-pluck.wav',
    rootNote: 'C2',
    trackTypes: ['bass'],
  },
  'lead-glass': {
    description: 'Glass lead source with bright upper harmonics.',
    label: 'Lead Glass',
    path: 'samples/lead-glass.wav',
    rootNote: 'C4',
    trackTypes: ['lead'],
  },
  'pad-haze': {
    description: 'Soft layered pad source for long held chords.',
    label: 'Pad Haze',
    path: 'samples/pad-haze.wav',
    rootNote: 'C4',
    trackTypes: ['pad'],
  },
  'pluck-mallet': {
    description: 'Mallet-like transient suited to short pitched parts.',
    label: 'Pluck Mallet',
    path: 'samples/pluck-mallet.wav',
    rootNote: 'E4',
    trackTypes: ['pluck'],
  },
  'fx-rise': {
    description: 'Rising texture for sweeps and transitions.',
    label: 'FX Rise',
    path: 'samples/fx-rise.wav',
    rootNote: 'C4',
    trackTypes: ['fx'],
  },
};

export const getDefaultSamplePreset = (trackType: InstrumentType): SamplePreset => (
  (Object.entries(SAMPLE_LIBRARY).find(([, preset]) => preset.trackTypes.includes(trackType))?.[0] as SamplePreset | undefined)
  ?? 'lead-glass'
);

export const getSamplePresetOptions = (trackType: InstrumentType) => (
  Object.entries(SAMPLE_LIBRARY)
    .filter(([, preset]) => preset.trackTypes.includes(trackType))
    .map(([preset, meta]) => ({
      description: meta.description,
      label: meta.label,
      preset: preset as SamplePreset,
    }))
);

export const getSamplePresetMeta = (preset: SamplePreset) => SAMPLE_LIBRARY[preset];

export const getSampleUrl = (preset: SamplePreset) => `${import.meta.env.BASE_URL}${SAMPLE_LIBRARY[preset].path}`;

export const MAX_CUSTOM_SAMPLE_BYTES = 1_500_000;
