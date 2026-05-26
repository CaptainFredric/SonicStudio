import { useEffect, useMemo, useState } from 'react';
import { ListPlus, Mic2, Trash2 } from 'lucide-react';

import {
  captureNoteString,
  loadCapturedNoteStrings,
  noteStringToPatternSegment,
  removeCapturedNoteString,
  subscribeCapturedNoteStrings,
  summarizeCapturedNoteString,
  type CapturedNoteString,
} from '../../services/noteStringLibrary';
import type { NoteEvent, PatternAutomation } from '../../project/schema';

interface Lane {
  id: string;
  name: string;
  type: string;
}

interface WorkspaceCapturePanelProps {
  applyPatternSegment: (
    trackId: string,
    patternIndex: number,
    steps: NoteEvent[][],
    automation?: PatternAutomation,
  ) => void;
  currentPattern: number;
  disabled?: boolean;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string) => void;
  tracks: Lane[];
}

const SYNTAX_HINT = 'C4 E4 G4 B4  ·  use . for rests, *N to hold N steps, @V for velocity 0–1.';
const PLACEHOLDER_EXAMPLE = 'C4 E4 G4 B4*2 . F4';
const NAME_PLACEHOLDER = 'Name this string (optional)';

export const WorkspaceCapturePanel = ({
  applyPatternSegment,
  currentPattern,
  disabled = false,
  selectedTrackId,
  setSelectedTrackId,
  tracks,
}: WorkspaceCapturePanelProps) => {
  const [items, setItems] = useState<CapturedNoteString[]>(() => loadCapturedNoteStrings());
  const [draftRaw, setDraftRaw] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCapturedNoteStrings(setItems);
    return unsubscribe;
  }, []);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null,
    [selectedTrackId, tracks],
  );

  const handleSave = () => {
    if (!draftRaw.trim()) {
      setDraftError('Type a note or two first.');
      return;
    }
    const updated = captureNoteString({ name: draftName, raw: draftRaw, source: 'typed' });
    if (!updated) {
      setDraftError('That didn\'t look like notes — try C4 E4 G4.');
      return;
    }
    setItems(updated);
    setDraftRaw('');
    setDraftName('');
    setDraftError(null);
  };

  const handleApply = (entry: CapturedNoteString) => {
    if (!selectedTrack) return;
    const segment = noteStringToPatternSegment(
      entry,
      selectedTrack.name,
      (selectedTrack.type as never) ?? 'lead',
    );
    applyPatternSegment(selectedTrack.id, currentPattern, segment.steps, segment.automation);
  };

  const handleRemove = (id: string) => {
    setItems(removeCapturedNoteString(id));
  };

  const handleSelectLane = (laneId: string) => {
    setSelectedTrackId(laneId);
  };

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Mic2 className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Note strings</span>
      </div>
      <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
        Park short melodies you want to reuse. Type a sequence, save it, and drop it onto any lane.
      </div>

      <div className="mt-3 grid gap-2">
        <input
          aria-label="Optional name for this captured string"
          className="control-field h-9 w-full px-3 text-sm"
          disabled={disabled}
          maxLength={48}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder={NAME_PLACEHOLDER}
          type="text"
          value={draftName}
        />
        <textarea
          aria-label="Note sequence to capture"
          className="control-field min-h-[2.6rem] w-full px-3 py-2 font-mono text-[12px]"
          disabled={disabled}
          onChange={(event) => {
            setDraftRaw(event.target.value);
            if (draftError) setDraftError(null);
          }}
          placeholder={PLACEHOLDER_EXAMPLE}
          rows={2}
          value={draftRaw}
        />
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {SYNTAX_HINT}
        </div>
        {draftError && (
          <div className="text-[11px] text-[var(--accent-warn,#ff9466)]" role="alert">
            {draftError}
          </div>
        )}
        <button
          className="control-chip inline-flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          disabled={disabled || draftRaw.trim().length === 0}
          onClick={handleSave}
          type="button"
        >
          <ListPlus className="h-3.5 w-3.5" />
          Save to shelf
        </button>
      </div>

      {tracks.length > 0 && (
        <div className="mt-4">
          <div className="section-label">Target lane</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tracks.map((lane) => (
              <button
                aria-pressed={lane.id === selectedTrack?.id}
                className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={lane.id === selectedTrack?.id ? 'true' : 'false'}
                key={lane.id}
                onClick={() => handleSelectLane(lane.id)}
                type="button"
              >
                {lane.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="section-label">Shelf · {items.length} {items.length === 1 ? 'string' : 'strings'}</div>
        {items.length === 0 ? (
          <div className="mt-3 rounded-[3px] border border-dashed border-[var(--border-soft)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
            No captures yet. Try saving something like &quot;C4 E4 G4 B4&quot; above.
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {items.map((entry) => {
              const stats = summarizeCapturedNoteString(entry);
              return (
                <div
                  key={entry.id}
                  className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                  data-note-string-id={entry.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {entry.name}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {stats.noteCount} {stats.noteCount === 1 ? 'note' : 'notes'} · {stats.stepCount} {stats.stepCount === 1 ? 'step' : 'steps'} · {entry.source}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-secondary)]">
                        {entry.tokens
                          .map((token) => (token === null ? '·' : token.note))
                          .join(' ')}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        aria-label={`Apply ${entry.name} to ${selectedTrack?.name ?? 'the selected lane'}`}
                        className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        disabled={disabled || !selectedTrack}
                        onClick={() => handleApply(entry)}
                        type="button"
                      >
                        Apply
                      </button>
                      <button
                        aria-label={`Remove ${entry.name} from the shelf`}
                        className="control-chip px-2 py-1.5 text-[10px]"
                        disabled={disabled}
                        onClick={() => handleRemove(entry.id)}
                        type="button"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
