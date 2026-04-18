import React from 'react';

import type { ArrangementClip, NoteEvent, Track } from '../../../project/schema';
import { DRUM_ROW_LABELS } from '../arrangerSelectors';
import { PhraseGrid } from './compose/PhraseGrid';
import { SampleStepMap } from './compose/SampleStepMap';
import { StepEditor } from './compose/StepEditor';

interface ComposePanelProps {
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
}

export const ComposePanel = ({
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
}: ComposePanelProps) => (
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
        <SampleStepMap
          activeSampleSlice={selectedClipTrack.source.activeSampleSlice}
          composerSteps={composerSteps}
          onBeginSlicePaint={onBeginSlicePaint}
          onContinueSlicePaint={onContinueSlicePaint}
          onSelectSampleSlice={(sliceIndex) => onSelectSampleSlice(selectedClipTrack.id, sliceIndex)}
          sampleSlices={selectedClipTrack.source.sampleSlices}
        />
      ) : (
        <PhraseGrid
          composerSteps={composerSteps}
          onBeginPaint={onBeginPaint}
          onContinuePaint={onContinuePaint}
          onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
          onSetSelectedPhraseStepIndex={onSetSelectedPhraseStepIndex}
          phraseRows={phraseRows}
          selectedPhraseStepIndex={selectedPhraseStepIndex}
          track={selectedClipTrack}
        />
      )}

      <StepEditor
        isStepMappedSampleTrack={isStepMappedSampleTrack}
        onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
        onToggleClipPatternStep={onToggleClipPatternStep}
        selectedClip={selectedClip}
        selectedPhraseNote={selectedPhraseNote}
        selectedPhraseNoteIndex={selectedPhraseNoteIndex}
        selectedPhraseSliceIndex={selectedPhraseSliceIndex}
        selectedPhraseStep={selectedPhraseStep}
        selectedPhraseStepIndex={selectedPhraseStepIndex}
        setClipPatternStepSlice={setClipPatternStepSlice}
        track={selectedClipTrack}
        updateClipPatternStepEvent={updateClipPatternStepEvent}
      />
    </div>
  </>
);
