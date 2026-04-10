import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Eraser, LayoutGrid, Minus, Plus } from 'lucide-react';

import { useAudio } from '../context/AudioContext';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_WINDOWS = {
  HIGH: buildNoteRange(6, 4),
  LOW: buildNoteRange(4, 2),
  MID: buildNoteRange(5, 3),
} as const;

type NoteWindowKey = keyof typeof NOTE_WINDOWS;

export const PianoRoll = () => {
  const {
    clearTrack,
    currentPattern,
    currentStep,
    selectedTrackId,
    shiftPattern,
    stepsPerPattern,
    toggleStep,
    tracks,
    transposePattern,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId);
  const [noteWindow, setNoteWindow] = useState<NoteWindowKey>('MID');

  useEffect(() => {
    if (!track) {
      return;
    }

    if (track.type === 'bass') {
      setNoteWindow('LOW');
      return;
    }

    if (track.type === 'fx') {
      setNoteWindow('HIGH');
      return;
    }

    setNoteWindow('MID');
  }, [track?.id, track?.type]);

  const renderNotes = useMemo(() => {
    if (!track) {
      return [];
    }

    if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
      return ['C3'];
    }

    return NOTE_WINDOWS[noteWindow];
  }, [noteWindow, track]);

  if (!track) {
    return (
      <section className="surface-panel flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="section-label">Piano roll</div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Select a track to open its note grid.</p>
        </div>
      </section>
    );
  }

  const isDrum = track.type === 'kick' || track.type === 'snare' || track.type === 'hihat';
  const patternSteps = track.patterns[currentPattern] ?? Array(stepsPerPattern).fill(null);
  const activeNoteCount = patternSteps.filter((step) => step !== null).length;

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Piano roll</div>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</h2>
            <span className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: `${track.color}55`, color: track.color }}>
              {track.type}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {isDrum
              ? 'Drum lanes stay simple here. Use shift tools to move the groove around the bar.'
              : 'Pitch editing, transposition, and bar shifting now let you shape phrases instead of only toggling notes.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[var(--text-secondary)]">
            <LayoutGrid className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm">Pattern {String.fromCharCode(65 + currentPattern)} · {activeNoteCount} active steps</span>
          </div>

          {!isDrum && (
            <div className="surface-panel-muted flex items-center gap-2 p-1">
              {(Object.keys(NOTE_WINDOWS) as NoteWindowKey[]).map((windowKey) => (
                <React.Fragment key={windowKey}>
                  <WindowButton
                    active={noteWindow === windowKey}
                    label={windowKey}
                    onClick={() => setNoteWindow(windowKey)}
                  />
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="surface-panel-muted flex items-center gap-1 p-1">
            <ToolButton label="Shift left" onClick={() => shiftPattern(track.id, 'left')}>
              <ArrowLeftRight className="h-4 w-4 rotate-180" />
            </ToolButton>
            <ToolButton label="Shift right" onClick={() => shiftPattern(track.id, 'right')}>
              <ArrowLeftRight className="h-4 w-4" />
            </ToolButton>
            {!isDrum && (
              <>
                <ToolButton label="Transpose down" onClick={() => transposePattern(track.id, -1)}>
                  <Minus className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Transpose up" onClick={() => transposePattern(track.id, 1)}>
                  <Plus className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Transpose octave down" onClick={() => transposePattern(track.id, -12)}>
                  <span className="font-mono text-[10px]">-8va</span>
                </ToolButton>
                <ToolButton label="Transpose octave up" onClick={() => transposePattern(track.id, 12)}>
                  <span className="font-mono text-[10px]">+8va</span>
                </ToolButton>
              </>
            )}
            <ToolButton label="Clear pattern" onClick={() => clearTrack(track.id)}>
              <Eraser className="h-4 w-4" />
            </ToolButton>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="inline-flex min-w-max flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
          <div className="flex h-10 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)]">
            <div className="w-[88px] shrink-0 border-r border-[var(--border-soft)]" />
            {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => (
              <div
                className={`relative flex w-14 items-center justify-center border-r border-[var(--border-soft)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
                key={stepIndex}
              >
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{stepIndex + 1}</span>
                {currentStep === stepIndex && <div className="absolute inset-x-1 bottom-1 h-[2px] rounded-full bg-[var(--accent)]" />}
              </div>
            ))}
          </div>

          {renderNotes.map((note) => {
            const isBlackKey = note.includes('#');

            return (
              <div className="flex h-9 border-b border-[var(--border-soft)]/80 last:border-b-0" key={note}>
                <div className={`flex w-[88px] shrink-0 items-center justify-between border-r border-[var(--border-soft)] px-3 font-mono text-[10px] ${isBlackKey ? 'bg-[rgba(255,255,255,0.02)] text-[var(--text-tertiary)]' : 'bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)]'}`}>
                  <span>{isDrum ? 'TRIG' : note}</span>
                  {!isDrum && note.startsWith('C') && (
                    <span className="text-[9px] text-[var(--text-tertiary)]">oct</span>
                  )}
                </div>

                {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => {
                  const isActive = patternSteps[stepIndex] === note;
                  const isCurrent = currentStep === stepIndex;

                  return (
                    <button
                      className={`relative w-14 border-r border-[var(--border-soft)] transition-colors ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''} hover:bg-[rgba(255,255,255,0.04)]`}
                      key={`${note}-${stepIndex}`}
                      onClick={() => toggleStep(track.id, stepIndex, note)}
                    >
                      {isActive && (
                        <span
                          className="absolute inset-[3px] rounded-md"
                          style={{
                            background: track.color,
                            boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.16)',
                            opacity: isCurrent ? 1 : 0.88,
                          }}
                        />
                      )}
                      {isCurrent && <span className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-white/35" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const ToolButton = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-10 min-w-10 items-center justify-center px-3"
    onClick={onClick}
    title={label}
  >
    {children}
  </button>
);

const WindowButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
    onClick={onClick}
    style={active
      ? {
          background: 'rgba(124, 211, 252, 0.14)',
          borderColor: 'rgba(124, 211, 252, 0.28)',
          color: '#d9f2ff',
        }
      : {
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'var(--border-soft)',
          color: 'var(--text-secondary)',
        }}
  >
    {label}
  </button>
);

function buildNoteRange(highOctave: number, lowOctave: number) {
  const notes: string[] = [];

  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let noteIndex = NOTE_NAMES.length - 1; noteIndex >= 0; noteIndex -= 1) {
      notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
    }
  }

  return notes;
}
