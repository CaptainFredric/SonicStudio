import { Suspense, lazy, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Music4 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { setNotesPanelOpen, useNotesPanelOpen } from './notesPanelStore';

// The Piano Roll is one of the heaviest components in the app and the panel
// starts collapsed, so its chunk only loads the first time Notes opens.
const PianoRollView = lazy(() => import('./PianoRollView').then((module) => ({ default: module.PianoRollView })));

// The Piano Roll note editor used to be its own top-level tab. It now lives
// inside the Sequencer view as a collapsible "Notes" panel, so pitch, velocity,
// and gate editing (plus the chord palette and saved-note recall) sit alongside
// the step grid. Collapsed by default; the deep-edit buttons elsewhere call
// openNotesPanel() to expand and scroll it into view.
export const NotesPanel = () => {
  const { activeView } = useAudio();
  const open = useNotesPanelOpen();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);

  if (activeView !== 'SEQUENCER') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        aria-expanded={open}
        className="surface-panel flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
        onClick={() => setNotesPanelOpen(!open)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Music4 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="section-label">Notes</span>
          <span className="hidden truncate text-[12px] text-[var(--text-tertiary)] sm:inline">
            Edit pitch, velocity, and phrasing in the piano roll
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {open ? 'Hide' : 'Open'}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div ref={bodyRef} className="flex min-h-0 flex-col" style={{ height: 'clamp(420px, 64vh, 720px)' }}>
          <Suspense fallback={<div className="surface-panel flex flex-1 items-center justify-center text-sm text-[var(--text-secondary)]">Opening the note grid</div>}>
            <PianoRollView />
          </Suspense>
        </div>
      )}
    </div>
  );
};
