import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkMinus,
  CopyPlus,
  Eraser,
  FolderInput,
  MapPinPlus,
  Plus,
  Repeat2,
  Save,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';

import { MAX_PATTERN_COUNT, type SavedSongSection } from '../project/schema';
import { countSavedSectionPatternSlots } from '../context/editor/songSectionEditing';
import type { SectionRange } from './arranger/types';

interface CommitInputProps {
  ariaLabel: string;
  className?: string;
  onCommit: (value: string) => void;
  value: string;
}

const CommitInput = ({ ariaLabel, className = '', onCommit, value }: CommitInputProps) => {
  const commit = (input: HTMLInputElement) => {
    const next = input.value.trim();
    if (next && next !== value) onCommit(next);
    else input.value = value;
  };

  return (
    <input
      aria-label={ariaLabel}
      className={className}
      defaultValue={value}
      key={value}
      maxLength={24}
      onBlur={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.currentTarget.value = value;
          event.currentTarget.blur();
        }
      }}
    />
  );
};

export interface SongSectionManagerContentProps {
  currentPatternCount: number;
  currentStep: number;
  focusedSectionId?: string | null;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  onClearSection: (startBeat: number, endBeat: number) => void;
  onCreateMarker: (beat: number, name: string) => void;
  onDeleteSavedSection: (savedSectionId: string) => void;
  onDeleteSection: (startBeat: number, endBeat: number) => void;
  onDuplicateSection: (startBeat: number, endBeat: number, label: string) => void;
  onInsertBlankSection: (atBeat: number, beatLength: number, name: string) => void;
  onInsertSavedSection: (savedSectionId: string, atBeat: number) => void;
  onJumpToSection: (beat: number) => void;
  onMoveMarker: (markerId: string, beat: number) => void;
  onRemoveMarker: (markerId: string) => void;
  onRenameMarker: (markerId: string, name: string) => void;
  onRenameSavedSection: (savedSectionId: string, name: string) => void;
  onSaveSection: (startBeat: number, endBeat: number, label: string) => void;
  onSetLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  savedSections: SavedSongSection[];
  sectionRanges: SectionRange[];
  songLengthInBeats: number;
}

const formatSectionLength = (beatLength: number) => {
  const bars = Math.max(1, Math.ceil(beatLength / 16));
  return `${bars} bar${bars === 1 ? '' : 's'} · ${beatLength} steps`;
};

export const SongSectionManagerContent = ({
  currentPatternCount,
  currentStep,
  focusedSectionId = null,
  loopRangeEndBeat,
  loopRangeStartBeat,
  onClearSection,
  onCreateMarker,
  onDeleteSavedSection,
  onDeleteSection,
  onDuplicateSection,
  onInsertBlankSection,
  onInsertSavedSection,
  onJumpToSection,
  onMoveMarker,
  onRemoveMarker,
  onRenameMarker,
  onRenameSavedSection,
  onSaveSection,
  onSetLoopRange,
  savedSections,
  sectionRanges,
  songLengthInBeats,
}: SongSectionManagerContentProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [newSectionName, setNewSectionName] = useState(() => `Section ${sectionRanges.length + 1}`);
  const [newSectionLength, setNewSectionLength] = useState(16);
  const [removeMenuId, setRemoveMenuId] = useState<string | null>(null);
  const playheadBoundary = Math.min(
    songLengthInBeats,
    Math.max(0, Math.round(currentStep / 16) * 16),
  );
  const playheadAtSongEnd = playheadBoundary >= songLengthInBeats;
  const existingPlayheadMarker = sectionRanges.find((section) => (
    section.id !== 'marker_fallback' && section.startBeat === playheadBoundary
  ));

  useEffect(() => {
    if (!focusedSectionId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const focused = contentRef.current?.querySelector<HTMLElement>('[data-focused="true"]');
      focused?.scrollIntoView?.({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedSectionId]);

  const addBlank = (atBeat: number) => {
    onInsertBlankSection(atBeat, newSectionLength, newSectionName);
    setNewSectionName(`Section ${sectionRanges.length + 2}`);
  };

  return (
    <div className="space-y-5" ref={contentRef}>
      <section className="border-b border-[var(--border-soft)] pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="section-label">Add a section</div>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              A marker labels existing music. A blank section inserts real time and shifts everything after it.
            </p>
          </div>
          <button
            className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            disabled={Boolean(existingPlayheadMarker) || playheadAtSongEnd}
            onClick={() => onCreateMarker(playheadBoundary, `Section ${sectionRanges.length + 1}`)}
            title={playheadAtSongEnd
              ? 'Add a blank section first to create music time at the end'
              : existingPlayheadMarker
                ? `${existingPlayheadMarker.label} already starts here`
                : `Mark step ${playheadBoundary + 1} without moving music`}
            type="button"
          >
            <MapPinPlus className="h-3.5 w-3.5" />
            {existingPlayheadMarker ? 'Already marked' : 'Mark playhead'}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            aria-label="New section name"
            className="control-field h-9 min-w-0 px-3 text-xs font-medium"
            maxLength={24}
            onChange={(event) => setNewSectionName(event.target.value)}
            value={newSectionName}
          />
          <div className="flex overflow-hidden rounded-[3px] border border-[var(--border-soft)]">
            {[16, 32, 64].map((length) => (
              <button
                className="min-w-12 border-l border-[var(--border-soft)] px-2 text-[10px] font-semibold uppercase tracking-[0.12em] first:border-l-0"
                data-active={newSectionLength === length ? 'true' : undefined}
                key={length}
                onClick={() => setNewSectionLength(length)}
                style={{ background: newSectionLength === length ? 'var(--accent-muted)' : undefined }}
                type="button"
              >
                {length / 16} bar{length > 16 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            className="control-chip flex h-9 items-center justify-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            onClick={() => addBlank(playheadBoundary)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            Insert at playhead
          </button>
          <button
            className="control-chip flex h-9 items-center justify-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            onClick={() => addBlank(songLengthInBeats)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to end
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-label">Song sections</div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Every removal choice says whether time stays or closes.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{sectionRanges.length}</span>
        </div>

        <div className="mt-3 space-y-2">
          {sectionRanges.map((section, sectionIndex) => {
            const isLooping = loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat;
            const isRemoving = removeMenuId === section.id;
            const isFallback = section.id === 'marker_fallback';
            const minimumStart = sectionIndex === 0
              ? 0
              : sectionRanges[sectionIndex - 1].startBeat + 4;
            const maximumStart = Math.max(minimumStart, section.endBeat - 4);

            return (
              <article
                className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3"
                data-focused={focusedSectionId === section.id ? 'true' : undefined}
                data-song-section-id={section.id}
                key={section.id}
                style={{ borderColor: focusedSectionId === section.id ? 'var(--accent-strong)' : undefined }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {isFallback ? (
                      <div className="h-8 px-1 text-sm font-semibold leading-8 text-[var(--text-primary)]">{section.label}</div>
                    ) : (
                      <CommitInput
                        ariaLabel={`Rename ${section.label}`}
                        className="control-field h-8 w-full px-2 text-sm font-semibold"
                        onCommit={(name) => onRenameMarker(section.id, name)}
                        value={section.label}
                      />
                    )}
                    <div className="mt-1 px-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {formatSectionLength(section.endBeat - section.startBeat)} · {section.clipCount} clip{section.clipCount === 1 ? '' : 's'}
                    </div>
                    {!isFallback && (
                      <div className="mt-2 flex items-center justify-between gap-2 px-1">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Boundary</span>
                        <div className="flex h-7 overflow-hidden rounded-[3px] border border-[var(--border-soft)]" title="Move the section boundary. Music stays in place.">
                          <button
                            aria-label={`Move ${section.label} one bar earlier`}
                            className="flex w-7 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]"
                            disabled={section.startBeat - 16 < minimumStart}
                            onClick={() => onMoveMarker(section.id, section.startBeat - 16)}
                            type="button"
                          >
                            <ArrowLeft className="h-3 w-3" />
                          </button>
                          <input
                            aria-label={`Start step for ${section.label}`}
                            className="w-14 border-x border-[var(--border-soft)] bg-transparent px-1 text-center font-mono text-[10px] text-[var(--text-primary)]"
                            defaultValue={section.startBeat + 1}
                            key={`${section.id}-${section.startBeat}`}
                            max={maximumStart + 1}
                            min={minimumStart + 1}
                            onBlur={(event) => {
                              const requestedBeat = Math.round(Number(event.currentTarget.value)) - 1;
                              if (!Number.isFinite(requestedBeat)) {
                                event.currentTarget.value = String(section.startBeat + 1);
                                return;
                              }
                              const nextBeat = Math.min(maximumStart, Math.max(minimumStart, requestedBeat));
                              if (nextBeat !== section.startBeat) onMoveMarker(section.id, nextBeat);
                              else event.currentTarget.value = String(section.startBeat + 1);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                              if (event.key === 'Escape') {
                                event.currentTarget.value = String(section.startBeat + 1);
                                event.currentTarget.blur();
                              }
                            }}
                            type="number"
                          />
                          <button
                            aria-label={`Move ${section.label} one bar later`}
                            className="flex w-7 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]"
                            disabled={section.startBeat + 16 > maximumStart}
                            onClick={() => onMoveMarker(section.id, section.startBeat + 16)}
                            type="button"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    aria-label={`Remove options for ${section.label}`}
                    className="ghost-icon-button flex h-8 w-8 shrink-0 items-center justify-center text-[var(--danger)]"
                    data-active={isRemoving ? 'true' : undefined}
                    onClick={() => setRemoveMenuId(isRemoving ? null : section.id)}
                    title="Clear music, unmark, or delete this time range"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button className="control-chip h-8 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]" onClick={() => onJumpToSection(section.startBeat)} type="button">Jump</button>
                  <button
                    className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    data-active={isLooping ? 'true' : undefined}
                    onClick={() => onSetLoopRange(isLooping ? null : section.startBeat, isLooping ? null : section.endBeat)}
                    type="button"
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    {isLooping ? 'Looping' : 'Loop'}
                  </button>
                  <button
                    className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    onClick={() => onSaveSection(section.startBeat, section.endBeat, section.label)}
                    type="button"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button
                    className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    onClick={() => onDuplicateSection(section.startBeat, section.endBeat, section.label)}
                    type="button"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    Duplicate
                  </button>
                </div>

                {isRemoving && (
                  <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">What should be removed?</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <button
                        className="control-chip flex min-h-12 items-center gap-2 px-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                        onClick={() => { onClearSection(section.startBeat, section.endBeat); setRemoveMenuId(null); }}
                        title="Remove clips in this section while preserving its duration and marker"
                        type="button"
                      >
                        <Eraser className="h-3.5 w-3.5 shrink-0" />
                        Clear music
                      </button>
                      <button
                        className="control-chip flex min-h-12 items-center gap-2 px-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                        disabled={isFallback}
                        onClick={() => { if (!isFallback) onRemoveMarker(section.id); setRemoveMenuId(null); }}
                        title="Remove only the named boundary. Music and song length stay unchanged."
                        type="button"
                      >
                        <BookmarkMinus className="h-3.5 w-3.5 shrink-0" />
                        Unmark only
                      </button>
                      <button
                        className="control-chip flex min-h-12 items-center gap-2 border-[color-mix(in_srgb,var(--danger)_45%,transparent)] px-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--danger)]"
                        onClick={() => { onDeleteSection(section.startBeat, section.endBeat); setRemoveMenuId(null); }}
                        title="Delete this entire time range and shift everything after it earlier"
                        type="button"
                      >
                        <Scissors className="h-3.5 w-3.5 shrink-0" />
                        Delete time
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[var(--border-soft)] pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-label">Saved sections</div>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Frozen musical snapshots you can insert without changing the original.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{savedSections.length}</span>
        </div>

        {savedSections.length === 0 ? (
          <div className="mt-3 rounded-[4px] border border-dashed border-[var(--border-soft)] px-3 py-5 text-center text-[11px] text-[var(--text-secondary)]">
            Save a song section to place it on this shelf.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {savedSections.map((section) => {
              const patternSlots = countSavedSectionPatternSlots(section);
              const canInsert = currentPatternCount + patternSlots <= MAX_PATTERN_COUNT;
              return (
                <article
                  className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3"
                  data-saved-section-id={section.id}
                  key={section.id}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CommitInput
                        ariaLabel={`Rename saved section ${section.name}`}
                        className="control-field h-8 w-full px-2 text-sm font-semibold"
                        onCommit={(name) => onRenameSavedSection(section.id, name)}
                        value={section.name}
                      />
                      <div className="mt-1 px-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        {formatSectionLength(section.beatLength)} · {section.clips.length} clips · {patternSlots} pattern slot{patternSlots === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      aria-label={`Delete saved section ${section.name}`}
                      className="ghost-icon-button flex h-8 w-8 shrink-0 items-center justify-center text-[var(--danger)]"
                      onClick={() => onDeleteSavedSection(section.id)}
                      title="Delete this saved snapshot. Undo can restore it."
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="control-chip flex h-9 items-center justify-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                      disabled={!canInsert}
                      onClick={() => onInsertSavedSection(section.id, playheadBoundary)}
                      title={canInsert ? 'Insert at the playhead and shift later music' : `Needs ${patternSlots} free pattern slots`}
                      type="button"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                      At playhead
                    </button>
                    <button
                      className="control-chip flex h-9 items-center justify-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                      disabled={!canInsert}
                      onClick={() => onInsertSavedSection(section.id, songLengthInBeats)}
                      title={canInsert ? 'Append this saved section to the song' : `Needs ${patternSlots} free pattern slots`}
                      type="button"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                      Add to end
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

interface SongSectionManagerDialogProps extends SongSectionManagerContentProps {
  onClose: () => void;
}

export const SongSectionManagerDialog = ({ onClose, ...props }: SongSectionManagerDialogProps) => {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = (Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[]).filter((element) => !element.hasAttribute('hidden'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90]" data-section-manager-root="true">
      <button
        aria-label="Close section manager"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby="section-manager-title"
        aria-modal="true"
        className="surface-panel absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none border-y-0 border-r-0 bg-[var(--bg-panel-strong)] shadow-[-20px_0_60px_rgba(0,0,0,0.35)] sm:w-[min(94vw,540px)]"
        ref={panelRef}
        role="dialog"
        style={{ background: 'var(--bg-control)' }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
          <div>
            <div className="section-label">Song structure</div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]" id="section-manager-title">Section manager</h2>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Build, remove, and reuse complete parts of the song.</p>
          </div>
          <button aria-label="Close section manager" className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <SongSectionManagerContent {...props} />
        </div>
      </aside>
    </div>,
    document.body,
  );
};
