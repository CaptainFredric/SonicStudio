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

const TOUCH_TAP_THRESHOLD = 10;

interface PendingTouchAction {
  action: () => void;
  key: string;
  pointerId: number;
  startX: number;
  startY: number;
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
  const pendingTouchActionRef = React.useRef<PendingTouchAction | null>(null);
  const runKeyboardAction = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    action();
  };
  const beginPointerAction = (
    event: React.PointerEvent<HTMLButtonElement>,
    key: string,
    action: () => void,
  ) => {
    if (event.pointerType === 'mouse') {
      if (event.button !== 0) {
        return;
      }

      action();
      return;
    }

    pendingTouchActionRef.current = {
      action,
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };
  const finishPointerAction = (
    event: React.PointerEvent<HTMLButtonElement>,
    key: string,
  ) => {
    const pendingTouchAction = pendingTouchActionRef.current;
    if (
      !pendingTouchAction
      || pendingTouchAction.key !== key
      || pendingTouchAction.pointerId !== event.pointerId
    ) {
      return;
    }

    pendingTouchActionRef.current = null;
    const movedX = Math.abs(event.clientX - pendingTouchAction.startX);
    const movedY = Math.abs(event.clientY - pendingTouchAction.startY);
    if (movedX <= TOUCH_TAP_THRESHOLD && movedY <= TOUCH_TAP_THRESHOLD) {
      pendingTouchAction.action();
    }
  };
  const clearPointerAction = (key: string) => {
    if (pendingTouchActionRef.current?.key === key) {
      pendingTouchActionRef.current = null;
    }
  };

  if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
    const defaultNote = defaultNoteForTrack(track);
    const stepWidth = 54;
    const labelWidth = 76;
    const gridWidth = labelWidth + (composerSteps.length * stepWidth);

    return (
      <div className="phrase-grid-scroll mt-4 overflow-x-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.16)] p-2">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `${labelWidth}px repeat(${composerSteps.length}, minmax(${stepWidth}px, 1fr))`,
            minWidth: `${gridWidth}px`,
          }}
        >
          <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {DRUM_ROW_LABELS[track.type]}
          </div>
          {composerSteps.map((step, stepIndex) => {
            const isActive = step.some((event) => event.note === defaultNote);
            const actionKey = `${defaultNote}-${stepIndex}`;
            const toggleStep = () => onBeginPaint(defaultNote, stepIndex, isActive);

            return (
              <button
                aria-label={`Step ${stepIndex + 1} ${isActive ? 'hit' : 'rest'}`}
                className={`phrase-step-button h-14 rounded-[3px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                key={`drum-step-${stepIndex}`}
                onKeyDown={(event) => runKeyboardAction(event, toggleStep)}
                onPointerCancel={() => clearPointerAction(actionKey)}
                onPointerDown={(event) => beginPointerAction(event, actionKey, toggleStep)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') {
                    onContinuePaint(defaultNote, stepIndex);
                  }
                }}
                onPointerLeave={() => clearPointerAction(actionKey)}
                onPointerUp={(event) => finishPointerAction(event, actionKey)}
              >
                <div className="font-mono text-[10px]">{stepIndex + 1}</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.08em]">
                  {isActive ? 'Hit' : 'Rest'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const stepWidth = 38;
  const labelWidth = 72;
  const gridWidth = labelWidth + (composerSteps.length * stepWidth);

  return (
    <div className="phrase-grid-scroll mt-4 overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] p-2">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `${labelWidth}px repeat(${composerSteps.length}, minmax(${stepWidth}px, 1fr))`,
          minWidth: `${gridWidth}px`,
        }}
      >
        <div />
        {composerSteps.map((_, stepIndex) => (
          <div
            className={`flex h-8 items-center justify-center rounded-[3px] text-[10px] font-mono ${selectedPhraseStepIndex === stepIndex ? 'bg-[rgba(124,211,252,0.12)] text-[var(--accent-strong)]' : 'text-[var(--text-tertiary)]'}`}
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
              const actionKey = `${note}-${stepIndex}`;
              const toggleStep = () => {
                onSetSelectedPhraseStepIndex(stepIndex);
                onSetSelectedPhraseNoteIndex(noteIndex >= 0 ? noteIndex : 0);
                onBeginPaint(note, stepIndex, isActive);
              };

              return (
                <button
                  aria-label={`${note} step ${stepIndex + 1} ${isActive ? 'on' : 'off'}`}
                  className={`phrase-step-button h-8 rounded-[3px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.16)] text-[var(--accent-strong)]' : 'border-[rgba(151,163,180,0.1)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'} ${selectedPhraseStepIndex === stepIndex ? 'ring-1 ring-[rgba(125,211,252,0.2)]' : ''}`}
                  key={`${note}-${stepIndex}`}
                  onKeyDown={(event) => runKeyboardAction(event, toggleStep)}
                  onPointerCancel={() => clearPointerAction(actionKey)}
                  onPointerDown={(event) => beginPointerAction(event, actionKey, toggleStep)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') {
                      onContinuePaint(note, stepIndex);
                    }
                  }}
                  onPointerLeave={() => clearPointerAction(actionKey)}
                  onPointerUp={(event) => finishPointerAction(event, actionKey)}
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
