import { useAudio } from '../context/AudioContext';
import { useNotesPanelOpen } from './notesPanelStore';
import { PianoRollView } from './PianoRollView';

// The Piano Roll lives in the shared inspector dock. The dock owns switching
// and closing, while deep-edit actions request it through the shared panel
// store. Keeping this path eager prevents a cold first click from parking on a
// nested loading boundary.
export const NotesPanel = () => {
  const { activeView } = useAudio();
  const open = useNotesPanelOpen();

  if (activeView !== 'SEQUENCER' || !open) {
    return null;
  }

  return (
    <div className="notes-panel flex min-h-0 flex-1 flex-col overflow-hidden" data-studio-panel-body="notes">
      <PianoRollView />
    </div>
  );
};
