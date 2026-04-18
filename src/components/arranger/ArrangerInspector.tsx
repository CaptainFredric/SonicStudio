import React from 'react';
import {
  Braces,
  Copy,
  Eraser,
  Layers3,
  Minus,
  MoveHorizontal,
  PencilLine,
  Plus,
  Scissors,
  Trash2,
  Wand2,
} from 'lucide-react';

import { defaultNoteForTrack, type ArrangementClip, type NoteEvent, type SongMarker, type Track } from '../../project/schema';
import { DRUM_ROW_LABELS } from './arrangerSelectors';
import type {
  InspectorTab,
  LaneSection,
  LaneSectionKey,
  SectionRange,
} from './types';

interface ArrangerInspectorProps {
  collapsedGroups: Record<LaneSectionKey, boolean>;
  composerStepCount: number;
  composerSteps: NoteEvent[][];
  createSongMarker: (beat: number, name: string) => void;
  currentStep: number;
  duplicateArrangerClip: (clipId: string) => void;
  duplicateSongRange: (startBeat: number, endBeat: number, label: string) => void;
  inspectorTab: InspectorTab;
  isOpen: boolean;
  isStepMappedSampleTrack: boolean;
  laneSections: LaneSection[];
  linkedPhraseCount: number;
  loopArrangerClip: (clipId: string, repeats: number) => void;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  makeClipPatternUnique: (clipId: string) => void;
  markerCount: number;
  onBeginPaint: (note: string, stepIndex: number, isActive: boolean) => void;
  onBeginSlicePaint: (stepIndex: number, sliceIndex: number | null, isActive: boolean) => void;
  onContinuePaint: (note: string, stepIndex: number) => void;
  onContinueSlicePaint: (stepIndex: number) => void;
  onJumpToBoundary: (step: number) => void;
  onRemoveSongMarker: (markerId: string) => void;
  onSelectSampleSlice: (trackId: string, sliceIndex: number) => void;
  onSetActiveView: (view: 'PIANO_ROLL') => void;
  onSetCurrentPattern: (patternIndex: number) => void;
  onSetInspectorTab: (tab: InspectorTab) => void;
  onSetLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onSetSelectedPhraseStepIndex: (value: number) => void;
  onSetSelectedTrackId: (trackId: string) => void;
  onToggleCollapsedGroup: (key: LaneSectionKey) => void;
  onToggleClipPatternStep: (clipId: string, stepIndex: number, note: string, mode?: 'add' | 'remove') => void;
  onTransformClipPattern: (clipId: string, transform: string, amount?: number) => void;
  onUpdateSongMarker: (markerId: string, updates: Partial<SongMarker>) => void;
  phraseRows: string[];
  phraseSummary: string;
  removeArrangerClip: (clipId: string) => void;
  sectionRanges: SectionRange[];
  selectedAutomationLevel: number;
  selectedAutomationTone: number;
  selectedClip: ArrangementClip | null;
  selectedClipAutomation: {
    level: number[];
    tone: number[];
  };
  selectedClipPattern: NoteEvent[][];
  selectedClipTrack: Track | null;
  selectedPhraseNote: NoteEvent | null;
  selectedPhraseNoteIndex: number | null;
  selectedPhraseSliceIndex: number | null;
  selectedPhraseStep: NoteEvent[];
  selectedPhraseStepIndex: number;
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null) => void;
  songMarkers: SongMarker[];
  splitArrangerClip: (clipId: string, splitBeat: number) => void;
  splitBeat: number | null;
  updateClipPatternAutomationStep: (
    clipId: string,
    stepIndex: number,
    lane: 'level' | 'tone',
    value: number,
  ) => void;
  updateClipPatternStepEvent: (
    clipId: string,
    stepIndex: number,
    noteIndex: number,
    updates: Partial<NoteEvent>,
  ) => void;
}

export const ArrangerInspector = ({
  collapsedGroups,
  composerStepCount,
  composerSteps,
  createSongMarker,
  currentStep,
  duplicateArrangerClip,
  duplicateSongRange,
  inspectorTab,
  isOpen,
  isStepMappedSampleTrack,
  laneSections,
  linkedPhraseCount,
  loopArrangerClip,
  loopRangeEndBeat,
  loopRangeStartBeat,
  makeClipPatternUnique,
  markerCount,
  onBeginPaint,
  onBeginSlicePaint,
  onContinuePaint,
  onContinueSlicePaint,
  onJumpToBoundary,
  onRemoveSongMarker,
  onSelectSampleSlice,
  onSetActiveView,
  onSetCurrentPattern,
  onSetInspectorTab,
  onSetLoopRange,
  onSetSelectedPhraseNoteIndex,
  onSetSelectedPhraseStepIndex,
  onSetSelectedTrackId,
  onToggleCollapsedGroup,
  onToggleClipPatternStep,
  onTransformClipPattern,
  onUpdateSongMarker,
  phraseRows,
  phraseSummary,
  removeArrangerClip,
  sectionRanges,
  selectedAutomationLevel,
  selectedAutomationTone,
  selectedClip,
  selectedClipAutomation,
  selectedClipTrack,
  selectedPhraseNote,
  selectedPhraseNoteIndex,
  selectedPhraseSliceIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  setClipPatternStepSlice,
  songMarkers,
  splitArrangerClip,
  splitBeat,
  updateClipPatternAutomationStep,
  updateClipPatternStepEvent,
}: ArrangerInspectorProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="sonic-sidebar min-h-0 overflow-y-auto border-b border-[var(--border-soft)] p-4 xl:border-b-0 xl:border-r xl:pr-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-[var(--accent)]" />
          <div className="section-label">Phrase desk</div>
        </div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">
          {inspectorTab === 'COMPOSE'
            ? selectedClip && selectedClipTrack ? phraseSummary : 'Select a clip to edit notes and steps here.'
            : inspectorTab === 'SHAPE'
              ? 'Transforms, automation, and clip cleanup.'
              : 'Markers, lane groups, and section actions.'}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <TabButton active={inspectorTab === 'COMPOSE'} label="Compose" onClick={() => onSetInspectorTab('COMPOSE')} />
          <TabButton active={inspectorTab === 'SHAPE'} label="Shape" onClick={() => onSetInspectorTab('SHAPE')} />
          <TabButton active={inspectorTab === 'SECTIONS'} label="Song tools" onClick={() => onSetInspectorTab('SECTIONS')} />
        </div>
      </div>

      {inspectorTab === 'SECTIONS' ? (
  <SongToolsPanel
    collapsedGroups={collapsedGroups}
    createSongMarker={createSongMarker}
    currentStep={currentStep}
    duplicateSongRange={duplicateSongRange}
    laneSections={laneSections}
          loopRangeEndBeat={loopRangeEndBeat}
          loopRangeStartBeat={loopRangeStartBeat}
          markerCount={markerCount}
          onJumpToBoundary={onJumpToBoundary}
          onRemoveSongMarker={onRemoveSongMarker}
          onSetLoopRange={onSetLoopRange}
          onToggleCollapsedGroup={onToggleCollapsedGroup}
          onUpdateSongMarker={onUpdateSongMarker}
          sectionRanges={sectionRanges}
          selectedClip={selectedClip}
          songMarkers={songMarkers}
        />
      ) : selectedClip && selectedClipTrack ? (
        <div className="space-y-4 pt-4">
          <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedClipTrack.color }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedClipTrack.name}</span>
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Pattern {String.fromCharCode(65 + selectedClip.patternIndex)} · {linkedPhraseCount > 1 ? `${linkedPhraseCount} linked clips` : 'unique phrase'}
                </div>
              </div>
            </div>

            {inspectorTab === 'COMPOSE' ? (
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span>{composerStepCount} steps</span>
                  <span className="text-[var(--text-tertiary)]">•</span>
                  <span>{selectedClip.beatLength} beat clip</span>
                  <span className="text-[var(--text-tertiary)]">•</span>
                  <span>{linkedPhraseCount > 1 ? `${linkedPhraseCount} linked clips` : 'one clip focus'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OperationButton icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate forward" onClick={() => duplicateArrangerClip(selectedClip.id)} />
                  <OperationButton
                    icon={<Layers3 className="h-3.5 w-3.5" />}
                    label="Edit in piano roll"
                    onClick={() => {
                      onSetSelectedTrackId(selectedClip.trackId);
                      onSetCurrentPattern(selectedClip.patternIndex);
                      onSetActiveView('PIANO_ROLL');
                    }}
                  />
                  {linkedPhraseCount > 1 && (
                    <OperationButton icon={<Braces className="h-3.5 w-3.5" />} label="Make unique" onClick={() => makeClipPatternUnique(selectedClip.id)} />
                  )}
                </div>
              </div>
            ) : (
              <ShapePanel
                clipId={selectedClip.id}
                loopArrangerClip={loopArrangerClip}
                makeClipPatternUnique={makeClipPatternUnique}
                onTransformClipPattern={onTransformClipPattern}
                removeArrangerClip={removeArrangerClip}
                splitArrangerClip={splitArrangerClip}
                splitBeat={splitBeat}
              />
            )}
          </div>

          {inspectorTab === 'COMPOSE' ? (
            <ComposePanel
              composerSteps={composerSteps}
              isStepMappedSampleTrack={isStepMappedSampleTrack}
              linkedPhraseCount={linkedPhraseCount}
              onBeginPaint={onBeginPaint}
              onBeginSlicePaint={onBeginSlicePaint}
              onContinuePaint={onContinuePaint}
              onContinueSlicePaint={onContinueSlicePaint}
              onSelectSampleSlice={onSelectSampleSlice}
              onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
              onSetSelectedPhraseStepIndex={onSetSelectedPhraseStepIndex}
              onToggleClipPatternStep={onToggleClipPatternStep}
              phraseRows={phraseRows}
              selectedClip={selectedClip}
              selectedClipTrack={selectedClipTrack}
              selectedPhraseNote={selectedPhraseNote}
              selectedPhraseNoteIndex={selectedPhraseNoteIndex}
              selectedPhraseSliceIndex={selectedPhraseSliceIndex}
              selectedPhraseStep={selectedPhraseStep}
              selectedPhraseStepIndex={selectedPhraseStepIndex}
              setClipPatternStepSlice={setClipPatternStepSlice}
              updateClipPatternStepEvent={updateClipPatternStepEvent}
            />
          ) : (
            <AutomationPanel
              composerStepCount={composerStepCount}
              selectedAutomationLevel={selectedAutomationLevel}
              selectedAutomationTone={selectedAutomationTone}
              selectedClip={selectedClip}
              selectedClipAutomation={selectedClipAutomation}
              selectedPhraseStepIndex={selectedPhraseStepIndex}
              setSelectedPhraseStepIndex={onSetSelectedPhraseStepIndex}
              updateClipPatternAutomationStep={updateClipPatternAutomationStep}
            />
          )}
        </div>
      ) : (
        <div className="pt-4 text-sm text-[var(--text-secondary)]">
          Select a clip to edit it here.
        </div>
      )}
    </div>
  );
};

const SongToolsPanel = ({
  collapsedGroups,
  createSongMarker,
  currentStep,
  duplicateSongRange,
  laneSections,
  loopRangeEndBeat,
  loopRangeStartBeat,
  markerCount,
  onJumpToBoundary,
  onRemoveSongMarker,
  onSetLoopRange,
  onToggleCollapsedGroup,
  onUpdateSongMarker,
  sectionRanges,
  selectedClip,
  songMarkers,
}: {
  collapsedGroups: Record<LaneSectionKey, boolean>;
  createSongMarker: (beat: number, name: string) => void;
  currentStep: number;
  duplicateSongRange: (startBeat: number, endBeat: number, label: string) => void;
  laneSections: LaneSection[];
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  markerCount: number;
  onJumpToBoundary: (step: number) => void;
  onRemoveSongMarker: (markerId: string) => void;
  onSetLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  onToggleCollapsedGroup: (key: LaneSectionKey) => void;
  onUpdateSongMarker: (markerId: string, updates: Partial<SongMarker>) => void;
  sectionRanges: SectionRange[];
  selectedClip: ArrangementClip | null;
  songMarkers: SongMarker[];
}) => (
  <div className="space-y-4 pt-4">
    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
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

    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Marker actions</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Edit marker names and jump points.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {markerCount} total
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => createSongMarker(currentStep, `Step ${currentStep + 1}`)}
        >
          Mark playhead
        </button>
        {selectedClip && (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => createSongMarker(selectedClip.startBeat, `Clip ${selectedClip.patternIndex + 1}`)}
          >
            Mark clip start
          </button>
        )}
      </div>
      <div className="mt-4 space-y-2">
        {songMarkers.length === 0 ? (
          <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
            Add markers from the playhead or selected clip.
          </div>
        ) : songMarkers.map((marker) => (
          <div key={marker.id} className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                className="control-field h-9 flex-1 px-3 text-xs font-medium"
                onChange={(event) => onUpdateSongMarker(marker.id, { name: event.target.value })}
                value={marker.name}
              />
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => onJumpToBoundary(marker.beat)}
              >
                Jump
              </button>
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                onClick={() => onRemoveSongMarker(marker.id)}
              >
                Drop
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
              <span>Step {marker.beat + 1}</span>
              <input
                className="control-field h-8 w-24 px-2 text-right font-mono text-xs"
                min={0}
                onChange={(event) => onUpdateSongMarker(marker.id, { beat: Number(event.target.value) })}
                type="number"
                value={marker.beat}
              />
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Sections</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Jump, loop, and duplicate song sections.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {sectionRanges.length} total
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {sectionRanges.map((section) => (
          <div key={section.id} className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{section.label}</div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Steps {section.startBeat + 1} to {section.endBeat} · {section.clipCount} clip{section.clipCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => onJumpToBoundary(section.startBeat)}
                >
                  Jump
                </button>
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active={loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat}
                  onClick={() => {
                    if (loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat) {
                      onSetLoopRange(null, null);
                      return;
                    }

                    onSetLoopRange(section.startBeat, section.endBeat);
                  }}
                >
                  {loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat ? 'Looping' : 'Loop'}
                </button>
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => duplicateSongRange(section.startBeat, section.endBeat, section.label)}
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ShapePanel = ({
  clipId,
  loopArrangerClip,
  makeClipPatternUnique,
  onTransformClipPattern,
  removeArrangerClip,
  splitArrangerClip,
  splitBeat,
}: {
  clipId: string;
  loopArrangerClip: (clipId: string, repeats: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  onTransformClipPattern: (clipId: string, transform: string, amount?: number) => void;
  removeArrangerClip: (clipId: string) => void;
  splitArrangerClip: (clipId: string, splitBeat: number) => void;
  splitBeat: number | null;
}) => (
  <div className="mt-4 grid gap-4">
    <div className="grid gap-3">
      <div>
        <div className="section-label">Clip</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <OperationButton icon={<Braces className="h-3.5 w-3.5" />} label="Make unique" onClick={() => makeClipPatternUnique(clipId)} />
          <OperationButton
            icon={<Scissors className="h-3.5 w-3.5" />}
            label="Split at playhead"
            onClick={() => {
              if (splitBeat !== null) {
                splitArrangerClip(clipId, splitBeat);
              }
            }}
          />
          <button
            className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)] sm:col-span-2"
            onClick={() => removeArrangerClip(clipId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove clip
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Movement</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <OperationButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift left" onClick={() => onTransformClipPattern(clipId, 'shift-left')} />
          <OperationButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift right" onClick={() => onTransformClipPattern(clipId, 'shift-right')} />
          <OperationButton icon={<Minus className="h-3.5 w-3.5" />} label="Semitone down" onClick={() => onTransformClipPattern(clipId, 'transpose', -1)} />
          <OperationButton icon={<Plus className="h-3.5 w-3.5" />} label="Semitone up" onClick={() => onTransformClipPattern(clipId, 'transpose', 1)} />
          <OperationButton icon={<Minus className="h-3.5 w-3.5" />} label="Octave down" onClick={() => onTransformClipPattern(clipId, 'transpose', -12)} />
          <OperationButton icon={<Plus className="h-3.5 w-3.5" />} label="Octave up" onClick={() => onTransformClipPattern(clipId, 'transpose', 12)} />
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] pt-3">
        <div className="section-label">Structure</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <OperationButton icon={<Layers3 className="h-3.5 w-3.5" />} label="Repeat x4" onClick={() => loopArrangerClip(clipId, 3)} />
          <OperationButton icon={<Copy className="h-3.5 w-3.5" />} label="Double density" onClick={() => onTransformClipPattern(clipId, 'double-density')} />
          <OperationButton icon={<Eraser className="h-3.5 w-3.5" />} label="Halve density" onClick={() => onTransformClipPattern(clipId, 'halve-density')} />
          <OperationButton icon={<Eraser className="h-3.5 w-3.5" />} label="Clear phrase" onClick={() => onTransformClipPattern(clipId, 'clear')} />
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] pt-3">
        <div className="section-label">Dynamics</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <OperationButton icon={<Wand2 className="h-3.5 w-3.5" />} label="Randomize velocity" onClick={() => onTransformClipPattern(clipId, 'randomize-velocity')} />
          <OperationButton icon={<PencilLine className="h-3.5 w-3.5" />} label="Reset automation" onClick={() => onTransformClipPattern(clipId, 'reset-automation')} />
        </div>
      </div>
    </div>
  </div>
);

const ComposePanel = ({
  composerSteps,
  isStepMappedSampleTrack,
  linkedPhraseCount,
  onBeginPaint,
  onBeginSlicePaint,
  onContinuePaint,
  onContinueSlicePaint,
  onSelectSampleSlice,
  onSetSelectedPhraseNoteIndex,
  onSetSelectedPhraseStepIndex,
  onToggleClipPatternStep,
  phraseRows,
  selectedClip,
  selectedClipTrack,
  selectedPhraseNote,
  selectedPhraseNoteIndex,
  selectedPhraseSliceIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  setClipPatternStepSlice,
  updateClipPatternStepEvent,
}: {
  composerSteps: NoteEvent[][];
  isStepMappedSampleTrack: boolean;
  linkedPhraseCount: number;
  onBeginPaint: (note: string, stepIndex: number, isActive: boolean) => void;
  onBeginSlicePaint: (stepIndex: number, sliceIndex: number | null, isActive: boolean) => void;
  onContinuePaint: (note: string, stepIndex: number) => void;
  onContinueSlicePaint: (stepIndex: number) => void;
  onSelectSampleSlice: (trackId: string, sliceIndex: number) => void;
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onSetSelectedPhraseStepIndex: (value: number) => void;
  onToggleClipPatternStep: (clipId: string, stepIndex: number, note: string, mode?: 'add' | 'remove') => void;
  phraseRows: string[];
  selectedClip: ArrangementClip;
  selectedClipTrack: Track;
  selectedPhraseNote: NoteEvent | null;
  selectedPhraseNoteIndex: number | null;
  selectedPhraseSliceIndex: number | null;
  selectedPhraseStep: NoteEvent[];
  selectedPhraseStepIndex: number;
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null) => void;
  updateClipPatternStepEvent: (
    clipId: string,
    stepIndex: number,
    noteIndex: number,
    updates: Partial<NoteEvent>,
  ) => void;
}) => (
  <>
    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Phrase composer</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            {isStepMappedSampleTrack
              ? 'Map saved sample slices directly to song steps.'
              : linkedPhraseCount >= 0 && DRUM_ROW_LABELS[selectedClipTrack.type]
                ? selectedClipTrack.type === 'kick' || selectedClipTrack.type === 'snare' || selectedClipTrack.type === 'hihat'
                  ? 'Paint drum triggers directly in song view.'
                  : 'Paint notes directly in song view, then shape the selected step below.'
                : 'Paint notes directly in song view, then use the step editor below.'}
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Step {selectedPhraseStepIndex + 1}
        </span>
      </div>

      {isStepMappedSampleTrack ? (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedClipTrack.source.sampleSlices.map((slice, index) => (
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={selectedClipTrack.source.activeSampleSlice === index}
                key={`${slice.label}-${index}`}
                onClick={() => onSelectSampleSlice(selectedClipTrack.id, index)}
              >
                {slice.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))] gap-1">
            <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Slice
            </div>
            {composerSteps.map((step, stepIndex) => {
              const activeSliceIndex = step[0]?.sampleSliceIndex ?? null;
              const isActive = typeof activeSliceIndex === 'number';
              const currentSliceIndex = typeof selectedClipTrack.source.activeSampleSlice === 'number'
                ? selectedClipTrack.source.activeSampleSlice
                : selectedClipTrack.source.sampleSlices[0] ? 0 : null;
              const currentSliceLabel = typeof activeSliceIndex === 'number'
                ? selectedClipTrack.source.sampleSlices[activeSliceIndex]?.label ?? `Slice ${activeSliceIndex + 1}`
                : 'Rest';

              return (
                <button
                  className={`h-12 rounded-[10px] border px-1 transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                  key={`slice-step-${stepIndex}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onBeginSlicePaint(stepIndex, currentSliceIndex, isActive && activeSliceIndex === currentSliceIndex);
                  }}
                  onPointerEnter={() => onContinueSlicePaint(stepIndex)}
                >
                  <div className="font-mono text-[10px]">{stepIndex + 1}</div>
                  <div className="mt-1 truncate text-[9px] uppercase tracking-[0.12em]">
                    {currentSliceLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : selectedClipTrack.type === 'kick' || selectedClipTrack.type === 'snare' || selectedClipTrack.type === 'hihat' ? (
        <div className="mt-4">
          <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))] gap-1">
            <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {DRUM_ROW_LABELS[selectedClipTrack.type]}
            </div>
            {composerSteps.map((step, stepIndex) => {
              const defaultNote = defaultNoteForTrack(selectedClipTrack);
              const isActive = step.some((event) => event.note === defaultNote);

              return (
                <button
                  className={`h-12 rounded-[10px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                  key={`drum-step-${stepIndex}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onBeginPaint(defaultNote, stepIndex, isActive);
                  }}
                  onPointerEnter={() => onContinuePaint(defaultNote, stepIndex)}
                >
                  <div className="font-mono text-[10px]">{stepIndex + 1}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em]">
                    {isActive ? 'Trig' : 'Rest'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-auto rounded-[14px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] p-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `72px repeat(${composerSteps.length}, minmax(0, 1fr))` }}>
            <div />
            {composerSteps.map((_, stepIndex) => (
              <div
                className={`flex h-8 items-center justify-center rounded-[8px] text-[10px] font-mono ${selectedPhraseStepIndex === stepIndex ? 'bg-[rgba(124,211,252,0.12)] text-[var(--accent-strong)]' : 'text-[var(--text-tertiary)]'}`}
                key={`step-label-${stepIndex}`}
              >
                {stepIndex + 1}
              </div>
            ))}

            {phraseRows.map((note) => (
              <React.Fragment key={note}>
                <div className="flex items-center pr-2 text-[10px] font-mono text-[var(--text-secondary)]">
                  {note}
                </div>
                {composerSteps.map((step, stepIndex) => {
                  const noteIndex = step.findIndex((event) => event.note === note);
                  const isActive = noteIndex >= 0;

                  return (
                    <button
                      className={`h-8 rounded-[8px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.16)] text-[var(--accent-strong)]' : 'border-[rgba(151,163,180,0.1)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'} ${selectedPhraseStepIndex === stepIndex ? 'ring-1 ring-[rgba(125,211,252,0.2)]' : ''}`}
                      key={`${note}-${stepIndex}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        onSetSelectedPhraseStepIndex(stepIndex);
                        onSetSelectedPhraseNoteIndex(noteIndex >= 0 ? noteIndex : 0);
                        onBeginPaint(note, stepIndex, isActive);
                      }}
                      onPointerEnter={() => onContinuePaint(note, stepIndex)}
                    >
                      {isActive ? '●' : ''}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <StepEditor
        isStepMappedSampleTrack={isStepMappedSampleTrack}
        onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
        onSetSelectedPhraseStepIndex={onSetSelectedPhraseStepIndex}
        onToggleClipPatternStep={onToggleClipPatternStep}
        selectedClip={selectedClip}
        selectedClipTrack={selectedClipTrack}
        selectedPhraseNote={selectedPhraseNote}
        selectedPhraseNoteIndex={selectedPhraseNoteIndex}
        selectedPhraseSliceIndex={selectedPhraseSliceIndex}
        selectedPhraseStep={selectedPhraseStep}
        selectedPhraseStepIndex={selectedPhraseStepIndex}
        setClipPatternStepSlice={setClipPatternStepSlice}
        updateClipPatternStepEvent={updateClipPatternStepEvent}
      />
    </div>
  </>
);

const StepEditor = ({
  isStepMappedSampleTrack,
  onSetSelectedPhraseNoteIndex,
  onSetSelectedPhraseStepIndex,
  onToggleClipPatternStep,
  selectedClip,
  selectedClipTrack,
  selectedPhraseNote,
  selectedPhraseNoteIndex,
  selectedPhraseSliceIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  setClipPatternStepSlice,
  updateClipPatternStepEvent,
}: {
  isStepMappedSampleTrack: boolean;
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onSetSelectedPhraseStepIndex: (value: number) => void;
  onToggleClipPatternStep: (clipId: string, stepIndex: number, note: string, mode?: 'add' | 'remove') => void;
  selectedClip: ArrangementClip;
  selectedClipTrack: Track;
  selectedPhraseNote: NoteEvent | null;
  selectedPhraseNoteIndex: number | null;
  selectedPhraseSliceIndex: number | null;
  selectedPhraseStep: NoteEvent[];
  selectedPhraseStepIndex: number;
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null) => void;
  updateClipPatternStepEvent: (
    clipId: string,
    stepIndex: number,
    noteIndex: number,
    updates: Partial<NoteEvent>,
  ) => void;
}) => (
  <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="section-label">Step editor</div>
        <div className="mt-2 text-sm text-[var(--text-primary)]">
          Step {selectedPhraseStepIndex + 1} · {selectedPhraseStep.length > 0 ? `${selectedPhraseStep.length} note${selectedPhraseStep.length === 1 ? '' : 's'}` : 'Rest'}
        </div>
      </div>
      {!isStepMappedSampleTrack && !(selectedClipTrack.type === 'kick' || selectedClipTrack.type === 'snare' || selectedClipTrack.type === 'hihat') && (
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => {
            const note = selectedPhraseNote?.note ?? defaultNoteForTrack(selectedClipTrack);
            onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(note, 12), 'add');
            onSetSelectedPhraseNoteIndex(selectedPhraseStep.length);
          }}
        >
          Add +8va
        </button>
      )}
    </div>

    {isStepMappedSampleTrack ? (
      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          {selectedClipTrack.source.sampleSlices.length > 0 ? selectedClipTrack.source.sampleSlices.map((slice, index) => {
            const isAssigned = selectedPhraseSliceIndex === index;
            return (
              <button
                className={`flex items-center justify-between rounded-[12px] border px-3 py-3 text-left transition-colors ${isAssigned ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
                key={`inline-${slice.label}-${index}`}
                onClick={() => {
                  onSetSelectedPhraseNoteIndex(0);
                  setClipPatternStepSlice(selectedClip.id, selectedPhraseStepIndex, index);
                }}
              >
                <div>
                  <div className="font-mono text-[12px]">{slice.label}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {Math.round(slice.start * 100)} to {Math.round(slice.end * 100)} · gain {slice.gain.toFixed(2)}
                  </div>
                </div>
                <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]">
                  {isAssigned ? 'assigned' : index + 1}
                </span>
              </button>
            );
          }) : (
            <div className="text-xs text-[var(--text-secondary)]">
              Create slices in the rack first, then map them here.
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <label className="text-xs text-[var(--text-secondary)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="section-label">Velocity</span>
              <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round((selectedPhraseStep[0]?.velocity ?? 0.82) * 100)}</span>
            </div>
            <input
              className="w-full"
              disabled={selectedPhraseStep.length === 0}
              max="1"
              min="0.1"
              onChange={(event) => updateClipPatternStepEvent(
                selectedClip.id,
                selectedPhraseStepIndex,
                0,
                { velocity: Number(event.target.value) },
              )}
              step="0.01"
              type="range"
              value={selectedPhraseStep[0]?.velocity ?? 0.82}
            />
          </label>

          <label className="text-xs text-[var(--text-secondary)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="section-label">Gate</span>
              <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{(selectedPhraseStep[0]?.gate ?? 1).toFixed(2)}</span>
            </div>
            <input
              className="w-full"
              disabled={selectedPhraseStep.length === 0}
              max="4"
              min="0.25"
              onChange={(event) => updateClipPatternStepEvent(
                selectedClip.id,
                selectedPhraseStepIndex,
                0,
                { gate: Number(event.target.value) },
              )}
              step="0.05"
              type="range"
              value={selectedPhraseStep[0]?.gate ?? 1}
            />
          </label>

          <button
            className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
            disabled={selectedPhraseStep.length === 0}
            onClick={() => setClipPatternStepSlice(selectedClip.id, selectedPhraseStepIndex, null)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear step
          </button>
        </div>
      </div>
    ) : !(selectedClipTrack.type === 'kick' || selectedClipTrack.type === 'snare' || selectedClipTrack.type === 'hihat') ? (
      selectedPhraseStep.length > 0 ? (
        <>
          <div className="mt-4 grid gap-2">
            {selectedPhraseStep.map((event, noteIndex) => (
              <button
                className={`flex items-center justify-between rounded-[12px] border px-3 py-3 text-left transition-colors ${selectedPhraseNoteIndex === noteIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
                key={`inline-${event.note}-${noteIndex}`}
                onClick={() => onSetSelectedPhraseNoteIndex(noteIndex)}
              >
                <div>
                  <div className="font-mono text-[12px]">{event.note}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Vel {Math.round(event.velocity * 100)} · Gate {event.gate.toFixed(2)}
                  </div>
                </div>
                <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]">
                  {noteIndex + 1}
                </span>
              </button>
            ))}
          </div>

          {selectedPhraseNote && selectedPhraseNoteIndex !== null && (
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
                <button
                  className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                  onClick={() => updateClipPatternStepEvent(
                    selectedClip.id,
                    selectedPhraseStepIndex,
                    selectedPhraseNoteIndex,
                    { note: shiftNote(selectedPhraseNote.note, -1) },
                  )}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <select
                  className="control-field h-10 px-3 text-sm"
                  onChange={(event) => updateClipPatternStepEvent(
                    selectedClip.id,
                    selectedPhraseStepIndex,
                    selectedPhraseNoteIndex,
                    { note: event.target.value },
                  )}
                  value={selectedPhraseNote.note}
                >
                  {phraseRowsForNote(selectedPhraseNote.note).map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                  onClick={() => updateClipPatternStepEvent(
                    selectedClip.id,
                    selectedPhraseStepIndex,
                    selectedPhraseNoteIndex,
                    { note: shiftNote(selectedPhraseNote.note, 1) },
                  )}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <label className="text-xs text-[var(--text-secondary)]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="section-label">Velocity</span>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedPhraseNote.velocity * 100)}</span>
                </div>
                <input
                  className="w-full"
                  max="1"
                  min="0.1"
                  onChange={(event) => updateClipPatternStepEvent(
                    selectedClip.id,
                    selectedPhraseStepIndex,
                    selectedPhraseNoteIndex,
                    { velocity: Number(event.target.value) },
                  )}
                  step="0.01"
                  type="range"
                  value={selectedPhraseNote.velocity}
                />
              </label>

              <label className="text-xs text-[var(--text-secondary)]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="section-label">Gate</span>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedPhraseNote.gate.toFixed(2)}</span>
                </div>
                <input
                  className="w-full"
                  max="4"
                  min="0.25"
                  onChange={(event) => updateClipPatternStepEvent(
                    selectedClip.id,
                    selectedPhraseStepIndex,
                    selectedPhraseNoteIndex,
                    { gate: Number(event.target.value) },
                  )}
                  step="0.25"
                  type="range"
                  value={selectedPhraseNote.gate}
                />
              </label>

              <div className="flex gap-2">
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => {
                    onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(selectedPhraseNote.note, 7), 'add');
                    onSetSelectedPhraseNoteIndex(selectedPhraseStep.length);
                  }}
                >
                  Add fifth
                </button>
                <button
                  className="control-chip ml-auto flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                  onClick={() => {
                    onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, selectedPhraseNote.note, 'remove');
                    onSetSelectedPhraseNoteIndex(selectedPhraseStep.length > 1 ? Math.max(0, selectedPhraseNoteIndex - 1) : null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 text-xs text-[var(--text-secondary)]">
          Paint a note in the grid, then shape it here.
        </div>
      )
    ) : (
      <div className="mt-3 text-xs text-[var(--text-secondary)]">
        Drum clips keep the step editor simple. Add or remove triggers from the grid above.
      </div>
    )}
  </div>
);

const AutomationPanel = ({
  composerStepCount,
  selectedAutomationLevel,
  selectedAutomationTone,
  selectedClip,
  selectedClipAutomation,
  selectedPhraseStepIndex,
  setSelectedPhraseStepIndex,
  updateClipPatternAutomationStep,
}: {
  composerStepCount: number;
  selectedAutomationLevel: number;
  selectedAutomationTone: number;
  selectedClip: ArrangementClip;
  selectedClipAutomation: {
    level: number[];
    tone: number[];
  };
  selectedPhraseStepIndex: number;
  setSelectedPhraseStepIndex: (value: number) => void;
  updateClipPatternAutomationStep: (
    clipId: string,
    stepIndex: number,
    lane: 'level' | 'tone',
    value: number,
  ) => void;
}) => (
  <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="section-label">Automation</div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          Level and tone stay next to the phrase they shape.
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        Step {selectedPhraseStepIndex + 1}
      </span>
    </div>

    <div className="mt-4 space-y-3">
      <AutomationLaneRow
        label="Level"
        onSelectStep={setSelectedPhraseStepIndex}
        selectedStepIndex={selectedPhraseStepIndex}
        values={selectedClipAutomation.level.slice(0, composerStepCount)}
      />
      <AutomationLaneRow
        label="Tone"
        onSelectStep={setSelectedPhraseStepIndex}
        selectedStepIndex={selectedPhraseStepIndex}
        values={selectedClipAutomation.tone.slice(0, composerStepCount)}
      />
    </div>

    <div className="mt-4 grid gap-3">
      <label className="text-xs text-[var(--text-secondary)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Level focus</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationLevel * 100)}</span>
        </div>
        <input
          className="w-full"
          max="1"
          min="0"
          onChange={(event) => updateClipPatternAutomationStep(
            selectedClip.id,
            selectedPhraseStepIndex,
            'level',
            Number(event.target.value),
          )}
          step="0.01"
          type="range"
          value={selectedAutomationLevel}
        />
      </label>

      <label className="text-xs text-[var(--text-secondary)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Tone focus</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationTone * 100)}</span>
        </div>
        <input
          className="w-full"
          max="1"
          min="0"
          onChange={(event) => updateClipPatternAutomationStep(
            selectedClip.id,
            selectedPhraseStepIndex,
            'tone',
            Number(event.target.value),
          )}
          step="0.01"
          type="range"
          value={selectedAutomationTone}
        />
      </label>
    </div>
  </div>
);

const TabButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);

const OperationButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const AutomationLaneRow = ({
  label,
  onSelectStep,
  selectedStepIndex,
  values,
}: {
  label: string;
  onSelectStep: (stepIndex: number) => void;
  selectedStepIndex: number;
  values: number[];
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        {Math.round((values[selectedStepIndex] ?? 0) * 100)}
      </span>
    </div>
    <div className="grid grid-cols-16 gap-1">
      {values.map((value, stepIndex) => (
        <button
          className={`rounded-[8px] border px-0 py-2 transition-colors ${selectedStepIndex === stepIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
          key={`${label}-${stepIndex}`}
          onClick={() => onSelectStep(stepIndex)}
        >
          <div className="mx-auto h-8 w-2 rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="w-full rounded-full bg-[var(--accent)]"
              style={{
                height: `${Math.max(8, value * 100)}%`,
                marginTop: `${Math.max(0, 100 - Math.max(8, value * 100))}%`,
              }}
            />
          </div>
        </button>
      ))}
    </div>
  </div>
);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

const midiToNote = (midi: number): string => {
  const clampedMidi = Math.max(24, Math.min(96, Math.round(midi)));
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

const shiftNote = (note: string, semitones: number) => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

const phraseRowsForNote = (currentNote: string) => {
  const rootMidi = noteToMidi(currentNote) ?? 60;
  return Array.from({ length: 13 }, (_, index) => midiToNote(rootMidi - 6 + index));
};
