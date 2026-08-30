import { Suspense } from 'react';

import { useAudio } from '../context/AudioContext';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useNotesPanelOpen } from './notesPanelStore';

// The Piano Roll is one of the heaviest components in the app and the panel
// starts collapsed, so its chunk only loads the first time Piano roll opens.
const PianoRollView = lazyWithRetry(() => import('./PianoRollView').then((module) => ({ default: module.PianoRollView })), 'piano-roll');

// The Piano Roll lives in the shared inspector dock. The dock owns switching
// and closing, while this component keeps the expensive editor lazy and lets
// deep-edit actions request it through the shared panel store.
export const NotesPanel = () => {
  const { activeView } = useAudio();
  const open = useNotesPanelOpen();

  if (activeView !== 'SEQUENCER' || !open) {
    return null;
  }

  return (
    <div className="notes-panel flex min-h-0 flex-1 flex-col overflow-hidden" data-studio-panel-body="notes">
      <Suspense fallback={<div className="surface-panel flex flex-1 items-center justify-center text-sm text-[var(--text-secondary)]">Opening the Piano roll</div>}>
        <PianoRollView />
      </Suspense>
    </div>
  );
};
