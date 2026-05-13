// Audio recording + pitch analysis for SonicStudio.
//
// Records microphone audio via MediaRecorder, then runs a lightweight
// autocorrelation-based pitch detector over the decoded buffer to identify
// the dominant musical pitch. From that pitch (and rough energy / brightness
// hints) we now build a ranked set of note candidates and track suggestions
// with reusable synth/sample control values that the capture UI can expose.

import {
  getTrackVoicePresetDefinitions,
  type InstrumentType,
  type SynthParams,
  type TrackSource,
} from '../project/schema';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface DetectedNoteCandidate {
  centsOff: number;
  confidence: number;
  midi: number;
  note: string;
  pitchHz: number;
}

export interface CaptureSuggestionControls {
  cutoff: number;
  detune: number;
  octaveShift: number;
  portamento: number;
  resonance: number;
  reverbSend: number;
}

export interface CaptureSuggestion {
  confidence: number;
  controls: CaptureSuggestionControls;
  note: string | null;
  presetId: string | null;
  presetLabel: string;
  reason: string;
  trackType: InstrumentType;
}

export interface LiveCaptureFrame {
  brightness: number;
  clarity: number;
  detectedNote: string | null;
  detectedPitchHz: number | null;
  durationSeconds: number;
  noteCandidates: DetectedNoteCandidate[];
  rmsDb: number;
  signalLevel: number;
  suggestions: CaptureSuggestion[];
  transientDensity: number;
}

export interface RecordingResult {
  blob: Blob;
  brightness: number;
  clarity: number;
  durationSeconds: number;
  detectedPitchHz: number | null;
  detectedNote: string | null;
  noteCandidates: DetectedNoteCandidate[];
  rmsDb: number;
  suggestions: CaptureSuggestion[];
  suggestedTrackType: InstrumentType;
  reason: string;
  transientDensity: number;
}

interface PitchDetectionResult {
  clarity: number;
  pitchHz: number | null;
}

interface RecordingInsightInput {
  brightness: number;
  clarity: number;
  durationSeconds: number;
  pitchHz: number | null;
  rmsDb: number;
  transientDensity: number;
}

interface TrackCaptureProfile {
  baseCutoff: number;
  basePortamento: number;
  baseResonance: number;
  baseReverb: number;
  brightness: number;
  duration: number;
  loudness: number;
  pitchCenter: number;
  pitchSpread: number;
  pitchedAffinity: number;
  transient: number;
  type: InstrumentType;
}

interface WindowPitchCandidate {
  clarity: number;
  energy: number;
  pitchHz: number;
}

const TRACK_CAPTURE_PROFILES: TrackCaptureProfile[] = [
  {
    baseCutoff: 480,
    basePortamento: 0.02,
    baseResonance: 1.3,
    baseReverb: 0.08,
    brightness: 0.08,
    duration: 0.18,
    loudness: 0.86,
    pitchCenter: 62,
    pitchSpread: 0.72,
    pitchedAffinity: 0.22,
    transient: 0.92,
    type: 'kick',
  },
  {
    baseCutoff: 3800,
    basePortamento: 0,
    baseResonance: 1.8,
    baseReverb: 0.1,
    brightness: 0.55,
    duration: 0.16,
    loudness: 0.74,
    pitchCenter: 220,
    pitchSpread: 1.4,
    pitchedAffinity: 0.18,
    transient: 0.82,
    type: 'snare',
  },
  {
    baseCutoff: 9200,
    basePortamento: 0,
    baseResonance: 2.4,
    baseReverb: 0.06,
    brightness: 0.86,
    duration: 0.1,
    loudness: 0.52,
    pitchCenter: 1800,
    pitchSpread: 1.6,
    pitchedAffinity: 0.06,
    transient: 0.96,
    type: 'hihat',
  },
  {
    baseCutoff: 1400,
    basePortamento: 0.05,
    baseResonance: 1.5,
    baseReverb: 0.14,
    brightness: 0.16,
    duration: 0.34,
    loudness: 0.76,
    pitchCenter: 128,
    pitchSpread: 0.95,
    pitchedAffinity: 0.9,
    transient: 0.22,
    type: 'bass',
  },
  {
    baseCutoff: 5200,
    basePortamento: 0.06,
    baseResonance: 1.6,
    baseReverb: 0.24,
    brightness: 0.46,
    duration: 0.46,
    loudness: 0.56,
    pitchCenter: 720,
    pitchSpread: 1.08,
    pitchedAffinity: 0.94,
    transient: 0.34,
    type: 'lead',
  },
  {
    baseCutoff: 3000,
    basePortamento: 0.02,
    baseResonance: 1.25,
    baseReverb: 0.62,
    brightness: 0.24,
    duration: 0.82,
    loudness: 0.42,
    pitchCenter: 310,
    pitchSpread: 1.25,
    pitchedAffinity: 0.96,
    transient: 0.08,
    type: 'pad',
  },
  {
    baseCutoff: 7600,
    basePortamento: 0.01,
    baseResonance: 1.9,
    baseReverb: 0.22,
    brightness: 0.64,
    duration: 0.24,
    loudness: 0.52,
    pitchCenter: 980,
    pitchSpread: 0.88,
    pitchedAffinity: 0.92,
    transient: 0.62,
    type: 'pluck',
  },
  {
    baseCutoff: 6800,
    basePortamento: 0.08,
    baseResonance: 1.7,
    baseReverb: 0.46,
    brightness: 0.72,
    duration: 0.72,
    loudness: 0.48,
    pitchCenter: 1560,
    pitchSpread: 1.65,
    pitchedAffinity: 0.34,
    transient: 0.46,
    type: 'fx',
  },
];

const frequencyToNote = (hz: number): { note: string; octave: number; midi: number } | null => {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  // MIDI note from frequency, A4 = 440Hz = MIDI 69
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  if (midi < 0 || midi > 127) return null;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return { note: `${name}${octave}`, octave, midi };
};

const rmsOf = (samples: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
};

const linearToDb = (linear: number): number => {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
};

const rmsDbToSignalLevel = (rmsDb: number) => {
  if (!Number.isFinite(rmsDb)) {
    return 0;
  }

  return clamp((rmsDb + 54) / 36, 0, 1);
};

const hzFromMidi = (midi: number) => 440 * (2 ** ((midi - 69) / 12));

const brightnessOf = (samples: Float32Array): number => {
  if (samples.length < 2) {
    return 0;
  }

  let crossings = 0;
  let derivativeEnergy = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    if ((prev >= 0 && next < 0) || (prev < 0 && next >= 0)) {
      crossings += 1;
    }
    derivativeEnergy += Math.abs(next - prev);
  }

  const zeroCrossingRate = crossings / (samples.length - 1);
  const normalizedDerivative = derivativeEnergy / (samples.length - 1);
  return clamp((zeroCrossingRate * 1.8) + (normalizedDerivative * 2.2), 0, 1);
};

const transientDensityOf = (samples: Float32Array): number => {
  if (samples.length < 128) {
    return 0;
  }

  const windowSize = Math.max(64, Math.min(512, Math.floor(samples.length / 80)));
  const envelope: number[] = [];
  let peak = 0;
  for (let start = 0; start < samples.length; start += windowSize) {
    const window = samples.subarray(start, Math.min(samples.length, start + windowSize));
    for (let index = 0; index < window.length; index += 1) {
      peak = Math.max(peak, Math.abs(window[index]));
    }
    envelope.push(rmsOf(window));
  }

  if (envelope.length < 2) {
    return 0;
  }

  let spikes = envelope[0] > 0.035 ? 1 : 0;
  let strongestRise = envelope[0] ?? 0;
  let variation = envelope[0] ?? 0;
  for (let index = 1; index < envelope.length; index += 1) {
    const delta = envelope[index] - envelope[index - 1];
    strongestRise = Math.max(strongestRise, delta);
    variation += Math.abs(delta);

    if (
      delta > 0.018
      && envelope[index] > Math.max(0.03, envelope[index - 1] * 1.32)
    ) {
      spikes += 1;
    }
  }

  const density = spikes / Math.max(1, envelope.length * 0.2);
  const averageVariation = variation / Math.max(1, envelope.length - 1);
  const crest = peak / Math.max(0.0001, envelope.reduce((sum, value) => sum + value, 0) / envelope.length);
  return clamp((density * 0.68) + (strongestRise * 4.6) + (averageVariation * 1.9) + (clamp((crest - 1.35) / 4.5, 0, 1) * 0.24), 0, 1);
};

const exactMidiFromHz = (hz: number) => 69 + 12 * Math.log2(hz / 440);

const gaussianScore = (distance: number, spread: number) => {
  const normalized = spread <= 0 ? distance : distance / spread;
  return Math.exp(-(normalized * normalized));
};

const buildConfidence = (score: number, clarity: number, centsOff: number) => clamp(
  (score * 0.72) + (clarity * 0.2) + ((1 - Math.min(Math.abs(centsOff), 50) / 50) * 0.08),
  0.12,
  0.99,
);

export const buildDetectedNoteCandidates = (
  pitchHz: number | null,
  clarity: number,
): DetectedNoteCandidate[] => {
  if (!pitchHz || !Number.isFinite(pitchHz) || pitchHz <= 0) {
    return [];
  }

  const exactMidi = exactMidiFromHz(pitchHz);
  const baseMidi = Math.round(exactMidi);
  const candidateMidis = [baseMidi, baseMidi - 1, baseMidi + 1]
    .filter((midi, index, all) => midi >= 0 && midi <= 127 && all.indexOf(midi) === index);

  return candidateMidis
    .map((midi) => {
      const note = frequencyToNote(hzFromMidi(midi));
      if (!note) {
        return null;
      }

      const centsOff = Number(((exactMidi - midi) * 100).toFixed(1));
      const confidence = clamp((clarity * 0.72) + ((1 - Math.min(Math.abs(centsOff), 100) / 100) * 0.28), 0.15, 0.99);

      return {
        centsOff,
        confidence,
        midi,
        note: note.note,
        pitchHz: hzFromMidi(midi),
      } satisfies DetectedNoteCandidate;
    })
    .filter((candidate): candidate is DetectedNoteCandidate => candidate !== null)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
};

const choosePresetForTrack = (
  trackType: InstrumentType,
  brightness: number,
  durationNorm: number,
  transientDensity: number,
): { presetId: string | null; presetLabel: string } => {
  const presets = getTrackVoicePresetDefinitions(trackType);
  if (presets.length === 0) {
    return { presetId: null, presetLabel: 'Stock voice' };
  }

  const ranked = presets.map((preset) => {
    let score = 0.45;
    if (preset.id === 'tight-impact') {
      score += (1 - brightness) * 0.26 + transientDensity * 0.28 + (1 - durationNorm) * 0.18;
    } else if (preset.id === 'bright-snap') {
      score += brightness * 0.3 + transientDensity * 0.28 + (1 - durationNorm) * 0.14;
    } else if (preset.id === 'glide-current') {
      score += 0.16 + (1 - Math.abs(durationNorm - 0.45)) * 0.22 + (1 - Math.abs(brightness - 0.34)) * 0.16 + (1 - transientDensity) * 0.08;
    } else if (preset.id === 'air-canopy') {
      score += (1 - Math.abs(durationNorm - 0.8)) * 0.28 + (1 - brightness) * 0.14 + (1 - transientDensity) * 0.2;
    } else if (preset.id === 'needle-pluck') {
      score += brightness * 0.18 + transientDensity * 0.24 + (1 - Math.abs(durationNorm - 0.2)) * 0.24;
    } else if (preset.id === 'drift-bloom') {
      score += (1 - Math.abs(durationNorm - 0.72)) * 0.24 + brightness * 0.16 + (1 - transientDensity) * 0.14;
    }

    return { preset, score };
  }).sort((left, right) => right.score - left.score);

  return {
    presetId: ranked[0]?.preset.id ?? null,
    presetLabel: ranked[0]?.preset.label ?? 'Stock voice',
  };
};

const buildReason = (
  type: InstrumentType,
  pitchHz: number | null,
  brightness: number,
  durationSeconds: number,
  transientDensity: number,
  presetLabel: string,
) => {
  const pitchLabel = pitchHz ? `${pitchHz.toFixed(0)} Hz` : 'no stable pitch';
  const brightnessLabel = brightness > 0.68 ? 'bright' : brightness < 0.24 ? 'dark' : 'balanced';
  const durationLabel = durationSeconds > 1.6 ? 'longer sustain' : durationSeconds < 0.45 ? 'short burst' : 'medium phrase';
  const transientLabel = transientDensity > 0.72 ? 'sharp attack' : transientDensity < 0.18 ? 'soft edge' : 'steady pulse';
  return `${presetLabel} feels like the closest fit for ${type}: ${pitchLabel}, ${brightnessLabel} tone, ${durationLabel}, ${transientLabel}.`;
};

const buildSuggestionControls = (
  profile: TrackCaptureProfile,
  pitchCandidate: DetectedNoteCandidate | null,
  brightness: number,
  durationNorm: number,
  transientDensity: number,
): CaptureSuggestionControls => {
  const targetMidi = pitchCandidate?.midi ?? 60;
  const centerMidi = Math.round(exactMidiFromHz(profile.pitchCenter));
  const octaveShift = clamp(Math.round((targetMidi - centerMidi) / 12), -3, 3);
  const detune = clamp(pitchCandidate?.centsOff ?? 0, -180, 180);

  return {
    cutoff: clamp(profile.baseCutoff * (0.68 + (brightness * 0.9)), 120, 15000),
    detune: Number(detune.toFixed(1)),
    octaveShift,
    portamento: Number(clamp(profile.basePortamento + (durationNorm * 0.05) - (transientDensity * 0.05), 0, 0.2).toFixed(3)),
    resonance: Number(clamp(profile.baseResonance + ((brightness - 0.5) * 0.8) + (transientDensity * 0.32), 0.2, 12).toFixed(2)),
    reverbSend: Number(clamp(profile.baseReverb + (durationNorm * 0.18) - (transientDensity * 0.16), 0, 1).toFixed(2)),
  };
};

export const buildCaptureSuggestions = ({
  brightness,
  clarity,
  durationSeconds,
  pitchHz,
  rmsDb,
  transientDensity,
}: RecordingInsightInput): CaptureSuggestion[] => {
  const durationNorm = clamp(durationSeconds / 3.2, 0, 1);
  const loudnessNorm = clamp((rmsDb + 42) / 30, 0, 1);
  const pitchCandidate = buildDetectedNoteCandidates(pitchHz, clarity)[0] ?? null;

  return TRACK_CAPTURE_PROFILES
    .map((profile) => {
      const pitchDistance = pitchHz ? Math.log2(pitchHz / profile.pitchCenter) : null;
      const pitchScore = pitchDistance === null
        ? (1 - profile.pitchedAffinity)
        : gaussianScore(pitchDistance, profile.pitchSpread);
      const brightnessScore = 1 - Math.min(1, Math.abs(brightness - profile.brightness) / 0.85);
      const transientScore = 1 - Math.min(1, Math.abs(transientDensity - profile.transient) / 0.9);
      const durationScore = 1 - Math.min(1, Math.abs(durationNorm - profile.duration) / 0.8);
      const loudnessScore = 1 - Math.min(1, Math.abs(loudnessNorm - profile.loudness) / 0.9);
      const articulationBias = clamp((transientDensity * 0.72) + ((1 - durationNorm) * 0.28), 0, 1);
      const articulationScore = (articulationBias * (1 - profile.pitchedAffinity)) + ((1 - articulationBias) * profile.pitchedAffinity);
      const pitchWeight = 0.18 + ((1 - articulationBias) * 0.2);
      const score = (pitchScore * pitchWeight) + (brightnessScore * 0.16) + (transientScore * 0.18) + (durationScore * 0.14) + (loudnessScore * 0.08) + (clarity * 0.06) + (articulationScore * 0.18);
      const preset = choosePresetForTrack(profile.type, brightness, durationNorm, transientDensity);
      const controls = buildSuggestionControls(profile, pitchCandidate, brightness, durationNorm, transientDensity);

      return {
        confidence: buildConfidence(score, clarity, pitchCandidate?.centsOff ?? 0),
        controls,
        note: pitchCandidate?.note ?? null,
        presetId: preset.presetId,
        presetLabel: preset.presetLabel,
        reason: buildReason(profile.type, pitchHz, brightness, durationSeconds, transientDensity, preset.presetLabel),
        score,
        trackType: profile.type,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score: _score, ...suggestion }) => suggestion);
};

export const buildRecordingInsights = ({
  brightness,
  clarity,
  durationSeconds,
  pitchHz,
  rmsDb,
  transientDensity,
}: RecordingInsightInput) => {
  const noteCandidates = buildDetectedNoteCandidates(pitchHz, clarity);
  const suggestions = buildCaptureSuggestions({ brightness, clarity, durationSeconds, pitchHz, rmsDb, transientDensity });
  const primarySuggestion = suggestions[0] ?? null;

  return {
    noteCandidates,
    primarySuggestion,
    suggestions,
  };
};

export const analyzeCaptureFrame = ({
  durationSeconds,
  sampleRate,
  samples,
}: {
  durationSeconds: number;
  sampleRate: number;
  samples: Float32Array;
}): LiveCaptureFrame => {
  const rms = rmsOf(samples);
  const rmsDb = linearToDb(rms);
  const brightness = brightnessOf(samples);
  const transientDensity = transientDensityOf(samples);
  const pitchDetection = detectFundamentalHz(samples, sampleRate);
  const insights = buildRecordingInsights({
    brightness,
    clarity: pitchDetection.clarity,
    durationSeconds,
    pitchHz: pitchDetection.pitchHz,
    rmsDb,
    transientDensity,
  });

  return {
    brightness,
    clarity: pitchDetection.clarity,
    detectedNote: insights.noteCandidates[0]?.note ?? null,
    detectedPitchHz: pitchDetection.pitchHz,
    durationSeconds,
    noteCandidates: insights.noteCandidates,
    rmsDb,
    signalLevel: rmsDbToSignalLevel(rmsDb),
    suggestions: insights.suggestions,
    transientDensity,
  };
};

const detectPitchInWindow = (samples: Float32Array, sampleRate: number): WindowPitchCandidate | null => {
  if (samples.length < 1024) {
    return null;
  }

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const buffer = new Float32Array(samples.length);
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const window = 0.5 - (0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, samples.length - 1)));
    const value = (samples[index] - mean) * window;
    buffer[index] = value;
    energy += value * value;
  }

  if (energy <= 1e-6) {
    return null;
  }

  const minLag = Math.floor(sampleRate / 2000);
  const maxLag = Math.min(Math.floor(sampleRate / 50), buffer.length - 2);
  if (maxLag <= minLag) {
    return null;
  }

  let bestLag = -1;
  let bestScore = 0;
  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let acc = 0;
    let normLeft = 0;
    let normRight = 0;
    for (let index = 0; index < buffer.length - lag; index += 1) {
      const left = buffer[index];
      const right = buffer[index + lag];
      acc += left * right;
      normLeft += left * left;
      normRight += right * right;
    }

    const normalized = normLeft > 0 && normRight > 0
      ? acc / Math.sqrt(normLeft * normRight)
      : 0;
    scores.push(normalized);
    if (normalized > bestScore) {
      bestScore = normalized;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestScore < 0.22) {
    return null;
  }

  const threshold = Math.max(0.22, bestScore * 0.9);
  let resolvedLag = bestLag;
  for (let index = 1; index < scores.length - 1; index += 1) {
    const previous = scores[index - 1];
    const current = scores[index];
    const next = scores[index + 1];
    if (current >= threshold && current >= previous && current >= next) {
      resolvedLag = minLag + index;
      break;
    }
  }

  const resolvedIndex = resolvedLag - minLag;
  const leftScore = scores[resolvedIndex - 1] ?? scores[resolvedIndex] ?? bestScore;
  const centerScore = scores[resolvedIndex] ?? bestScore;
  const rightScore = scores[resolvedIndex + 1] ?? scores[resolvedIndex] ?? bestScore;
  const curvature = leftScore - (2 * centerScore) + rightScore;
  const interpolation = Math.abs(curvature) > 1e-6
    ? clamp(0.5 * (leftScore - rightScore) / curvature, -0.5, 0.5)
    : 0;
  const refinedLag = resolvedLag + interpolation;

  return {
    clarity: clamp(bestScore, 0, 1),
    energy: Math.sqrt(energy / buffer.length),
    pitchHz: sampleRate / refinedLag,
  };
};

const buildPitchWindows = (samples: Float32Array, start: number, end: number) => {
  const trimmedLength = (end - start) + 1;
  if (trimmedLength < 1024) {
    return [];
  }

  const windowSize = Math.min(trimmedLength, Math.max(2048, Math.min(8192, Math.floor(trimmedLength * 0.6))));
  const offsets = Array.from(new Set([
    start,
    Math.max(start, start + Math.floor((trimmedLength - windowSize) * 0.25)),
    Math.max(start, start + Math.floor((trimmedLength - windowSize) * 0.5)),
    Math.max(start, end - windowSize + 1),
  ])).sort((left, right) => left - right);

  return offsets.map((offset) => samples.subarray(offset, Math.min(samples.length, offset + windowSize)));
};

// Aggregate the strongest repeating pitch across a few windows so the capture can survive noisy attacks.
const detectFundamentalHz = (samples: Float32Array, sampleRate: number): PitchDetectionResult => {
  const SILENCE_THRESHOLD = 0.01;
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < SILENCE_THRESHOLD) start += 1;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < SILENCE_THRESHOLD) end -= 1;
  if (end - start < 1024) return { clarity: 0, pitchHz: null };

  const candidates = buildPitchWindows(samples, start, end)
    .map((window) => detectPitchInWindow(window, sampleRate))
    .filter((candidate): candidate is WindowPitchCandidate => candidate !== null);

  if (candidates.length === 0) {
    return { clarity: 0, pitchHz: null };
  }

  const clusters: Array<{ clarityWeighted: number; pitchWeighted: number; totalWeight: number }> = [];
  candidates
    .sort((left, right) => left.pitchHz - right.pitchHz)
    .forEach((candidate) => {
      const weight = Math.max(0.08, candidate.clarity * clamp(candidate.energy * 6, 0.25, 1));
      const cluster = clusters.find((entry) => {
        const centerHz = entry.pitchWeighted / Math.max(entry.totalWeight, 0.0001);
        return Math.abs(Math.log2(candidate.pitchHz / centerHz)) <= 0.055;
      });

      if (cluster) {
        cluster.clarityWeighted += candidate.clarity * weight;
        cluster.pitchWeighted += candidate.pitchHz * weight;
        cluster.totalWeight += weight;
        return;
      }

      clusters.push({
        clarityWeighted: candidate.clarity * weight,
        pitchWeighted: candidate.pitchHz * weight,
        totalWeight: weight,
      });
    });

  const bestCluster = clusters.sort((left, right) => right.totalWeight - left.totalWeight)[0];
  if (!bestCluster) {
    return { clarity: 0, pitchHz: null };
  }

  return {
    clarity: clamp(bestCluster.clarityWeighted / Math.max(bestCluster.totalWeight, 0.0001), 0, 1),
    pitchHz: bestCluster.pitchWeighted / Math.max(bestCluster.totalWeight, 0.0001),
  };
};

export class AudioRecorder {
  private liveAnimationFrame: number | null = null;
  private liveAnalyser: AnalyserNode | null = null;
  private liveAudioContext: AudioContext | null = null;
  private liveBuffer: Float32Array | null = null;
  private liveListener: ((frame: LiveCaptureFrame) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private lastLiveEmitAt = 0;
  private stream: MediaStream | null = null;
  private startedAt = 0;

  public onLiveUpdate(listener: ((frame: LiveCaptureFrame) => void) | null): void {
    this.liveListener = listener;
  }

  private emitLiveFrame = () => {
    const analyser = this.liveAnalyser;
    const audioContext = this.liveAudioContext;
    const buffer = this.liveBuffer;
    if (!analyser || !audioContext || !buffer) {
      return;
    }

    analyser.getFloatTimeDomainData(buffer);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastLiveEmitAt >= 90) {
      const frame = analyzeCaptureFrame({
        durationSeconds: Math.max(0.18, (Date.now() - this.startedAt) / 1000),
        sampleRate: audioContext.sampleRate,
        samples: buffer,
      });
      this.liveListener?.(frame);
      this.lastLiveEmitAt = now;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive' && typeof window !== 'undefined') {
      this.liveAnimationFrame = window.requestAnimationFrame(this.emitLiveFrame);
    }
  };

  private stopLiveAnalysis(): void {
    if (this.liveAnimationFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.liveAnimationFrame);
    }
    this.liveAnimationFrame = null;
    this.liveBuffer = null;
    this.lastLiveEmitAt = 0;

    if (this.liveAudioContext) {
      this.liveAudioContext.close().catch(() => {});
    }

    this.liveAnalyser = null;
    this.liveAudioContext = null;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof MediaRecorder !== 'undefined';
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Recording is not supported in this browser.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    this.mediaRecorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start();
    this.startedAt = Date.now();

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(this.stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.18;
      source.connect(analyser);
      this.liveAudioContext = audioContext;
      this.liveAnalyser = analyser;
      this.liveBuffer = new Float32Array(analyser.fftSize);
      this.lastLiveEmitAt = 0;

      if (typeof window !== 'undefined') {
        this.liveAnimationFrame = window.requestAnimationFrame(this.emitLiveFrame);
      }
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('SonicStudio: live capture analysis unavailable', error);
      }
    }
  }

  public async stop(): Promise<RecordingResult> {
    const recorder = this.mediaRecorder;
    if (!recorder) throw new Error('Not currently recording.');
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      recorder.onerror = (event) => reject(event);
    });
    recorder.stop();
    const blob = await done;
    this.stopLiveAnalysis();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    const durationSeconds = (Date.now() - this.startedAt) / 1000;

    // Decode and analyze
    let detectedPitchHz: number | null = null;
    let detectedNote: string | null = null;
    let brightness = 0;
    let clarity = 0;
    let noteCandidates: DetectedNoteCandidate[] = [];
    let rmsDb = -Infinity;
    let suggestions: CaptureSuggestion[] = [];
    let transientDensity = 0;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const frame = analyzeCaptureFrame({
        durationSeconds,
        sampleRate: audioBuffer.sampleRate,
        samples: audioBuffer.getChannelData(0),
      });
      brightness = frame.brightness;
      clarity = frame.clarity;
      detectedPitchHz = frame.detectedPitchHz;
      detectedNote = frame.detectedNote;
      noteCandidates = frame.noteCandidates;
      rmsDb = frame.rmsDb;
      suggestions = frame.suggestions;
      transientDensity = frame.transientDensity;
      audioCtx.close().catch(() => {});
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('SonicStudio: analysis failed', error);
      }
    }

    const primarySuggestion = suggestions[0] ?? buildCaptureSuggestions({
      brightness,
      clarity,
      durationSeconds,
      pitchHz: detectedPitchHz,
      rmsDb,
      transientDensity,
    })[0] ?? {
      confidence: 0.2,
      controls: {
        cutoff: 2400,
        detune: 0,
        octaveShift: 0,
        portamento: 0.04,
        resonance: 1.2,
        reverbSend: 0.18,
      },
      note: detectedNote,
      presetId: null,
      presetLabel: 'Stock voice',
      reason: 'Fallback capture suggestion.',
      trackType: 'lead' as InstrumentType,
    };

    return {
      blob,
      brightness,
      clarity,
      durationSeconds,
      detectedPitchHz,
      detectedNote,
      noteCandidates,
      rmsDb,
      suggestions,
      suggestedTrackType: primarySuggestion.trackType,
      reason: primarySuggestion.reason,
      transientDensity,
    };
  }

  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* ignore */ }
    }
    this.stopLiveAnalysis();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
