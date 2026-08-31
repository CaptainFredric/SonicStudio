import { useAudio } from '../context/AudioContext';
import { PianoRoll } from './PianoRoll';
import { WholeSongPianoRoll } from './WholeSongPianoRoll';

// Pattern mode edits one loop. Song mode edits the selected lane across the
// continuous arrangement. The transport mode is the single source of truth,
// so the user never has to resolve a second Pattern versus Song toggle here.
export const PianoRollView = () => {
  const { selectedTrackId, tracks, transportMode } = useAudio();
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null;
  const isRhythmTrack = selectedTrack?.type === 'kick' || selectedTrack?.type === 'snare' || selectedTrack?.type === 'hihat';
  const editorLabel = isRhythmTrack
    ? `${transportMode === 'SONG' ? 'Song' : 'Pattern'} hit lane`
    : `${transportMode === 'SONG' ? 'Song' : 'Pattern'} piano roll`;
  const helper = isRhythmTrack
    ? `Click steps to add or remove ${selectedTrack?.type === 'hihat' ? 'hi-hat' : selectedTrack?.type ?? 'drum'} hits.`
    : transportMode === 'SONG'
      ? 'Drag notes to change pitch or timing. Click cells to add or remove. Reused patterns update together.'
      : 'Click empty space to add. Drag a note to change pitch or timing. Select it for precise controls.';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="surface-panel-muted flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="section-label">{editorLabel}</span>
        <span className="text-[11px] text-[var(--text-secondary)]">
          {helper}
        </span>
      </div>
      {transportMode === 'SONG' ? <WholeSongPianoRoll /> : <PianoRoll />}
    </div>
  );
};
