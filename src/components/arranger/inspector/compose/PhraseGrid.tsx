import React from 'react';

import { defaultNoteForTrack, type NoteEvent, type Track } from '../../../../project/schema';
import { DRUM_ROW_LABELS } from '../../arrangerSelectors';

interface PhraseGridProps {
  composerSteps: NoteEvent[][];
  onBeginPaint: (note: string, stepIndex: number, isActive: boolean) => void;
  onContinuePaint: (note: string, stepIndex: number) => void;
  onSetSelectedPhraseNoteIndex: (value: number | null) => void;
  onSetSelectedPhraseStepIndex: (value: number) => void;
  phraseRows: string[];
  selectedPhraseStepIndex: number;
  track: Track;
}

export const PhraseGrid = ({
  composerSteps,
  onBeginPaint,
  onContinuePaint,
  onSetSelectedPhraseNoteIndex,
  onSetSelectedPhraseStepIndex,
  phraseRows,
  selectedPhraseStepIndex,
  track,
}: PhraseGridProps) => {
  if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
    const defaultNote = defaultNoteForTrack(track);

    return (
      <div className="mt-4">
        <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))] gap-1">
          <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {DRUM_ROW_LABELS[track.type]}
          </div>
          {composerSteps.map((step, stepIndex) => {
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
    );
  }

  return (
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
  );
};
