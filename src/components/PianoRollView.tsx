import { useState } from 'react';

import { useAudio } from '../context/AudioContext';
import { PianoRoll } from './PianoRoll';
import { WholeSongPianoRoll } from './WholeSongPianoRoll';

// Wraps the note editor so Song mode can switch between the per-pattern Piano
// Roll and a flattened whole-song view that shows every note the arrangement
// plays. In Pattern mode there is only one pattern, so the toggle is hidden and
// the classic Piano Roll fills the view unchanged.
export const PianoRollView = () => {
  const { transportMode } = useAudio();
  const [wholeSong, setWholeSong] = useState(false);
  const canFlatten = transportMode === 'SONG';
  const showWhole = canFlatten && wholeSong;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {canFlatten && (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="section-label">Notes</span>
          <div className="inline-flex overflow-hidden rounded-[4px] border border-[var(--border-soft)]">
            <button
              className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-active={!wholeSong}
              onClick={() => setWholeSong(false)}
              style={{ background: !wholeSong ? 'var(--accent-muted)' : undefined, color: !wholeSong ? 'var(--accent-strong)' : 'var(--text-tertiary)' }}
              type="button"
            >
              One pattern
            </button>
            <button
              className="border-l border-[var(--border-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-active={wholeSong}
              onClick={() => setWholeSong(true)}
              style={{ background: wholeSong ? 'var(--accent-muted)' : undefined, color: wholeSong ? 'var(--accent-strong)' : 'var(--text-tertiary)' }}
              type="button"
            >
              Whole song
            </button>
          </div>
        </div>
      )}
      {showWhole ? <WholeSongPianoRoll /> : <PianoRoll />}
    </div>
  );
};
