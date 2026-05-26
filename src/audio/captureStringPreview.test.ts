import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { schedulePreview } from './captureStringPreview';
import { parseNoteString } from '../services/noteStringLibrary';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('schedulePreview', () => {
  it('triggers each non-rest note at its cumulative step offset', () => {
    const calls: Array<{ note: string; offset: number }> = [];
    const tokens = parseNoteString('C4 . E4 G4').tokens;
    let elapsed = 0;
    const start = Date.now();
    const fakeNow = () => Date.now() - start;

    const schedule = schedulePreview(tokens, (note) => {
      calls.push({ note, offset: fakeNow() });
    }, { stepMs: 100 });

    vi.advanceTimersByTime(400);
    elapsed += 400;

    expect(calls).toEqual([
      { note: 'C4', offset: 0 },
      { note: 'E4', offset: 200 },
      { note: 'G4', offset: 300 },
    ]);
    expect(schedule.durationMs).toBe(400);
  });

  it('cancel() halts pending notes', () => {
    const calls: string[] = [];
    const tokens = parseNoteString('C4 D4 E4 F4').tokens;
    const schedule = schedulePreview(tokens, (note) => {
      calls.push(note);
    }, { stepMs: 100 });

    vi.advanceTimersByTime(150);
    schedule.cancel();
    vi.advanceTimersByTime(1000);

    expect(calls).toEqual(['C4', 'D4']);
  });

  it('runs onComplete after the last step', () => {
    const completed = vi.fn();
    const tokens = parseNoteString('C4 E4').tokens;
    schedulePreview(tokens, () => {}, { stepMs: 100, onComplete: completed });
    vi.advanceTimersByTime(180);
    expect(completed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(completed).toHaveBeenCalledOnce();
  });
});
