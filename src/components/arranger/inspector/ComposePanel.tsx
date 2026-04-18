import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { defaultNoteForTrack, type ArrangementClip, type NoteEvent, type Track } from '../../../project/schema';
import { DRUM_ROW_LABELS } from '../arrangerSelectors';
import { phraseRowsForNote, shiftNote } from '../noteUtils';

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
