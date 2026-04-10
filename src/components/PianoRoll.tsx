import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Eraser, LayoutGrid, Minus, Plus, SlidersHorizontal } from 'lucide-react';

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
    updateStepEvent,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId);
  const [noteWindow, setNoteWindow] = useState<NoteWindowKey>('MID');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (!track) {
      setSelectedStepIndex(null);
      return;
    }

    const firstActiveStep = (track.patterns[currentPattern] ?? []).findIndex((step) => step !== null);
    setSelectedStepIndex(firstActiveStep >= 0 ? firstActiveStep : 0);
  }, [currentPattern, track?.id]);

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
  const selectedStep = selectedStepIndex !== null ? patternSteps[selectedStepIndex] : null;

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
              : 'Each step now stores pitch, velocity, and gate, so phrases can breathe instead of sounding flat.'}
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

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="inline-flex min-w-max flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
            <div className="flex h-10 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)]">
              <div className="w-[88px] shrink-0 border-r border-[var(--border-soft)]" />
              {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => (
                <button
                  className={`relative flex w-14 items-center justify-center border-r border-[var(--border-soft)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : ''} ${selectedStepIndex === stepIndex ? 'text-[var(--accent-strong)]' : ''}`}
                  key={stepIndex}
                  onClick={() => setSelectedStepIndex(stepIndex)}
                >
                  <span className="font-mono text-[10px]">{stepIndex + 1}</span>
                  {currentStep === stepIndex && <div className="absolute inset-x-1 bottom-1 h-[2px] rounded-full bg-[var(--accent)]" />}
                </button>
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
                    const step = patternSteps[stepIndex];
                    const isActive = step?.note === note;
                    const isCurrent = currentStep === stepIndex;
                    const isSelected = selectedStepIndex === stepIndex;

                    return (
                      <button
                        className={`relative w-14 border-r border-[var(--border-soft)] transition-colors ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''} ${isSelected ? 'ring-1 ring-inset ring-[rgba(124,211,252,0.22)]' : ''} hover:bg-[rgba(255,255,255,0.04)]`}
                        key={`${note}-${stepIndex}`}
                        onClick={() => {
                          setSelectedStepIndex(stepIndex);
                          toggleStep(track.id, stepIndex, note);
                        }}
                      >
                        {isActive && step && (
                          <>
                            <span
                              className="absolute inset-y-[3px] left-[3px] rounded-md"
                              style={{
                                background: track.color,
                                boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.16)',
                                opacity: isCurrent ? 1 : 0.88,
                                width: `${Math.max(10, Math.min(52, step.gate * 14))}px`,
                              }}
                            />
                            <span
                              className="absolute bottom-1 right-1 rounded-full bg-black/25"
                              style={{
                                height: `${Math.max(3, Math.min(14, step.velocity * 14))}px`,
                                width: '4px',
                              }}
                            />
                          </>
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

        <aside className="surface-panel-strong w-[280px] shrink-0 overflow-auto p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Step inspector</span>
          </div>

          {selectedStepIndex !== null ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Selected step</div>
                <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {selectedStep ? `${selectedStep.note} · velocity ${Math.round(selectedStep.velocity * 100)} · gate ${selectedStep.gate.toFixed(2)}` : 'No note on this step yet'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Velocity</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedStep ? Math.round(selectedStep.velocity * 100) : 82}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedStep}
                  max="1"
                  min="0.1"
                  onChange={(event) => updateStepEvent(track.id, selectedStepIndex, { velocity: Number(event.target.value) })}
                  step="0.01"
                  type="range"
                  value={selectedStep?.velocity ?? 0.82}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Gate</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedStep ? selectedStep.gate.toFixed(2) : '1.00'}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedStep}
                  max="4"
                  min="0.25"
                  onChange={(event) => updateStepEvent(track.id, selectedStepIndex, { gate: Number(event.target.value) })}
                  step="0.25"
                  type="range"
                  value={selectedStep?.gate ?? 1}
                />
              </div>

              {!selectedStep && (
                <p className="text-xs text-[var(--text-secondary)]">Click any note cell to place a note, then shape its dynamics and hold length here.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Choose a step to edit its performance details.</p>
          )}
        </aside>
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
