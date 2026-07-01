import type { AudioStabilityMode } from '../project/preferences';

// How far ahead (in seconds) Tone schedules events before they sound.
//
// A larger window means notes are queued well before the audio thread needs
// them, so a busy main thread (drawing meters, spectrums, React updates) can
// stall briefly without the scheduler missing its slot and dropping sound.
// The cost is a little more latency between hitting play and hearing the
// first note, which is a fine trade for pre-sequenced playback.
export const STABILITY_LOOKAHEAD_SECONDS: Record<Exclude<AudioStabilityMode, 'auto'>, number> = {
  tight: 0.2,
  stable: 0.4,
  resilient: 0.7,
};

// Phones have the least main-thread headroom and the weakest audio threads, so
// "auto" hands them the most lookahead. Desktops get the "stable" window rather
// than the tight one: the studio plays back sequenced patterns, not live input,
// so smooth playback matters more than shaving milliseconds of start latency.
const AUTO_MOBILE_LOOKAHEAD_SECONDS = 0.5;

export const lookaheadForMode = (mode: AudioStabilityMode, isMobile: boolean): number => {
  if (mode === 'auto') {
    return isMobile ? AUTO_MOBILE_LOOKAHEAD_SECONDS : STABILITY_LOOKAHEAD_SECONDS.stable;
  }
  return STABILITY_LOOKAHEAD_SECONDS[mode];
};

// Whether a device's native sample rate is high enough that rebuilding the
// audio context at the capped target is worth it. Rebuilding has a cost, so
// leave 44.1k/48k hardware alone and only step in for meaningfully higher rates
// (88.2k and up, which is where external DACs start to overload the graph). The
// 25% margin keeps a nominal 48k device from tripping on rounding.
export const shouldCapSampleRate = (deviceRate: number, target: number): boolean => (
  Number.isFinite(deviceRate) && deviceRate > target * 1.25
);
