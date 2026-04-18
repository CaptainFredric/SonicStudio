import React from 'react';
import { Trash2 } from 'lucide-react';

import { defaultNoteForTrack, type ArrangementClip, type NoteEvent, type SampleSliceMemory, type Track } from '../../../../project/schema';
import {
  NOTE_GATE_FINE_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MIN,
  clampNoteGate,
} from '../../../../utils/noteEditing';
import { shiftNote } from '../../noteUtils';
import { NoteDetailEditor } from './NoteDetailEditor';

interface StepEditorProps {
  isStepMappedSampleTrack: boolean;
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onToggleClipPatternStep: (clipId: string, stepIndex: number, note: string, mode?: 'add' | 'remove') => void;
  selectedClip: ArrangementClip;
  selectedPhraseNote: NoteEvent | null;
  selectedPhraseNoteIndex: number | null;
  selectedPhraseSliceIndex: number | null;
  selectedPhraseStep: NoteEvent[];
  selectedPhraseStepIndex: number;
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null) => void;
  track: Track;
  updateClipPatternStepEvent: (
    clipId: string,
    stepIndex: number,
    noteIndex: number,
    updates: Partial<NoteEvent>,
  ) => void;
}

const SampleSliceEditor = ({
  onSetSelectedPhraseNoteIndex,
  sampleSlices,
  selectedClip,
  selectedPhraseSliceIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  setClipPatternStepSlice,
  updateClipPatternStepEvent,
}: {
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  sampleSlices: SampleSliceMemory[];
  selectedClip: ArrangementClip;
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
  <div className="mt-4 grid gap-3">
    <div className="grid gap-2">
      {sampleSlices.length > 0 ? sampleSlices.map((slice, index) => {
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
          max={NOTE_GATE_MAX}
          min={NOTE_GATE_MIN}
          onChange={(event) => updateClipPatternStepEvent(
            selectedClip.id,
            selectedPhraseStepIndex,
            0,
            { gate: clampNoteGate(Number(event.target.value)) },
          )}
          step={NOTE_GATE_FINE_STEP}
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
);

export const StepEditor = ({
  isStepMappedSampleTrack,
  onSetSelectedPhraseNoteIndex,
  onToggleClipPatternStep,
  selectedClip,
  selectedPhraseNote,
  selectedPhraseNoteIndex,
  selectedPhraseSliceIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  setClipPatternStepSlice,
  track,
  updateClipPatternStepEvent,
}: StepEditorProps) => (
  <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="section-label">Step editor</div>
        <div className="mt-2 text-sm text-[var(--text-primary)]">
          Step {selectedPhraseStepIndex + 1} · {selectedPhraseStep.length > 0 ? `${selectedPhraseStep.length} note${selectedPhraseStep.length === 1 ? '' : 's'}` : 'Rest'}
        </div>
      </div>
      {!isStepMappedSampleTrack && !(track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') && (
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => {
            const note = selectedPhraseNote?.note ?? defaultNoteForTrack(track);
            onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(note, 12), 'add');
            onSetSelectedPhraseNoteIndex(selectedPhraseStep.length);
          }}
        >
          Add +8va
        </button>
      )}
    </div>

    {isStepMappedSampleTrack ? (
      <SampleSliceEditor
        onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
        sampleSlices={track.source.sampleSlices}
        selectedClip={selectedClip}
        selectedPhraseSliceIndex={selectedPhraseSliceIndex}
        selectedPhraseStep={selectedPhraseStep}
        selectedPhraseStepIndex={selectedPhraseStepIndex}
        setClipPatternStepSlice={setClipPatternStepSlice}
        updateClipPatternStepEvent={updateClipPatternStepEvent}
      />
    ) : !(track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') ? (
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
            <NoteDetailEditor
              onSetSelectedPhraseNoteIndex={onSetSelectedPhraseNoteIndex}
              onToggleClipPatternStep={onToggleClipPatternStep}
              selectedClip={selectedClip}
              selectedPhraseNote={selectedPhraseNote}
              selectedPhraseNoteIndex={selectedPhraseNoteIndex}
              selectedPhraseStep={selectedPhraseStep}
              selectedPhraseStepIndex={selectedPhraseStepIndex}
              updateClipPatternStepEvent={updateClipPatternStepEvent}
            />
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
