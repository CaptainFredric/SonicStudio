// Monophonic pitch detection (YIN).
//
// Both the live Capture analyzer and the Song Transcriber used to roll
// their own autocorrelation pitch finders. Plain autocorrelation is
// cheap but slips an octave easily (it dips just as hard at twice the
// true period) and gives up on quiet or breathy input. This is a shared
// YIN detector (de Cheveigne & Kawahara, 2002): the cumulative mean
// normalized difference function is far more robust against octave
// errors and reports a usable confidence, so capture and transcription
// both read pitch more naturally and accurately from one tested core.

export interface PitchReading {
  /** Detected fundamental in Hz. */
  hz: number;
  /** 0..1 periodicity confidence (1 - aperiodicity at the chosen lag). */
  clarity: number;
}

export interface PitchDetectionOptions {
  minHz?: number;
  maxHz?: number;
  /** YIN absolute threshold. Lower = stricter (cleaner tones only). */
  threshold?: number;
  /** RMS below this is treated as silence and returns null. */
  silenceRms?: number;
}

const DEFAULTS = {
  minHz: 50,
  maxHz: 2500,
  threshold: 0.15,
  silenceRms: 0.005,
};

const rms = (samples: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
};

/**
 * Estimate the fundamental pitch of a (roughly monophonic) frame using
 * YIN. Returns null for silence or when no confident period is found.
 */
export const detectPitchYin = (
  samples: Float32Array,
  sampleRate: number,
  options: PitchDetectionOptions = {},
): PitchReading | null => {
  const minHz = options.minHz ?? DEFAULTS.minHz;
  const maxHz = options.maxHz ?? DEFAULTS.maxHz;
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const silenceRms = options.silenceRms ?? DEFAULTS.silenceRms;

  if (samples.length < 256) return null;
  if (rms(samples) < silenceRms) return null;

  // The difference function compares the first half of the frame against
  // lagged copies, so the largest lag we can test is half the frame.
  const halfLength = Math.floor(samples.length / 2);
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(halfLength - 1, Math.ceil(sampleRate / minHz));
  if (maxTau <= minTau) return null;

  // 1. Difference function d(tau).
  const diff = new Float32Array(maxTau + 1);
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let j = 0; j < halfLength; j += 1) {
      const delta = samples[j] - samples[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2. Cumulative mean normalized difference d'(tau).
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[minTau] = 1;
  let runningSum = 0;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * (tau - minTau + 1)) / runningSum : 1;
  }

  // 3. Absolute threshold: take the first tau that dips below threshold,
  //    then walk down to the local minimum of that dip. Falls back to the
  //    global minimum if nothing crosses the threshold.
  let chosenTau = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      chosenTau = tau;
      break;
    }
  }
  if (chosenTau === -1) {
    let best = minTau;
    for (let tau = minTau + 1; tau <= maxTau; tau += 1) {
      if (cmnd[tau] < cmnd[best]) best = tau;
    }
    chosenTau = best;
    // No dip crossed the threshold: only accept a strongly periodic global
    // minimum, otherwise this frame is effectively unpitched.
    if (cmnd[chosenTau] > 0.6) return null;
  }

  // 4. Parabolic interpolation around the chosen lag for sub-sample accuracy.
  const x0 = chosenTau > minTau ? chosenTau - 1 : chosenTau;
  const x2 = chosenTau + 1 <= maxTau ? chosenTau + 1 : chosenTau;
  let betterTau = chosenTau;
  if (x0 !== chosenTau && x2 !== chosenTau) {
    const s0 = cmnd[x0];
    const s1 = cmnd[chosenTau];
    const s2 = cmnd[x2];
    const denominator = s0 + s2 - 2 * s1;
    if (Math.abs(denominator) > 1e-9) {
      betterTau = chosenTau + (s0 - s2) / (2 * denominator);
    }
  }

  if (betterTau <= 0) return null;
  return {
    hz: sampleRate / betterTau,
    clarity: Math.max(0, Math.min(1, 1 - cmnd[chosenTau])),
  };
};
