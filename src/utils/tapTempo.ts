// Tap-tempo math.
//
// Given a list of tap timestamps (milliseconds, oldest to newest), work
// out the implied BPM from the average interval between taps. Kept pure
// and separate from the button so the timing logic can be unit tested
// without a DOM.

export const TAP_TEMPO_MIN_BPM = 40;
export const TAP_TEMPO_MAX_BPM = 240;
// Taps spaced further apart than this start a fresh measurement — a
// long pause means the user is counting in a new tempo, not the same one.
export const TAP_TEMPO_RESET_GAP_MS = 2000;

/**
 * Drop any taps that sit on the far side of a reset-length gap, keeping
 * only the most recent contiguous run. Returns the trimmed list so the
 * caller can persist it for the next tap.
 */
export const trimTapRun = (taps: number[], resetGapMs = TAP_TEMPO_RESET_GAP_MS): number[] => {
  if (taps.length === 0) return [];
  const sorted = [...taps].sort((a, b) => a - b);
  const run: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] > resetGapMs) {
      // Gap too large: restart the run at this tap.
      run.length = 0;
    }
    run.push(sorted[i]);
  }
  return run;
};

/**
 * Compute BPM from a contiguous run of tap timestamps. Returns null when
 * there are fewer than two taps (no interval to measure). The result is
 * clamped to the studio's tempo range and rounded to a whole number.
 */
export const bpmFromTaps = (taps: number[]): number | null => {
  if (taps.length < 2) return null;
  const sorted = [...taps].sort((a, b) => a - b);
  const totalSpan = sorted[sorted.length - 1] - sorted[0];
  const intervals = sorted.length - 1;
  const averageMs = totalSpan / intervals;
  if (averageMs <= 0) return null;
  const rawBpm = 60000 / averageMs;
  const clamped = Math.max(TAP_TEMPO_MIN_BPM, Math.min(TAP_TEMPO_MAX_BPM, rawBpm));
  return Math.round(clamped);
};
