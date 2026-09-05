import { useAudio } from '../context/AudioContext';
import { useNotesPanelScope } from './notesPanelStore';
import { PianoRoll } from './PianoRoll';
import { WholeSongPianoRoll } from './WholeSongPianoRoll';

// The dock follows transport mode by default. A clip's edit action can request
// the selected source pattern without changing Song playback or exposing a
// second Pattern versus Song toggle to the user.
export const PianoRollView = () => {
  const { selectedTrackId, tracks, transportMode } = useAudio();
  const notesPanelScope = useNotesPanelScope();
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null;
  const isRhythmTrack = selectedTrack?.type === 'kick' || selectedTrack?.type === 'snare' || selectedTrack?.type === 'hihat';
  const clipScoped = transportMode === 'SONG' && notesPanelScope === 'clip';
  const patternEditor = transportMode === 'PATTERN' || clipScoped;
  const scopeLabel = clipScoped ? 'Clip' : transportMode === 'SONG' ? 'Song' : 'Pattern';
  const editorLabel = isRhythmTrack
    ? `${scopeLabel} hit lane`
    : `${scopeLabel} piano roll`;
  const helper = isRhythmTrack
    ? `Click steps to add or remove ${selectedTrack?.type === 'hihat' ? 'hi-hat' : selectedTrack?.type ?? 'drum'} hits.`
    : clipScoped
      ? 'Edit this clip\'s source pattern. Linked clips update together.'
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
      {patternEditor ? <PianoRoll /> : <WholeSongPianoRoll />}
    </div>
  );
};
