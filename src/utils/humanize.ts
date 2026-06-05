// Pure helpers for the per-lane Humanize feel. A programmed step gets a small
// velocity wobble and a micro-timing nudge, each scaled by the lane's humanize
// amount (0..1) and a jitter value in -1..1. Everything is clamped: velocity
// stays audible and within range, and the nudged time can never land before a
// supplied floor (so playback scheduling never goes into the past).

/** Largest fractional velocity swing at humanize = 1 (so +/-28%). */
export const MAX_HUMANIZE_VELOCITY_SWING = 0.28;
/** Largest timing nudge at humanize = 1, in seconds (so +/-18ms). */
export const MAX_HUMANIZE_TIME_SWING_SECONDS = 0.018;

export const humanizeVelocity = (base: number, humanize: number, jitter: number): number => {
  if (humanize <= 0) {
    return base;
  }
  const swung = base * (1 + jitter * humanize * MAX_HUMANIZE_VELOCITY_SWING);
  return Math.max(0.05, Math.min(1, swung));
};

export const humanizeTime = (time: number, humanize: number, jitter: number, floor: number): number => {
  if (humanize <= 0) {
    return time;
  }
  return Math.max(floor, time + jitter * humanize * MAX_HUMANIZE_TIME_SWING_SECONDS);
};
