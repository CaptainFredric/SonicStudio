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
  MAX_PATTERN_COUNT,
  resizeTrackPatterns,
  type InstrumentType,
  type Project,
  type StudioSession,
  type TransportMode,
  type TransportSettings,
} from '../project/schema';
import { detectPitchYin } from '../utils/pitchDetection';

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
  /**
   * 0..1. Higher catches quieter / breathier notes; lower rejects more
   * as noise. Maps to the YIN threshold and the silence floor. Default
   * 0.5 (balanced).
   */
  sensitivity?: number;
}

// Translate a 0..1 sensitivity into detector parameters. Higher
// sensitivity loosens the YIN threshold (accepts less-periodic frames)
// and lowers the silence floor (picks up quieter takes).
const sensitivityToPitchOptions = (
  sensitivity: number,
): { threshold: number; silenceRms: number; clarityFloor: number } => {
  const s = clamp(sensitivity, 0, 1);
  return {
    threshold: 0.10 + s * 0.14, // 0.10 (strict) .. 0.24 (permissive)
    silenceRms: 0.02 - s * 0.015, // 0.02 (ignores quiet) .. 0.005 (hears quiet)
    // Reject fuzzy, barely-periodic frames so noise and reverb tails do not
    // spawn phantom notes. Higher sensitivity keeps more of the marginal ones.
    clarityFloor: 0.35 - s * 0.2, // 0.35 (strict) .. 0.15 (permissive)
  };
};

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
  // Average each input window down to one output sample. This box average is a
  // cheap anti-aliasing low-pass: plain interpolation would fold everything
  // above the new Nyquist (~6 kHz here) back into the pitch range, so bright
  // cymbals, sibilance, and room hiss became phantom pitches. Averaging the
  // window attenuates that content before it can alias, which matters most for
  // the "capture any nearby sound" case where the input is not a clean tone.
  for (let i = 0; i < outLength; i += 1) {
    const startF = i * ratio;
    const start = Math.floor(startF);
    const end = Math.max(start + 1, Math.min(samples.length, Math.ceil(startF + ratio)));
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += samples[j];
    }
    out[i] = sum / (end - start);
  }
  return out;
};

/**
 * One-pole high-pass to strip sub-sonic rumble (DC offset, handling thumps,
 * 50/60 Hz hum) below the lowest note we track. That energy sits under MIN_HZ
 * so it never becomes a note, but it inflates the YIN difference function at
 * every lag and drags clarity down, so removing it makes quiet, real-world
 * input read as more confidently pitched.
 */
export const highPassFilter = (
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array => {
  if (samples.length === 0) return samples;
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + dt);
  const out = new Float32Array(samples.length);
  let prevIn = samples[0];
  let prevOut = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    prevOut = alpha * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut;
  }
  return out;
};

// --- Pitch detection ------------------------------------------------------

export interface FrameAnalysis {
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
  // Delegates to the shared YIN detector. YIN's cumulative-mean-normalized
  // difference resists the octave slips and weak-frame phantoms the old
  // autocorrelation pass was prone to. -1 still means "no pitch here".
  const reading = detectPitchYin(frame, sampleRate, {
    minHz: MIN_HZ,
    maxHz: MAX_HZ,
    silenceRms: SILENCE_RMS,
    threshold: 0.15,
  });
  return reading ? reading.hz : -1;
};

/** Run the pitch detector across the whole signal, frame by frame. */
const analyzeFrames = (
  samples: Float32Array,
  sampleRate: number,
  pitchOptions: { threshold: number; silenceRms: number; clarityFloor: number },
): FrameAnalysis[] => {
  const frames: FrameAnalysis[] = [];
  for (let start = 0; start + WINDOW <= samples.length; start += HOP) {
    const frame = samples.subarray(start, start + WINDOW);
    let rms = 0;
    for (let i = 0; i < frame.length; i += 1) {
      rms += frame[i] * frame[i];
    }
    rms = Math.sqrt(rms / frame.length);

    const reading = detectPitchYin(frame, sampleRate, {
      minHz: MIN_HZ,
      maxHz: MAX_HZ,
      threshold: pitchOptions.threshold,
      silenceRms: pitchOptions.silenceRms,
    });
    // Treat barely-periodic frames as unvoiced so noise does not become notes.
    const voiced = reading !== null && reading.clarity >= pitchOptions.clarityFloor;
    frames.push({
      midi: voiced && reading ? frequencyToMidi(reading.hz) : null,
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

/**
 * Fold isolated octave errors back toward the surrounding pitch. Even with
 * YIN, a tracker occasionally reports a frame one octave off (the difference
 * function dips almost as hard at twice the true period). Those slips show up
 * as a jump of close to a whole number of octaves away from the local pitch,
 * so we fold them back. But if the shift *persists* for several frames we treat
 * it as a real octave move and let the running reference follow it, so genuine
 * octave leaps in a melody survive.
 */
export const correctOctaveJumps = (frames: FrameAnalysis[]): FrameAnalysis[] => {
  const REF_WINDOW = 7;
  const SUSTAIN_FRAMES = 4;
  const recent: number[] = []; // recent corrected midis, for a robust reference
  let lastShift = 0;
  let sustainCount = 0;

  return frames.map((frame) => {
    if (frame.midi === null) {
      return frame;
    }
    if (recent.length === 0) {
      recent.push(frame.midi);
      return frame;
    }

    const ref = median(recent);
    const dev = frame.midi - ref;
    const octaves = Math.round(dev / 12);
    const residual = Math.abs(dev - octaves * 12);
    // Only near-exact octave offsets look like slips; a fifth or sixth is a
    // real interval and must be left alone (residual stays large for those).
    const shift = octaves !== 0 && residual < 2 ? -octaves * 12 : 0;

    if (shift !== 0 && shift === lastShift) {
      sustainCount += 1;
    } else if (shift !== 0) {
      sustainCount = 1;
    } else {
      sustainCount = 0;
    }
    lastShift = shift;

    // Fold the slip back, unless it has held long enough to be a real move.
    const corrected = shift !== 0 && sustainCount < SUSTAIN_FRAMES ? frame.midi + shift : frame.midi;

    recent.push(corrected);
    if (recent.length > REF_WINDOW) {
      recent.shift();
    }
    return { midi: corrected, rms: frame.rms };
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

interface OpenNote {
  startFrame: number;
  lastVoicedFrame: number;
  midis: number[];
  rmsValues: number[];
  gap: number;
}

/**
 * Group a smoothed pitch track into discrete notes. A note is held through
 * very short unvoiced dropouts (a breath, a consonant, a vibrato dip) so a
 * single sustained tone does not shatter into a stutter of fragments; only a
 * gap longer than that, or a real pitch change, ends the note.
 */
export const segmentNotes = (frames: FrameAnalysis[], hopSeconds: number): RawNote[] => {
  const notes: RawNote[] = [];
  // Bridge unvoiced gaps up to ~90 ms; anything longer is treated as a rest.
  const maxGapFrames = Math.max(1, Math.round(0.09 / hopSeconds));
  // Drop notes that never sustain past ~60 ms of voiced signal: a lone voiced
  // frame is almost always a click, a consonant, or a reverb flicker rather
  // than a played note, and keeping them litters the transcription with stutter.
  const minVoicedFrames = Math.max(2, Math.round(0.06 / hopSeconds));
  let current: OpenNote | null = null;

  const commit = () => {
    if (!current) return;
    if (current.midis.length < minVoicedFrames) {
      current = null;
      return;
    }
    const noteMidi = Math.round(median(current.midis));
    const startSeconds = current.startFrame * hopSeconds;
    // End at the last voiced frame so a bridged trailing gap is not counted.
    const endFrame = current.lastVoicedFrame + 1;
    const durationSeconds = Math.max(hopSeconds, (endFrame - current.startFrame) * hopSeconds);
    const avgRms = current.rmsValues.reduce((sum, value) => sum + value, 0) / current.rmsValues.length;
    // Map loudness onto a musical velocity range.
    const velocity = clamp(0.5 + avgRms * 2.2, 0.35, 1);
    notes.push({ midi: noteMidi, startSeconds, durationSeconds, velocity });
    current = null;
  };

  frames.forEach((frame, index) => {
    if (frame.midi === null) {
      if (current) {
        current.gap += 1;
        if (current.gap > maxGapFrames) {
          commit();
        }
      }
      return;
    }
    if (!current) {
      current = { startFrame: index, lastVoicedFrame: index, midis: [frame.midi], rmsValues: [frame.rms], gap: 0 };
      return;
    }
    // A shift of more than ~0.7 semitones from the running pitch starts a
    // fresh note rather than bending the existing one.
    const runningMidi = median(current.midis);
    if (Math.abs(frame.midi - runningMidi) > 0.7) {
      commit();
      current = { startFrame: index, lastVoicedFrame: index, midis: [frame.midi], rmsValues: [frame.rms], gap: 0 };
      return;
    }
    current.midis.push(frame.midi);
    current.rmsValues.push(frame.rms);
    current.lastVoicedFrame = index;
    current.gap = 0;
  });
  commit();

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

  // Strip DC offset and sub-sonic rumble (cutoff sits below the lowest tracked
  // note at 65 Hz, so notes survive while floor noise does not).
  const conditioned = highPassFilter(mono, workingRate, 40);
  const rawFrames = analyzeFrames(conditioned, workingRate, sensitivityToPitchOptions(options.sensitivity ?? 0.5));
  // Fold octave slips back before smoothing, then median-smooth single-frame jitter.
  const frames = smoothPitchTrack(correctOctaveJumps(rawFrames));

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
      ? `Followed the most prominent melody line across a dense mix. ${notes.length} notes.`
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
export const inferMelodyTrackType = (notes: TranscriptionNote[]): InstrumentType => {
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
  const patternCount = Math.max(1, Math.min(MAX_PATTERN_COUNT, Math.ceil(totalSteps / stepsPerPattern)));
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
    const gate = clamp(note.durationSteps, 0.125, 8);
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
      activeView: 'SEQUENCER',
      isSettingsOpen: false,
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      pinnedTrackIds: [],
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      selectedTrackId: track.id,
    },
  };
};

export interface AppendTranscriptionOptions {
  laneName?: string;
  startPattern?: number;
}

export interface AppendedTranscription {
  addedPatternCount: number;
  placedNoteCount: number;
  session: StudioSession;
  startPattern: number;
  trackId: string;
}

/**
 * Add a transcription as a new lane without replacing any existing work.
 * The phrase begins at the chosen pattern and may extend the project's pattern
 * count, but never changes the established grid size or silently drops notes.
 */
export const appendTranscriptionToSession = (
  currentSession: StudioSession,
  result: TranscriptionResult,
  options: AppendTranscriptionOptions = {},
): AppendedTranscription | null => {
  if (result.notes.length === 0) {
    return null;
  }

  const { project } = currentSession;
  const stepsPerPattern = project.transport.stepsPerPattern;
  const startPattern = clamp(
    Math.round(options.startPattern ?? project.transport.currentPattern),
    0,
    project.transport.patternCount - 1,
  );
  const phraseStepCount = result.notes.reduce(
    (max, note) => Math.max(max, note.startStep + note.durationSteps),
    1,
  );
  const absoluteStartStep = startPattern * stepsPerPattern;
  const requiredPatternCount = Math.ceil((absoluteStartStep + phraseStepCount) / stepsPerPattern);

  if (requiredPatternCount > MAX_PATTERN_COUNT) {
    return null;
  }

  const patternCount = Math.max(project.transport.patternCount, requiredPatternCount);
  const transport: TransportSettings = {
    ...project.transport,
    patternCount,
  };
  const track = createTrack(inferMelodyTrackType(result.notes), {
    name: options.laneName?.trim() || 'Transcribed melody',
    patternCount,
    stepsPerPattern,
  });
  const usedPatternIndices = new Set<number>();

  for (const note of result.notes) {
    const absoluteStep = absoluteStartStep + note.startStep;
    const patternIndex = Math.floor(absoluteStep / stepsPerPattern);
    const stepIndex = absoluteStep % stepsPerPattern;
    const pattern = track.patterns[patternIndex];
    if (!pattern?.[stepIndex]) {
      return null;
    }

    pattern[stepIndex].push(createStepEvent(note.note, {
      gate: clamp(note.durationSteps, 0.125, 8),
      velocity: note.velocity,
    }));
    usedPatternIndices.add(patternIndex);
  }

  const addedClips = [...usedPatternIndices]
    .sort((left, right) => left - right)
    .map((patternIndex) => createArrangerClip(track.id, transport, {
      beatLength: stepsPerPattern,
      patternIndex,
      startBeat: patternIndex * stepsPerPattern,
    }));
  const nextProject: Project = {
    ...project,
    arrangementLength: Math.max(project.arrangementLength, requiredPatternCount * stepsPerPattern),
    arrangerClips: [...project.arrangerClips, ...addedClips],
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
    tracks: [
      ...project.tracks.map((candidate) => resizeTrackPatterns(candidate, patternCount, stepsPerPattern)),
      track,
    ],
    transport,
  };

  return {
    addedPatternCount: patternCount - project.transport.patternCount,
    placedNoteCount: result.notes.length,
    session: {
      project: nextProject,
      ui: {
        ...currentSession.ui,
        activeView: 'SEQUENCER',
        selectedArrangerClipId: addedClips[0]?.id ?? currentSession.ui.selectedArrangerClipId,
        selectedTrackId: track.id,
      },
    },
    startPattern,
    trackId: track.id,
  };
};
