// Waveform peak extraction.
//
// Downsamples a long array of audio samples (one channel, -1..1) into a
// small set of normalized peak magnitudes suitable for drawing a
// waveform strip. Pure and DOM-free so it can be unit tested and reused
// anywhere a waveform needs rendering (the transcriber preview today,
// recorded-audio lanes later).

/**
 * Reduce `samples` to `buckets` peak values in 0..1. Each bucket holds
 * the maximum absolute sample magnitude across its slice of the input,
 * then the whole set is normalized so the loudest bucket reads as 1.
 * Returns an array of length `buckets` (zeros for empty / silent input).
 */
export const extractPeaks = (samples: Float32Array | number[], buckets = 96): number[] => {
  const safeBuckets = Math.max(1, Math.floor(buckets));
  const peaks = new Array<number>(safeBuckets).fill(0);
  const length = samples.length;
  if (length === 0) return peaks;

  const perBucket = length / safeBuckets;
  for (let bucket = 0; bucket < safeBuckets; bucket += 1) {
    const start = Math.floor(bucket * perBucket);
    const end = Math.min(length, Math.floor((bucket + 1) * perBucket));
    let max = 0;
    for (let i = start; i < end; i += 1) {
      const magnitude = Math.abs(samples[i]);
      if (magnitude > max) max = magnitude;
    }
    peaks[bucket] = max;
  }

  // Normalize so the strip uses the full height regardless of how quiet
  // the take was recorded.
  const loudest = peaks.reduce((top, value) => (value > top ? value : top), 0);
  if (loudest > 0) {
    for (let i = 0; i < peaks.length; i += 1) {
      peaks[i] = peaks[i] / loudest;
    }
  }
  return peaks;
};
