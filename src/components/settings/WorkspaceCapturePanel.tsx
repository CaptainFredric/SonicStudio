import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioWaveform, Check, ChevronDown, ChevronUp, Copy, Download, ListPlus, Mic2, Music, Pencil, Play, Square, Trash2, Upload } from 'lucide-react';

import { schedulePreview, type PreviewSchedule } from '../../audio/captureStringPreview';
import { CHORD_STARTERS } from '../../services/chordStarters';
import {
  captureNoteString,
  clearCapturedNoteStrings,
  duplicateCapturedNoteString,
  importCapturedNoteStringsFromJson,
  loadCapturedNoteStrings,
  noteStringToPatternSegment,
  removeCapturedNoteString,
  renameCapturedNoteString,
  saveCapturedNoteStringFromTokens,
  serializeCapturedNoteStrings,
  subscribeCapturedNoteStrings,
  summarizeCapturedNoteString,
  transposeCapturedNoteString,
  type CapturedNoteString,
} from '../../services/noteStringLibrary';
import type { NoteEvent, PatternAutomation } from '../../project/schema';

interface Lane {
  id: string;
  name: string;
  type: string;
}

export type QueuedNoteStringHandler = (stringId: string | null) => void;

interface WorkspaceCapturePanelProps {
  applyPatternSegment: (
    trackId: string,
    patternIndex: number,
    steps: NoteEvent[][],
    automation?: PatternAutomation,
  ) => void;
  currentPattern: number;
  disabled?: boolean;
  /** When set, the panel highlights the matching row and shows the cell-tap CTA. */
  queuedNoteStringId?: string | null;
  /** Called when the user taps "Queue for tap" (touch fallback for drag). */
  onQueueNoteString?: QueuedNoteStringHandler;
  /** Optional: play a single note through the currently selected lane. */
  previewTrack?: (trackId: string, note: string, sampleSliceIndex?: number, velocity?: number) => Promise<void>;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string) => void;
  tracks: Lane[];
}

const SYNTAX_HINT = 'C4 E4 G4 B4  ·  use . for rests, *N to hold N steps, @V for velocity from 0 to 1.';
const PLACEHOLDER_EXAMPLE = 'C4 E4 G4 B4*2 . F4';
const NAME_PLACEHOLDER = 'Name this string (optional)';

export const WorkspaceCapturePanel = ({
  applyPatternSegment,
  currentPattern,
  disabled = false,
  queuedNoteStringId = null,
  onQueueNoteString,
  previewTrack,
  selectedTrackId,
  setSelectedTrackId,
  tracks,
}: WorkspaceCapturePanelProps) => {
  const [items, setItems] = useState<CapturedNoteString[]>(() => loadCapturedNoteStrings());
  const [draftRaw, setDraftRaw] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewRef = useRef<PreviewSchedule | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeCapturedNoteStrings(setItems);
    return unsubscribe;
  }, []);

  useEffect(() => () => {
    previewRef.current?.cancel();
    previewRef.current = null;
  }, []);

  const stopPreview = () => {
    previewRef.current?.cancel();
    previewRef.current = null;
    setPreviewingId(null);
  };

  const startPreview = (entry: CapturedNoteString) => {
    if (!previewTrack) return;
    const targetLane = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
    if (!targetLane) return;
    stopPreview();
    const schedule = schedulePreview(
      entry.tokens,
      (note, velocity) => { void previewTrack(targetLane.id, note, undefined, velocity); },
      {
        stepMs: 140,
        onComplete: () => {
          previewRef.current = null;
          setPreviewingId((current) => (current === entry.id ? null : current));
        },
      },
    );
    previewRef.current = schedule;
    setPreviewingId(entry.id);
  };

  const togglePreview = (entry: CapturedNoteString) => {
    if (previewingId === entry.id) {
      stopPreview();
      return;
    }
    startPreview(entry);
  };

  const toggleQueue = (entry: CapturedNoteString) => {
    if (!onQueueNoteString) return;
    onQueueNoteString(queuedNoteStringId === entry.id ? null : entry.id);
  };

  const startRename = (entry: CapturedNoteString) => {
    setRenamingId(entry.id);
    setRenameDraft(entry.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  const commitRename = (entry: CapturedNoteString) => {
    const next = renameDraft.trim();
    if (!next || next === entry.name) {
      cancelRename();
      return;
    }
    setItems(renameCapturedNoteString(entry.id, next));
    cancelRename();
  };

  const handleDuplicate = (entry: CapturedNoteString) => {
    setItems(duplicateCapturedNoteString(entry.id));
  };

  const handleTranspose = (entry: CapturedNoteString, semitones: number) => {
    setItems(transposeCapturedNoteString(entry.id, semitones));
  };

  const handleAddChordStarter = (starterId: string) => {
    const starter = CHORD_STARTERS.find((entry) => entry.id === starterId);
    if (!starter) return;
    const updated = saveCapturedNoteStringFromTokens({
      name: starter.label,
      tokens: starter.tokens,
      source: 'typed',
    });
    if (updated) {
      setItems(updated);
    }
  };

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
      setDraftError('That didn\'t look like notes. Try something like C4 E4 G4.');
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [managementNotice, setManagementNotice] = useState<string | null>(null);

  const handleClearShelf = () => {
    if (items.length === 0) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Remove all ${items.length} captured ${items.length === 1 ? 'string' : 'strings'} from the shelf? This can't be undone.`)
      : true;
    if (!confirmed) return;
    setItems(clearCapturedNoteStrings());
    if (onQueueNoteString) onQueueNoteString(null);
    setManagementNotice('Shelf cleared.');
  };

  const handleExport = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (items.length === 0) return;
    const json = serializeCapturedNoteStrings(items);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    anchor.download = `sonicstudio-note-strings-${stamp}.json`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
    setManagementNotice(`Exported ${items.length} ${items.length === 1 ? 'string' : 'strings'}.`);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const result = importCapturedNoteStringsFromJson(text);
      setItems(result.items);
      const parts = [`Imported ${result.imported}`];
      if (result.duplicates > 0) parts.push(`skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}`);
      if (result.skipped > 0) parts.push(`${result.skipped} unreadable`);
      setManagementNotice(parts.join(' · '));
    } catch {
      setManagementNotice('Could not read that file.');
    }
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
        <div className="flex items-center gap-2">
          <Music className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="section-label">Chord starters</span>
        </div>
        <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          One-click harmonic frames. Each lands on the shelf as a new string you can drop onto a pad, bass, or piano lane.
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CHORD_STARTERS.map((starter) => (
            <button
              aria-label={`Add ${starter.label} to the shelf`}
              className="control-chip h-8 min-h-[2rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              disabled={disabled}
              key={starter.id}
              onClick={() => handleAddChordStarter(starter.id)}
              title={starter.description}
              type="button"
            >
              {starter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="section-label">Manage</div>
        <div className="flex flex-wrap gap-1.5">
          <input
            accept=".json,application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) await handleImport(file);
            }}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="Import note-strings JSON"
            className="control-chip h-8 min-h-[2rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="h-3 w-3" />
            Import
          </button>
          <button
            aria-label="Export the shelf as JSON"
            className="control-chip h-8 min-h-[2rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            disabled={disabled || items.length === 0}
            onClick={handleExport}
            type="button"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
          <button
            aria-label="Remove every captured string from the shelf"
            className="control-chip h-8 min-h-[2rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            disabled={disabled || items.length === 0}
            onClick={handleClearShelf}
            type="button"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>
      {managementNotice && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]" role="status">
          {managementNotice}
        </div>
      )}

      <div className="mt-4">
        <div className="section-label">Shelf · {items.length} {items.length === 1 ? 'string' : 'strings'}</div>
        {items.length === 0 ? (
          <div className="mt-3 rounded-[3px] border border-dashed border-[var(--border-soft)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
            <div>No captures yet. Try saving something like &quot;C4 E4 G4 B4&quot; above, or hum a phrase and let the studio transcribe it.</div>
            <button
              className="control-chip mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('sonicstudio:open-transcriber'));
                }
              }}
              type="button"
            >
              <AudioWaveform className="h-3.5 w-3.5" />
              Capture from a hum
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {items.map((entry) => {
              const stats = summarizeCapturedNoteString(entry);
              const isPreviewing = previewingId === entry.id;
              const isQueued = queuedNoteStringId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`rounded-[3px] border bg-[rgba(255,255,255,0.02)] px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${isQueued ? 'border-[var(--accent-strong)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]' : 'border-[var(--border-soft)]'}`}
                  data-note-string-id={entry.id}
                  data-queued={isQueued ? 'true' : undefined}
                  draggable={!disabled}
                  onDragStart={(event) => {
                    if (disabled) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData('application/x-sonicstudio-note-string', entry.id);
                    event.dataTransfer.setData('text/plain', entry.name);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  title="Drag onto a lane to apply this string to the current pattern. On touch, use Queue."
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {renamingId === entry.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            aria-label={`Rename ${entry.name}`}
                            autoFocus
                            className="control-field h-7 min-w-0 flex-1 px-2 text-sm"
                            maxLength={48}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitRename(entry);
                              } else if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelRename();
                              }
                            }}
                            value={renameDraft}
                          />
                          <button
                            aria-label="Save name"
                            className="control-chip flex h-7 min-h-[1.75rem] w-7 items-center justify-center px-1.5"
                            onClick={() => commitRename(entry)}
                            type="button"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          aria-label={`Rename ${entry.name}`}
                          className="flex w-full min-w-0 items-center gap-1.5 text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-strong)]"
                          onClick={() => startRename(entry)}
                          title="Click to rename"
                          type="button"
                        >
                          <span className="truncate">{entry.name}</span>
                          <Pencil className="h-3 w-3 shrink-0 opacity-40" />
                        </button>
                      )}
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {stats.noteCount} {stats.noteCount === 1 ? 'note' : 'notes'} · {stats.stepCount} {stats.stepCount === 1 ? 'step' : 'steps'} · {entry.source}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-secondary)]">
                        {entry.tokens
                          .map((token) => (token === null ? '·' : token.note))
                          .join(' ')}
                      </div>
                      {isQueued && (
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                          Queued. Tap any sequencer cell or lane to drop.
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          aria-label={isPreviewing ? `Stop previewing ${entry.name}` : `Preview ${entry.name}`}
                          aria-pressed={isPreviewing}
                          className="control-chip flex h-8 min-h-[2rem] min-w-[2rem] items-center justify-center px-2"
                          data-active={isPreviewing ? 'true' : 'false'}
                          disabled={disabled || !previewTrack || !selectedTrack}
                          onClick={() => togglePreview(entry)}
                          title={!selectedTrack ? 'Select a lane to preview through it' : (isPreviewing ? 'Stop preview' : 'Preview through the selected lane')}
                          type="button"
                        >
                          {isPreviewing ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                        </button>
                        <button
                          aria-label={`Apply ${entry.name} to ${selectedTrack?.name ?? 'the selected lane'}`}
                          className="control-chip h-8 min-h-[2rem] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          disabled={disabled || !selectedTrack}
                          onClick={() => handleApply(entry)}
                          type="button"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        {onQueueNoteString && (
                          <button
                            aria-label={isQueued ? `Clear queued string` : `Queue ${entry.name} for tap-to-drop`}
                            aria-pressed={isQueued}
                            className="control-chip h-8 min-h-[2rem] flex-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            data-active={isQueued ? 'true' : 'false'}
                            disabled={disabled}
                            onClick={() => toggleQueue(entry)}
                            title="Touch fallback: tap to queue, then tap a cell or lane to drop the string."
                            type="button"
                          >
                            {isQueued ? 'Clear queue' : 'Queue'}
                          </button>
                        )}
                        <button
                          aria-label={`Transpose ${entry.name} up a semitone (Shift for an octave)`}
                          className="control-chip flex h-8 min-h-[2rem] min-w-[2rem] items-center justify-center px-2"
                          disabled={disabled}
                          onClick={(event) => handleTranspose(entry, event.shiftKey ? 12 : 1)}
                          title="Transpose up a semitone. Hold Shift for an octave up."
                          type="button"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          aria-label={`Transpose ${entry.name} down a semitone (Shift for an octave)`}
                          className="control-chip flex h-8 min-h-[2rem] min-w-[2rem] items-center justify-center px-2"
                          disabled={disabled}
                          onClick={(event) => handleTranspose(entry, event.shiftKey ? -12 : -1)}
                          title="Transpose down a semitone. Hold Shift for an octave down."
                          type="button"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <button
                          aria-label={`Duplicate ${entry.name}`}
                          className="control-chip flex h-8 min-h-[2rem] min-w-[2rem] items-center justify-center px-2"
                          disabled={disabled}
                          onClick={() => handleDuplicate(entry)}
                          title="Duplicate this string under a (copy) name"
                          type="button"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          aria-label={`Remove ${entry.name} from the shelf`}
                          className="control-chip flex h-8 min-h-[2rem] min-w-[2rem] items-center justify-center px-2"
                          disabled={disabled}
                          onClick={() => handleRemove(entry.id)}
                          type="button"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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
