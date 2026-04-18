import React from 'react';
import { Braces, Copy, Layers3 } from 'lucide-react';

import { type ArrangementClip, type NoteEvent, type SongMarker, type Track } from '../../project/schema';
import { AutomationPanel } from './inspector/AutomationPanel';
import { ComposePanel } from './inspector/ComposePanel';
import { ShapePanel } from './inspector/ShapePanel';
import { SongToolsPanel } from './inspector/SongToolsPanel';
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
