import type { AudioStabilityMode } from '../project/preferences';

// Scale a UI meter's polling interval by the audio stability mode.
//
// Every visible meter runs its own timer that reads the engine and triggers
// a React update. On a weaker device that main-thread churn competes with
// Tone's look-ahead scheduler and is a common cause of audible stutter. The
// modes that already trade latency for glitch-free playback (stable, and
// especially resilient) now also refresh meters less often, handing that
// headroom back to the audio thread. Tight and auto keep meters snappy.
const MODE_SCALE: Record<AudioStabilityMode, number> = {
  auto: 1,
  tight: 1,
  stable: 1.4,
  resilient: 2,
};

export const meterIntervalForMode = (baseMs: number, mode: AudioStabilityMode): number => (
  Math.round(baseMs * (MODE_SCALE[mode] ?? 1))
);
