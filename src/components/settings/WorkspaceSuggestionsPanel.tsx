import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

import type { Track } from '../../project/schema';
import { computeSmartSuggestions } from '../../services/smartSuggestions';

interface WorkspaceSuggestionsPanelProps {
  fullTracks: Track[];
  onSelectTrack: (trackId: string) => void;
}

// Small "Suggestions" panel that surfaces concrete next-step tips for
// the current session. Reads from the smartSuggestions service, which
// pairs the keyDetector with lane-density heuristics — no ML, just
// pattern-recognition. Hides entirely when there are no actionable
// tips so the panel does not nag a finished session.
export const WorkspaceSuggestionsPanel = ({ fullTracks, onSelectTrack }: WorkspaceSuggestionsPanelProps) => {
  const suggestions = useMemo(() => computeSmartSuggestions(fullTracks), [fullTracks]);

  if (suggestions.length === 0) return null;

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Suggestions</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {suggestions.length} {suggestions.length === 1 ? 'tip' : 'tips'}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {suggestions.slice(0, 6).map((entry) => (
          <button
            aria-label={entry.trackId ? `${entry.title}. Jump to lane.` : entry.title}
            className={`flex w-full items-start justify-between gap-3 rounded-[3px] border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left transition-colors ${entry.tone === 'attention' ? 'border-[rgba(255,148,102,0.32)]' : 'border-[var(--border-soft)]'} hover:border-[rgba(114,217,255,0.32)]`}
            disabled={!entry.trackId}
            key={entry.id}
            onClick={() => {
              if (entry.trackId) onSelectTrack(entry.trackId);
            }}
            type="button"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{entry.detail}</div>
            </div>
            {entry.trackId && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                Open
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
