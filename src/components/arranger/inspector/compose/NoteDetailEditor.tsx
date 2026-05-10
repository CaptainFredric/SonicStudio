import { Copy, Minus, Plus, Trash2 } from 'lucide-react';

import type { ArrangementClip, NoteEvent } from '../../../../project/schema';
import {
  NOTE_GATE_COARSE_STEP,
  NOTE_GATE_FINE_STEP,
  NOTE_GATE_JUMP_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MEDIUM_STEP,
  NOTE_GATE_MIN,
  NOTE_GATE_PRESETS,
  clampNoteGate,
} from '../../../../utils/noteEditing';
import { noteToMidi, phraseRowsForNote, shiftNote } from '../../noteUtils';

interface NoteDetailEditorProps {
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onToggleClipPatternStep: (clipId: string, stepIndex: number, note: string, mode?: 'add' | 'remove') => void;
  selectedClip: ArrangementClip;
  selectedPhraseNote: NoteEvent;
  selectedPhraseNoteIndex: number;
  selectedPhraseStep: NoteEvent[];
  selectedPhraseStepIndex: number;
  updateClipPatternStepEvent: (
    clipId: string,
    stepIndex: number,
    noteIndex: number,
    updates: Partial<NoteEvent>,
  ) => void;
}

const VELOCITY_MIN = 0.1;
const VELOCITY_MAX = 1;

const clampVelocity = (value: number) => (
  Math.max(VELOCITY_MIN, Math.min(VELOCITY_MAX, value))
);

const compareNotesDescending = (left: string, right: string) => (
  (noteToMidi(right) ?? 0) - (noteToMidi(left) ?? 0)
);

const getPredictedNoteIndex = (
  selectedPhraseStep: NoteEvent[],
  selectedPhraseNoteIndex: number,
  targetNote: string,
  mode: 'add' | 'replace',
) => {
  const nextNotes = selectedPhraseStep.map((event, noteIndex) => (
    mode === 'replace' && noteIndex === selectedPhraseNoteIndex ? targetNote : event.note
  ));

  if (mode === 'add' && !nextNotes.includes(targetNote)) {
    nextNotes.push(targetNote);
  }

  return [...nextNotes]
    .sort(compareNotesDescending)
    .findIndex((note) => note === targetNote);
};

const gateAdjustmentGroups = [
  {
    label: 'Fine',
    steps: [
      { label: '-0.01', value: -NOTE_GATE_FINE_STEP },
      { label: '+0.01', value: NOTE_GATE_FINE_STEP },
    ],
  },
  {
    label: 'Medium',
    steps: [
      { label: '-0.05', value: -NOTE_GATE_MEDIUM_STEP },
      { label: '+0.05', value: NOTE_GATE_MEDIUM_STEP },
    ],
  },
  {
    label: 'Coarse',
    steps: [
      { label: '-0.25', value: -NOTE_GATE_COARSE_STEP },
      { label: '+0.25', value: NOTE_GATE_COARSE_STEP },
    ],
  },
  {
    label: 'Jump',
    steps: [
      { label: '-1', value: -NOTE_GATE_JUMP_STEP },
      { label: '+1', value: NOTE_GATE_JUMP_STEP },
    ],
  },
] as const;

const pitchNudges = [
  { label: 'Down 12', value: -12 },
  { label: 'Down 7', value: -7 },
  { label: 'Down 1', value: -1 },
  { label: 'Up 1', value: 1 },
  { label: 'Up 7', value: 7 },
  { label: 'Up 12', value: 12 },
] as const;

const velocityPresets = [
  { label: 'Ghost', value: 0.38 },
  { label: 'Soft', value: 0.58 },
  { label: 'Firm', value: 0.82 },
  { label: 'Lead', value: 1 },
] as const;

const articulationPresets = [
  { gate: 0.25, label: 'Pluck' },
  { gate: 0.5, label: 'Short' },
  { gate: 1, label: 'Full' },
  { gate: 2, label: 'Held' },
] as const;

const harmonyActions = [
  { label: 'Add third', semitones: 4 },
  { label: 'Add fifth', semitones: 7 },
  { label: 'Add octave', semitones: 12 },
] as const;

export const NoteDetailEditor = ({
  onSetSelectedPhraseNoteIndex,
  onToggleClipPatternStep,
  selectedClip,
  selectedPhraseNote,
  selectedPhraseNoteIndex,
  selectedPhraseStep,
  selectedPhraseStepIndex,
  updateClipPatternStepEvent,
}: NoteDetailEditorProps) => {
  const updateSelectedNote = (updates: Partial<NoteEvent>) => updateClipPatternStepEvent(
    selectedClip.id,
    selectedPhraseStepIndex,
    selectedPhraseNoteIndex,
    updates,
  );

  const updateGate = (gate: number) => updateSelectedNote({ gate: clampNoteGate(gate) });
  const updateVelocity = (velocity: number) => updateSelectedNote({ velocity: clampVelocity(velocity) });

  const updatePitch = (note: string) => {
    updateSelectedNote({ note });
    const predictedIndex = getPredictedNoteIndex(
      selectedPhraseStep,
      selectedPhraseNoteIndex,
      note,
      'replace',
    );
    if (predictedIndex >= 0) {
      onSetSelectedPhraseNoteIndex(predictedIndex);
    }
  };

  const addHarmonyNote = (semitones: number) => {
    const nextNote = shiftNote(selectedPhraseNote.note, semitones);
    const existingIndex = selectedPhraseStep.findIndex((event) => event.note === nextNote);
    onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, nextNote, 'add');

    if (existingIndex >= 0) {
      onSetSelectedPhraseNoteIndex(existingIndex);
      return;
    }

    const predictedIndex = getPredictedNoteIndex(
      selectedPhraseStep,
      selectedPhraseNoteIndex,
      nextNote,
      'add',
    );
    onSetSelectedPhraseNoteIndex(predictedIndex >= 0 ? predictedIndex : selectedPhraseStep.length);
  };

  return (
    <div className="mt-4 grid gap-3">
      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-label">Selected note</div>
            <div className="mt-1 font-mono text-sm text-[var(--accent-strong)]">{selectedPhraseNote.note}</div>
          </div>
          <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Note {selectedPhraseNoteIndex + 1}
          </span>
        </div>

        <div className="note-pitch-row mt-3 grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
          <button
            aria-label="Pitch down one semitone"
            className="ghost-icon-button flex h-10 w-10 items-center justify-center"
            onClick={() => updatePitch(shiftNote(selectedPhraseNote.note, -1))}
            type="button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <select
            aria-label="Selected note pitch"
            className="control-field h-10 px-3 text-sm"
            onChange={(event) => updatePitch(event.target.value)}
            value={selectedPhraseNote.note}
          >
            {phraseRowsForNote(selectedPhraseNote.note).map((note) => (
              <option key={note} value={note}>
                {note}
              </option>
            ))}
          </select>
          <button
            aria-label="Pitch up one semitone"
            className="ghost-icon-button flex h-10 w-10 items-center justify-center"
            onClick={() => updatePitch(shiftNote(selectedPhraseNote.note, 1))}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="note-pitch-nudges mt-3 grid grid-cols-3 gap-2">
          {pitchNudges.map((nudge) => (
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              key={nudge.label}
              onClick={() => updatePitch(shiftNote(selectedPhraseNote.note, nudge.value))}
              type="button"
            >
              {nudge.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center justify-between">
          <span className="section-label">Velocity</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedPhraseNote.velocity * 100)}</span>
        </div>
        <input
          className="mt-3 w-full"
          max={VELOCITY_MAX}
          min={VELOCITY_MIN}
          onChange={(event) => updateVelocity(Number(event.target.value))}
          step="0.01"
          type="range"
          value={selectedPhraseNote.velocity}
        />
        <div className="note-velocity-presets mt-3 grid grid-cols-4 gap-2">
          {velocityPresets.map((preset) => (
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              key={preset.label}
              onClick={() => updateVelocity(preset.value)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            onClick={() => updateVelocity(selectedPhraseNote.velocity - 0.05)}
            type="button"
          >
            Softer
          </button>
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            onClick={() => updateVelocity(selectedPhraseNote.velocity + 0.05)}
            type="button"
          >
            Louder
          </button>
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center justify-between">
          <span className="section-label">Length</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedPhraseNote.gate.toFixed(2)}x</span>
        </div>
        <input
          className="mt-3 w-full"
          max={NOTE_GATE_MAX}
          min={NOTE_GATE_MIN}
          onChange={(event) => updateGate(Number(event.target.value))}
          step={NOTE_GATE_FINE_STEP}
          type="range"
          value={selectedPhraseNote.gate}
        />
        <div className="note-articulation-presets mt-3 grid grid-cols-4 gap-2">
          {articulationPresets.map((preset) => (
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              key={preset.label}
              onClick={() => updateGate(preset.gate)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="section-label">Resize note</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedPhraseNote.gate.toFixed(2)}x</span>
        </div>
        <div className="mt-3 grid gap-2">
          {gateAdjustmentGroups.map((group) => (
            <div className="note-gate-row flex items-center justify-between gap-3" key={group.label}>
              <span className="section-label text-[10px] text-[var(--text-tertiary)]">{group.label}</span>
              <div className="flex flex-wrap justify-end gap-2">
                {group.steps.map((step) => (
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    key={step.label}
                    onClick={() => updateGate(selectedPhraseNote.gate + step.value)}
                    type="button"
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {NOTE_GATE_PRESETS.map((preset) => (
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              key={preset}
              onClick={() => updateGate(preset)}
              type="button"
            >
              {preset}x
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="section-label">Harmony</div>
        <div className="note-harmony-actions mt-3 grid grid-cols-3 gap-2">
          {harmonyActions.map((action) => (
            <button
              className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              key={action.label}
              onClick={() => addHarmonyNote(action.semitones)}
              type="button"
            >
              <Copy className="h-3.5 w-3.5" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="note-editor-actions flex gap-2">
        <button
          className="control-chip ml-auto flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
          onClick={() => {
            onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, selectedPhraseNote.note, 'remove');
            onSetSelectedPhraseNoteIndex(selectedPhraseStep.length > 1 ? Math.max(0, selectedPhraseNoteIndex - 1) : null);
          }}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove note
        </button>
      </div>
    </div>
  );
};
