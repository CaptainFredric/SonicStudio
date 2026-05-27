import { useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';

import type { Track } from '../../project/schema';
import { useDismissedSuggestionIds } from '../../services/dismissedSuggestions';
import { computeSmartSuggestions, type SmartSuggestionAction } from '../../services/smartSuggestions';

interface WorkspaceSuggestionsPanelProps {
  fullTracks: Track[];
  onApplyAction: (action: SmartSuggestionAction) => void;
  onSelectTrack: (trackId: string) => void;
}

// Small "Suggestions" panel that surfaces concrete next-step tips for
// the current session. Reads from the smartSuggestions service, which
// pairs the keyDetector with lane-density heuristics — no ML, just
// pattern-recognition. Hides entirely when there are no actionable
// tips so the panel does not nag a finished session.
export const WorkspaceSuggestionsPanel = ({ fullTracks, onApplyAction, onSelectTrack }: WorkspaceSuggestionsPanelProps) => {
  const allSuggestions = useMemo(() => computeSmartSuggestions(fullTracks), [fullTracks]);
  const [dismissedIds, dismiss, resetDismissed] = useDismissedSuggestionIds();
  const suggestions = useMemo(
    () => allSuggestions.filter((entry) => !dismissedIds.has(entry.id)),
    [allSuggestions, dismissedIds],
  );
  const hiddenCount = allSuggestions.length - suggestions.length;

  if (suggestions.length === 0 && hiddenCount === 0) return null;

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-primary)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <span className="section-label">Suggestions</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {suggestions.length} {suggestions.length === 1 ? 'tip' : 'tips'}
          </span>
        </div>
        {hiddenCount > 0 && (
          <button
            aria-label={`Restore ${hiddenCount} dismissed tip${hiddenCount === 1 ? '' : 's'}`}
            className="control-chip h-7 min-h-[1.75rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={resetDismissed}
            type="button"
          >
            Restore {hiddenCount} dismissed
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        {suggestions.slice(0, 6).map((entry) => (
          <div
            className={`flex w-full items-start justify-between gap-3 rounded-[3px] border bg-[rgba(255,255,255,0.02)] px-3 py-2 transition-colors ${entry.tone === 'attention' ? 'border-[rgba(255,148,102,0.32)]' : 'border-[var(--border-soft)]'}`}
            key={entry.id}
          >
            <button
              aria-label={entry.trackId ? `${entry.title}. Jump to lane.` : entry.title}
              className="min-w-0 flex-1 text-left"
              disabled={!entry.trackId}
              onClick={() => {
                if (entry.trackId) onSelectTrack(entry.trackId);
              }}
              type="button"
            >
              <div className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{entry.detail}</div>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {entry.action && entry.actionLabel && (
                <button
                  aria-label={entry.actionLabel}
                  className="control-chip h-7 min-h-[1.75rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active="true"
                  onClick={() => entry.action && onApplyAction(entry.action)}
                  type="button"
                >
                  {entry.actionLabel}
                </button>
              )}
              <div className="flex items-center gap-1">
                {entry.trackId && (
                  <button
                    aria-label="Open this lane"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]"
                    onClick={() => entry.trackId && onSelectTrack(entry.trackId)}
                    type="button"
                  >
                    Open
                  </button>
                )}
                <button
                  aria-label="Dismiss this tip"
                  className="ghost-icon-button flex h-6 w-6 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  onClick={() => dismiss(entry.id)}
                  title="Dismiss this tip"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
