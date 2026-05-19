// Audio-to-notes transcription.
//
// This is the first working slice of an ambitious feature: drop in a
// recording (humming, singing, whistling, a solo instrument, or a full
// song) and the studio lays the melody onto the note grid so you can edit
// it like any other pattern.
//
// How accurate is it?
//   - Monophonic input (humming, singing, a single lead line) transcribes
//     well: the pitch tracker locks onto one fundamental at a time.
//   - Dense polyphonic mixes (a finished song with drums + chords + vocals)
//     are followed best-effort. The tracker reports the most prominent
//     pitch per moment, which approximates the lead melody rather than
//     reproducing every instrument. The result flags this so the UI can
//     tell the user honestly.
//
// The polyphonic / multi-instrument path (separating stems, transcribing
// chords and drums independently) is intentionally left as an extension
// point — see `EXTENSION` notes below. The note model, quantization, and
// session assembly here are shared by both paths.

import {
  createArrangerClip,
  createProjectFromTemplate,
  createStepEvent,
  createTrack,
  type InstrumentType,
  type Project,
  type StudioSession,
  type TransportMode,
  type TransportSettings,
} from '../project/schema';

// --- Tunable analysis constants -------------------------------------------

/** Mono analysis rate. 12 kHz stays cheap for autocorrelation while
 *  resolving the higher register a violin or whistled line reaches —
 *  8 kHz could not track a clean fundamental that far up. */
const TARGET_RATE = 12000;
/** Analysis window length in samples (~128 ms at 12 kHz). */
const WINDOW = 1536;
/** Hop between analysis frames in samples (~40 ms at 12 kHz). */
const HOP = 480;
/** Lowest / highest fundamentals the tracker will report. MAX_HZ ~1760
 *  reaches A6, covering the violin's working range. */
const MIN_HZ = 65;
const MAX_HZ = 1760;
/** RMS below this is treated as silence (no pitch). */
const SILENCE_RMS = 0.012;
/** Longest input we will analyze, to keep the pass interactive. */
const MAX_INPUT_SECONDS = 150;
/** Caps mirrored from the MIDI importer so sessions stay in range. */
const MAX_TOTAL_STEPS = 1024;
const MAX_NOTES = 600;

export interface TranscriptionNote {
  /** MIDI note number (60 = middle C). */
  midi: number;
  /** Note name, e.g. "C4". */
  note: string;
  /** Quantized 16th-note grid position from the start of the take. */
  startStep: number;
  /** Quantized length in 16th-note steps (>= 1). */
  durationSteps: number;
  /** Loudness-derived velocity, 0..1. */
  velocity: number;
}

export interface TranscriptionResult {
  notes: TranscriptionNote[];
  /** Estimated tempo. The UI lets the user confirm or override this. */
  bpm: number;
  durationSeconds: number;
  /** Overall confidence in the pitch read, 0..1. */
  confidence: number;
  /** True when the input looks like a dense mix rather than a clean
   *  monophonic line — the transcription is then an approximation. */
  polyphonic: boolean;
  /** Short human-readable note about what was detected. */
  summary: string;
}

export interface TranscriptionOptions {
  /** Force a tempo instead of estimating one. */
  bpm?: number;
  /** Drop notes shorter than this many 16th steps. Defaults to 1. */
  minNoteSteps?: number;
}

// --- Small numeric helpers ------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToNoteName = (midi: number): string => {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
};

export const frequencyToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// --- Signal preparation ---------------------------------------------------

/** Average all channels of an AudioBuffer into one mono Float32Array. */
export const mixToMono = (buffer: AudioBuffer): Float32Array => {
  const { numberOfChannels, length } = buffer;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] / numberOfChannels;
    }
  }
  return mono;
};

/** Cheap linear-interpolation downsampler. Good enough for pitch tracking. */
export const downsample = (
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array => {
  if (toRate >= fromRate) {
    return samples;
  }
  const ratio = fromRate / toRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const sourceIndex = i * ratio;
    const low = Math.floor(sourceIndex);
    const high = Math.min(samples.length - 1, low + 1);
    const fraction = sourceIndex - low;
    out[i] = samples[low] * (1 - fraction) + samples[high] * fraction;
  }
  return out;
};

// --- Pitch detection ------------------------------------------------------

interface FrameAnalysis {
  /** Detected fundamental in MIDI (float), or null when unvoiced. */
  midi: number | null;
  /** Root-mean-square loudness of the frame. */
  rms: number;
}

/**
 * Autocorrelation pitch detector. Returns the fundamental in Hz, or -1 when
 * the frame is silent or has no clear pitch. Only the lag range that maps to
 * MIN_HZ..MAX_HZ is scanned, which keeps the pass fast.
 */
export const detectPitchHz = (frame: Float32Array, sampleRate: number): number => {
  let rms = 0;
  for (let i = 0; i < frame.length; i += 1) {
    rms += frame[i] * frame[i];
  }
  rms = Math.sqrt(rms / frame.length);
  if (rms < SILENCE_RMS) {
    return -1;
  }

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(frame.length - 1, Math.ceil(sampleRate / MIN_HZ));

  let bestLag = -1;
  let bestCorrelation = 0;
  let previous = 0;
  let ascending = false;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    for (let i = 0; i < frame.length - lag; i += 1) {
      correlation += frame[i] * frame[i + lag];
    }
    // Take the first strong local maximum after the correlation starts
    // rising — that is the fundamental, not a louder harmonic multiple.
    if (correlation > previous) {
      ascending = true;
    } else if (ascending && correlation < previous && previous > bestCorrelation) {
      bestCorrelation = previous;
      bestLag = lag - 1;
      ascending = false;
    }
    previous = correlation;
  }

  if (bestLag < 0) {
    return -1;
  }

  // Reject weak peaks: require the peak to hold a reasonable share of the
  // zero-lag energy so noise frames do not produce phantom pitches.
  let energy = 0;
  for (let i = 0; i < frame.length; i += 1) {
    energy += frame[i] * frame[i];
  }
  if (energy <= 0 || bestCorrelation / energy < 0.3) {
    return -1;
  }

  // Parabolic interpolation around the peak for sub-sample accuracy.
  const refine = (lag: number): number => {
    if (lag <= minLag || lag >= maxLag) return lag;
    const score = (l: number) => {
      let sum = 0;
      for (let i = 0; i < frame.length - l; i += 1) {
        sum += frame[i] * frame[i + l];
      }
      return sum;
    };
    const left = score(lag - 1);
    const center = score(lag);
    const right = score(lag + 1);
    const denominator = left + right - 2 * center;
    if (denominator === 0) return lag;
    return lag - (right - left) / (2 * denominator);
  };

  const refinedLag = refine(bestLag);
  return sampleRate / refinedLag;
};

/** Run the pitch detector across the whole signal, frame by frame. */
const analyzeFrames = (samples: Float32Array, sampleRate: number): FrameAnalysis[] => {
  const frames: FrameAnalysis[] = [];
  for (let start = 0; start + WINDOW <= samples.length; start += HOP) {
    const frame = samples.subarray(start, start + WINDOW);
    let rms = 0;
    for (let i = 0; i < frame.length; i += 1) {
      rms += frame[i] * frame[i];
    }
    rms = Math.sqrt(rms / frame.length);

    const hz = detectPitchHz(frame, sampleRate);
    frames.push({
      midi: hz > 0 ? frequencyToMidi(hz) : null,
      rms,
    });
  }
  return frames;
};

/** Median-smooth the pitch track to remove single-frame jumps and octave slips. */
const smoothPitchTrack = (frames: FrameAnalysis[]): FrameAnalysis[] => {
  const radius = 1;
  return frames.map((frame, index) => {
    if (frame.midi === null) return frame;
    const window: number[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      const neighbour = frames[index + offset];
      if (neighbour && neighbour.midi !== null) {
        window.push(neighbour.midi);
      }
    }
    return { midi: median(window), rms: frame.rms };
  });
};

// --- Tempo estimation -----------------------------------------------------

/**
 * Estimate tempo by autocorrelating the onset-strength envelope. Returns a
 * BPM folded into a musical range, plus a rough confidence.
 */
export const estimateTempo = (frames: FrameAnalysis[], hopSeconds: number): { bpm: number; confidence: number } => {
  if (frames.length < 8) {
    return { bpm: 120, confidence: 0 };
  }

  // Onset strength: positive jumps in loudness frame to frame.
  const onset = new Float32Array(frames.length);
  for (let i = 1; i < frames.length; i += 1) {
    onset[i] = Math.max(0, frames[i].rms - frames[i - 1].rms);
  }

  const minLag = Math.max(2, Math.floor(0.25 / hopSeconds)); // ~240 BPM beat
  const maxLag = Math.min(frames.length - 1, Math.ceil(1.0 / hopSeconds)); // ~60 BPM beat

  let bestLag = -1;
  let bestScore = 0;
  let zeroLagEnergy = 0;
  for (let i = 0; i < onset.length; i += 1) {
    zeroLagEnergy += onset[i] * onset[i];
  }

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let i = 0; i < onset.length - lag; i += 1) {
      score += onset[i] * onset[i + lag];
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag < 0) {
    return { bpm: 120, confidence: 0 };
  }

  let beatSeconds = bestLag * hopSeconds;
  let bpm = 60 / beatSeconds;
  // Fold tempo octaves into a comfortable working range.
  while (bpm < 70) {
    bpm *= 2;
    beatSeconds /= 2;
  }
  while (bpm > 180) {
    bpm /= 2;
    beatSeconds *= 2;
  }

  const confidence = zeroLagEnergy > 0 ? clamp(bestScore / zeroLagEnergy, 0, 1) : 0;
  return { bpm: Math.round(bpm), confidence };
};

// --- Note segmentation ----------------------------------------------------

interface RawNote {
  midi: number;
  startSeconds: number;
  durationSeconds: number;
  velocity: number;
}

/** Group a smoothed pitch track into discrete notes. */
const segmentNotes = (frames: FrameAnalysis[], hopSeconds: number): RawNote[] => {
  const notes: RawNote[] = [];
  let current: { startFrame: number; midis: number[]; rmsValues: number[] } | null = null;

  const commit = (endFrame: number) => {
    if (!current) return;
    const noteMidi = Math.round(median(current.midis));
    const startSeconds = current.startFrame * hopSeconds;
    const durationSeconds = Math.max(hopSeconds, (endFrame - current.startFrame) * hopSeconds);
    const avgRms = current.rmsValues.reduce((sum, value) => sum + value, 0) / current.rmsValues.length;
    // Map loudness onto a musical velocity range.
    const velocity = clamp(0.5 + avgRms * 2.2, 0.35, 1);
    notes.push({ midi: noteMidi, startSeconds, durationSeconds, velocity });
    current = null;
  };

  frames.forEach((frame, index) => {
    if (frame.midi === null) {
      commit(index);
      return;
    }
    if (!current) {
      current = { startFrame: index, midis: [frame.midi], rmsValues: [frame.rms] };
      return;
    }
    // A shift of more than ~0.7 semitones from the running pitch starts a
    // fresh note rather than bending the existing one.
    const runningMidi = median(current.midis);
    if (Math.abs(frame.midi - runningMidi) > 0.7) {
      commit(index);
      current = { startFrame: index, midis: [frame.midi], rmsValues: [frame.rms] };
      return;
    }
    current.midis.push(frame.midi);
    current.rmsValues.push(frame.rms);
  });
  commit(frames.length);

  return notes;
};

// --- Core transcription ---------------------------------------------------

/**
 * Transcribe a mono signal. Exposed separately from `transcribeAudioBuffer`
 * so it can be unit tested with synthetic tones (no Web Audio needed).
 */
export const transcribeSamples = (
  samples: Float32Array,
  sampleRate: number,
  options: TranscriptionOptions = {},
): TranscriptionResult => {
  const limitedLength = Math.min(samples.length, MAX_INPUT_SECONDS * sampleRate);
  const limited = samples.subarray(0, limitedLength);
  const mono = downsample(limited, sampleRate, TARGET_RATE);
  const workingRate = sampleRate > TARGET_RATE ? TARGET_RATE : sampleRate;
  const hopSeconds = HOP / workingRate;
  const durationSeconds = limited.length / sampleRate;

  const rawFrames = analyzeFrames(mono, workingRate);
  const frames = smoothPitchTrack(rawFrames);

  // Confidence + polyphony heuristic. A clean monophonic take holds a steady
  // pitch; a dense mix makes the tracker jump around.
  const voiced = frames.filter((frame) => frame.midi !== null);
  const voicedFraction = frames.length > 0 ? voiced.length / frames.length : 0;
  let stableTransitions = 0;
  let totalTransitions = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const previous = frames[i - 1].midi;
    const next = frames[i].midi;
    if (previous !== null && next !== null) {
      totalTransitions += 1;
      if (Math.abs(previous - next) < 1) {
        stableTransitions += 1;
      }
    }
  }
  const stability = totalTransitions > 0 ? stableTransitions / totalTransitions : 0;
  const polyphonic = voicedFraction > 0.25 && stability < 0.55;
  const confidence = clamp(voicedFraction * 0.45 + stability * 0.55, 0, 1);

  const tempo = options.bpm
    ? { bpm: options.bpm, confidence: 1 }
    : estimateTempo(frames, hopSeconds);
  const bpm = clamp(Math.round(tempo.bpm), 40, 220);

  const rawNotes = segmentNotes(frames, hopSeconds);

  // Quantize to a 16th-note grid at the working tempo.
  const stepSeconds = 60 / bpm / 4;
  const minNoteSteps = Math.max(1, Math.round(options.minNoteSteps ?? 1));
  const notes: TranscriptionNote[] = [];
  for (const raw of rawNotes) {
    const startStep = Math.round(raw.startSeconds / stepSeconds);
    const durationSteps = Math.max(minNoteSteps, Math.round(raw.durationSeconds / stepSeconds));
    if (raw.durationSeconds < stepSeconds * 0.6) {
      continue; // too short to be a real note after quantizing
    }
    notes.push({
      midi: raw.midi,
      note: midiToNoteName(raw.midi),
      startStep,
      durationSteps,
      velocity: Number(raw.velocity.toFixed(2)),
    });
    if (notes.length >= MAX_NOTES) {
      break;
    }
  }

  const summary = notes.length === 0
    ? 'No clear pitched notes were found. Try a louder, cleaner take.'
    : polyphonic
      ? `Followed the most prominent melody line across a dense mix — ${notes.length} notes.`
      : `Transcribed ${notes.length} notes from a clean monophonic take.`;

  return {
    notes,
    bpm,
    durationSeconds,
    confidence,
    polyphonic,
    summary,
  };
};

/** Transcribe a decoded AudioBuffer (the entry point used by the UI). */
export const transcribeAudioBuffer = (
  buffer: AudioBuffer,
  options: TranscriptionOptions = {},
): TranscriptionResult => transcribeSamples(mixToMono(buffer), buffer.sampleRate, options);

// --- Session assembly -----------------------------------------------------

/** Pick a sensible synth voice for the transcribed line from its register. */
const inferMelodyTrackType = (notes: TranscriptionNote[]): InstrumentType => {
  if (notes.length === 0) return 'lead';
  const averageMidi = notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
  if (averageMidi < 48) return 'bass';
  if (averageMidi > 84) return 'violin';
  if (averageMidi > 74) return 'lead';
  return 'pluck';
};

/**
 * Turn a transcription into a loadable studio session. Mirrors the MIDI
 * importer's session shape so the rest of the app treats it identically.
 *
 * EXTENSION: a polyphonic transcriber would produce several note groups
 * here (lead, chords, bass, drums) and emit one track per group instead of
 * the single melodic track below.
 */
export const buildSessionFromTranscription = (
  result: TranscriptionResult,
  projectName: string,
): StudioSession => {
  const base = createProjectFromTemplate('blank-grid');

  const maxStep = result.notes.reduce(
    (max, note) => Math.max(max, note.startStep + note.durationSteps),
    16,
  );
  const totalSteps = Math.min(MAX_TOTAL_STEPS, Math.max(16, maxStep));
  const stepsPerPattern = totalSteps <= 16 ? 16 : totalSteps <= 32 ? 32 : 64;
  const patternCount = Math.max(1, Math.min(8, Math.ceil(totalSteps / stepsPerPattern)));
  const mode: TransportMode = totalSteps > stepsPerPattern ? 'SONG' : 'PATTERN';

  const trackType = inferMelodyTrackType(result.notes);
  const track = createTrack(trackType, {
    name: 'Transcribed melody',
    patternCount,
    stepsPerPattern,
  });

  for (const note of result.notes) {
    const absoluteStep = note.startStep;
    if (absoluteStep >= patternCount * stepsPerPattern) {
      continue;
    }
    const patternIndex = Math.floor(absoluteStep / stepsPerPattern);
    const stepIndex = absoluteStep % stepsPerPattern;
    const gate = clamp(note.durationSteps, 0.125, 4);
    track.patterns[patternIndex][stepIndex].push(
      createStepEvent(note.note, { gate, velocity: note.velocity }),
    );
  }

  const transportLike: TransportSettings = {
    bpm: result.bpm,
    countInBars: 0,
    currentPattern: 0,
    metronomeEnabled: false,
    mode,
    patternCount,
    stepsPerPattern,
  };

  const arrangerClips = mode === 'SONG'
    ? Array.from({ length: patternCount }, (_, patternIndex) => {
        const hasEvents = track.patterns[patternIndex]?.some((step) => step.length > 0);
        return hasEvents
          ? createArrangerClip(track.id, transportLike, {
              beatLength: stepsPerPattern,
              patternIndex,
              startBeat: patternIndex * stepsPerPattern,
            })
          : null;
      }).filter((clip): clip is ReturnType<typeof createArrangerClip> => clip !== null)
    : [createArrangerClip(track.id, transportLike, {
        beatLength: stepsPerPattern,
        patternIndex: 0,
        startBeat: 0,
      })];

  const project: Project = {
    ...base,
    arrangerClips,
    bounceHistory: [],
    markers: mode === 'SONG'
      ? Array.from({ length: patternCount }, (_, index) => ({
          beat: index * stepsPerPattern,
          id: `marker_${index}_${Date.now()}`,
          name: `Section ${index + 1}`,
        }))
      : [],
    metadata: {
      ...base.metadata,
      name: projectName.trim() || 'Transcribed take',
      updatedAt: new Date().toISOString(),
    },
    tracks: [track],
    transport: {
      ...base.transport,
      bpm: result.bpm,
      currentPattern: 0,
      mode,
      patternCount,
      stepsPerPattern,
    },
  };

  return {
    project,
    ui: {
      activeView: 'PIANO_ROLL',
      isSettingsOpen: false,
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      pinnedTrackIds: [],
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      selectedTrackId: track.id,
    },
  };
};
