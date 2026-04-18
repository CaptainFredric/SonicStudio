import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

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
import { phraseRowsForNote, shiftNote } from '../../noteUtils';

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
  const updateGate = (gate: number) => updateClipPatternStepEvent(
    selectedClip.id,
    selectedPhraseStepIndex,
    selectedPhraseNoteIndex,
    { gate: clampNoteGate(gate) },
  );

  return (
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
        max={NOTE_GATE_MAX}
        min={NOTE_GATE_MIN}
        onChange={(event) => updateGate(Number(event.target.value))}
        step={NOTE_GATE_FINE_STEP}
        type="range"
        value={selectedPhraseNote.gate}
      />
    </label>

    <div className="rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="section-label">Resize note</span>
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedPhraseNote.gate.toFixed(2)}x</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate - NOTE_GATE_FINE_STEP)} type="button">-0.01</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate - NOTE_GATE_MEDIUM_STEP)} type="button">-0.05</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate - NOTE_GATE_COARSE_STEP)} type="button">-0.25</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate - NOTE_GATE_JUMP_STEP)} type="button">-1</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate + NOTE_GATE_FINE_STEP)} type="button">+0.01</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate + NOTE_GATE_MEDIUM_STEP)} type="button">+0.05</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate + NOTE_GATE_COARSE_STEP)} type="button">+0.25</button>
        <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => updateGate(selectedPhraseNote.gate + NOTE_GATE_JUMP_STEP)} type="button">+1</button>
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

    <div className="flex gap-2">
      <button
        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        onClick={() => {
          onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(selectedPhraseNote.note, 7), 'add');
          onSetSelectedPhraseNoteIndex(selectedPhraseStep.length);
        }}
        type="button"
      >
        Add fifth
      </button>
      <button
        className="control-chip ml-auto flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
        onClick={() => {
          onToggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, selectedPhraseNote.note, 'remove');
          onSetSelectedPhraseNoteIndex(selectedPhraseStep.length > 1 ? Math.max(0, selectedPhraseNoteIndex - 1) : null);
        }}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  </div>
  );
};
