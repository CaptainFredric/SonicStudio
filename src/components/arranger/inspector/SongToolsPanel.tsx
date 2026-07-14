import React from 'react';

import { SONG_FORM_DEFINITIONS, type SongFormId } from '../../../context/editor/songFormDefinitions';
import type { ArrangementClip, SavedSongSection } from '../../../project/schema';
import { SongSectionManagerContent } from '../../SongSectionManager';
import type { LaneSection, LaneSectionKey, SectionRange } from '../types';

interface SongToolsPanelProps {
  applySongForm: (formId: SongFormId) => void;
  clearSongRange: (startBeat: number, endBeat: number) => void;
  collapsedGroups: Record<LaneSectionKey, boolean>;
  createSongMarker: (beat: number, name: string) => void;
  currentPatternCount: number;
  currentStep: number;
  deleteSongRange: (startBeat: number, endBeat: number) => void;
  duplicateSongRange: (startBeat: number, endBeat: number, label: string) => void;
  insertBlankSongSection: (atBeat: number, beatLength: number, name: string) => void;
  insertSavedSongSection: (savedSectionId: string, atBeat: number) => void;
  laneSections: LaneSection[];
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  onDeleteSavedSection: (savedSectionId: string) => void;
  onJumpToBoundary: (step: number) => void;
  onMoveSongMarker: (markerId: string, beat: number) => void;
  onRemoveSongMarker: (markerId: string) => void;
  onRenameSavedSection: (savedSectionId: string, name: string) => void;
  onSaveSongRange: (startBeat: number, endBeat: number, name: string) => void;
  onSetLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  onToggleCollapsedGroup: (key: LaneSectionKey) => void;
  onRenameSongMarker: (markerId: string, name: string) => void;
  savedSections: SavedSongSection[];
  sectionRanges: SectionRange[];
  selectedClip: ArrangementClip | null;
  songLengthInBeats: number;
}

export const SongToolsPanel = ({
  applySongForm,
  clearSongRange,
  collapsedGroups,
  createSongMarker,
  currentPatternCount,
  currentStep,
  deleteSongRange,
  duplicateSongRange,
  insertBlankSongSection,
  insertSavedSongSection,
  laneSections,
  loopRangeEndBeat,
  loopRangeStartBeat,
  onDeleteSavedSection,
  onJumpToBoundary,
  onMoveSongMarker,
  onRemoveSongMarker,
  onRenameSavedSection,
  onSaveSongRange,
  onSetLoopRange,
  onToggleCollapsedGroup,
  onRenameSongMarker,
  savedSections,
  sectionRanges,
  selectedClip,
  songLengthInBeats,
}: SongToolsPanelProps) => (
  <div className="space-y-4 pt-4">
    <div className="song-form-panel rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Song forms</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Section layouts for the current lanes.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {SONG_FORM_DEFINITIONS.length} forms
        </span>
      </div>
      <div className="song-form-grid mt-4 grid gap-2">
        {SONG_FORM_DEFINITIONS.map((definition) => {
          const totalSteps = definition.sections.reduce((sum, section) => sum + section.length, 0);

          return (
            <button
              className="song-form-card group grid gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] px-3 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.3)] hover:bg-[rgba(114,217,255,0.05)]"
              data-song-form-id={definition.id}
              data-ui-sound="action"
              key={definition.id}
              onClick={() => applySongForm(definition.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{definition.label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{definition.summary}</div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  {totalSteps}
                </span>
              </div>
              <div className="grid gap-1">
                {definition.sections.map((section) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                    key={`${definition.id}-${section.label}`}
                  >
                    <span className="truncate">{section.label}</span>
                    <span className="text-right font-mono">{section.length}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>

    <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Lane groups</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Collapse or reopen lane families.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {laneSections.length} groups
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {laneSections.map(({ key, label, lanes }) => (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            key={key}
            onClick={() => onToggleCollapsedGroup(key)}
          >
            {collapsedGroups[key] ? `Show ${label}` : `Hide ${label}`} · {lanes.length}
          </button>
        ))}
      </div>
    </div>

    {selectedClip && (
      <button
        className="control-chip w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        onClick={() => createSongMarker(selectedClip.startBeat, `Clip ${selectedClip.patternIndex + 1}`)}
        type="button"
      >
        Mark selected clip start
      </button>
    )}

    <div className="border-t border-[var(--border-soft)] pt-4">
      <SongSectionManagerContent
        currentPatternCount={currentPatternCount}
        currentStep={currentStep}
        loopRangeEndBeat={loopRangeEndBeat}
        loopRangeStartBeat={loopRangeStartBeat}
        onClearSection={clearSongRange}
        onCreateMarker={createSongMarker}
        onDeleteSavedSection={onDeleteSavedSection}
        onDeleteSection={deleteSongRange}
        onDuplicateSection={duplicateSongRange}
        onInsertBlankSection={insertBlankSongSection}
        onInsertSavedSection={insertSavedSongSection}
        onJumpToSection={onJumpToBoundary}
        onMoveMarker={onMoveSongMarker}
        onRemoveMarker={onRemoveSongMarker}
        onRenameMarker={onRenameSongMarker}
        onRenameSavedSection={onRenameSavedSection}
        onSaveSection={onSaveSongRange}
        onSetLoopRange={onSetLoopRange}
        savedSections={savedSections}
        sectionRanges={sectionRanges}
        songLengthInBeats={songLengthInBeats}
      />
    </div>
  </div>
);
