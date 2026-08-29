import { useAudio } from '../context/AudioContext';
import { PianoRoll } from './PianoRoll';
import { WholeSongPianoRoll } from './WholeSongPianoRoll';

// Pattern mode edits one loop. Song mode edits the selected lane across the
// continuous arrangement. The transport mode is the single source of truth,
// so the user never has to resolve a second Pattern versus Song toggle here.
export const PianoRollView = () => {
  const { transportMode } = useAudio();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="surface-panel-muted flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="section-label">{transportMode === 'SONG' ? 'Song piano roll' : 'Pattern piano roll'}</span>
        <span className="text-[11px] text-[var(--text-secondary)]">
          Each colored block is a playable note. Click the grid to change pitch and timing for the selected lane.
        </span>
      </div>
      {transportMode === 'SONG' ? <WholeSongPianoRoll /> : <PianoRoll />}
    </div>
  );
};
