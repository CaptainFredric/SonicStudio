// Schedule a quick audible preview for a captured note string.
//
// The shelf needs to play back a saved sequence without going through
// the full Tone Transport (which would loop the entire project). This
// module just walks the tokens, schedules `previewer(note, velocity)`
// calls via setTimeout offset by step duration, and hands back a
// cancel function. Decoupled from the engine — the caller decides how
// to actually play each note.

import type { CapturedNoteToken } from '../services/noteStringLibrary';

export interface PreviewSchedule {
  /** Stop the in-flight preview. Safe to call after natural completion. */
  cancel: () => void;
  /** Total wall-clock duration in ms, useful for showing a progress UI. */
  durationMs: number;
}

interface ScheduleOptions {
  /** Milliseconds between step positions. Default ~150 ms (≈ 100 BPM 16ths). */
  stepMs?: number;
  /** Fires after the final scheduled note has been triggered. */
  onComplete?: () => void;
}

export type PreviewNoteFn = (note: string, velocity: number) => void;

/**
 * Walk the tokens in order, scheduling each non-rest note at its
 * cumulative step position. Held notes (gate > 1) take their gate
 * count in steps before the cursor advances, matching the way the
 * shelf converts strings to pattern segments.
 */
export const schedulePreview = (
  tokens: Array<CapturedNoteToken | null>,
  previewer: PreviewNoteFn,
  options: ScheduleOptions = {},
): PreviewSchedule => {
  const stepMs = Math.max(40, options.stepMs ?? 150);
  const scheduler = typeof window !== 'undefined' ? window.setTimeout : globalThis.setTimeout;
  const canceller = typeof window !== 'undefined' ? window.clearTimeout : globalThis.clearTimeout;
  const timeouts: ReturnType<typeof scheduler>[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token === null) {
      cursor += 1;
      continue;
    }
    const offset = cursor * stepMs;
    const note = token.note;
    const velocity = token.velocity;
    const id = scheduler(() => {
      previewer(note, velocity);
    }, offset);
    timeouts.push(id);
    cursor += Math.max(1, Math.round(token.gate));
  }

  const durationMs = cursor * stepMs;

  if (options.onComplete) {
    const onComplete = options.onComplete;
    const completionTimer = scheduler(() => {
      onComplete();
    }, durationMs + 80);
    timeouts.push(completionTimer);
  }

  let cancelled = false;
  return {
    durationMs,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      timeouts.forEach((id) => canceller(id as never));
      timeouts.length = 0;
    },
  };
};
