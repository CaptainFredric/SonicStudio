import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers3 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { readString, writeString } from '../utils/safeStorage';
import { Arranger } from './Arranger';

const ARRANGEMENT_PANEL_KEY = 'sonicstudio:arrangement-panel-open';

// The Arranger used to be its own top-level tab. It now lives inside the
// Sequencer view as a collapsible panel, so clip and section editing sits
// alongside the step grid (and the whole-song views) instead of behind a
// separate tab. Collapsed by default to keep the first view uncluttered;
// expanding reveals the full clip editor at a bounded height with its own
// scroll.
export const ArrangementPanel = () => {
  const { activeView } = useAudio();
  // Collapsed by default for a clean first view; a returning user who opened it
  // keeps it open next session.
  const [open, setOpen] = useState(() => readString(ARRANGEMENT_PANEL_KEY) === 'true');

  const toggleOpen = () => setOpen((value) => {
    const next = !value;
    void writeString(ARRANGEMENT_PANEL_KEY, next ? 'true' : 'false');
    return next;
  });

  if (activeView !== 'SEQUENCER') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        aria-expanded={open}
        className="surface-panel flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
        onClick={toggleOpen}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Layers3 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="section-label">Arrangement</span>
          <span className="hidden truncate text-[12px] text-[var(--text-tertiary)] sm:inline">
            Place clips and order sections across the song
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {open ? 'Hide' : 'Open'}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="flex min-h-0 flex-col" style={{ height: 'clamp(360px, 58vh, 640px)' }}>
          <Arranger />
        </div>
      )}
    </div>
  );
};
