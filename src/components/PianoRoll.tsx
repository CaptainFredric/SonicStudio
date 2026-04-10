import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Eraser,
  LayoutGrid,
  Layers3,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { type NoteEvent } from '../project/schema';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_WINDOWS = {
  HIGH: buildNoteRange(6, 4),
  LOW: buildNoteRange(4, 2),
  MID: buildNoteRange(5, 3),
} as const;
const ALL_NOTES = buildNoteRange(6, 2);

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
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);

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
      setSelectedNoteIndex(null);
      return;
    }

    const steps = track.patterns[currentPattern] ?? [];
    const firstActiveStep = steps.findIndex((step) => step.length > 0);
    const nextStepIndex = firstActiveStep >= 0 ? firstActiveStep : 0;

    setSelectedStepIndex(nextStepIndex);
    setSelectedNoteIndex(steps[nextStepIndex]?.length ? 0 : null);
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
  const patternSteps = track.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
  const activeStepCount = patternSteps.filter((step) => step.length > 0).length;
  const totalNoteCount = patternSteps.reduce((sum, step) => sum + step.length, 0);
  const stackedStepCount = patternSteps.filter((step) => step.length > 1).length;
  const selectedStep = selectedStepIndex !== null ? patternSteps[selectedStepIndex] ?? [] : [];
  const normalizedSelectedNoteIndex = selectedNoteIndex !== null && selectedStep[selectedNoteIndex]
    ? selectedNoteIndex
    : selectedStep.length > 0 ? 0 : null;
  const selectedNote = normalizedSelectedNoteIndex !== null ? selectedStep[normalizedSelectedNoteIndex] : null;

  const selectStep = (stepIndex: number) => {
    setSelectedStepIndex(stepIndex);
    const nextStep = patternSteps[stepIndex] ?? [];
    setSelectedNoteIndex(nextStep.length > 0 ? 0 : null);
  };

  const handleGridToggle = (stepIndex: number, note: string) => {
    const currentStepNotes = patternSteps[stepIndex] ?? [];
    const existingIndex = currentStepNotes.findIndex((event) => event.note === note);

    setSelectedStepIndex(stepIndex);

    if (existingIndex >= 0) {
      const remainingLength = currentStepNotes.length - 1;
      setSelectedNoteIndex(remainingLength > 0 ? Math.min(existingIndex, remainingLength - 1) : null);
    } else {
      const nextStep = sortStepNotes([
        ...currentStepNotes,
        createPreviewEvent(note, selectedNote ?? currentStepNotes.at(-1)),
      ]);
      setSelectedNoteIndex(nextStep.findIndex((event) => event.note === note));
    }

    toggleStep(track.id, stepIndex, note);
  };

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Piano roll</div>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</h2>
            <span className="rounded-sm border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: `${track.color}55`, color: track.color }}>
              {track.type}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            {isDrum
              ? 'Drum editing stays lane based here. Use the groove tools to nudge patterns quickly and keep the rack for shaping tone.'
              : 'Steps can now carry note stacks, so harmonies, octave doubles, and tighter chord voicings live inside one pattern instead of faking arrangement depth.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="surface-panel-muted flex items-center gap-4 px-4 py-3 text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm">Pattern {String.fromCharCode(65 + currentPattern)}</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {activeStepCount} active steps
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {totalNoteCount} notes
            </div>
            {!isDrum && (
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                {stackedStepCount} stacked
              </div>
            )}
          </div>

          {!isDrum && (
            <div className="surface-panel-muted flex items-center gap-2 p-1">
              {(Object.keys(NOTE_WINDOWS) as NoteWindowKey[]).map((windowKey) => (
                <WindowButton active={noteWindow === windowKey} label={windowKey} onClick={() => setNoteWindow(windowKey)} />
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
          <div className="inline-flex min-w-max flex-col overflow-hidden rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex h-10 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)]">
              <div className="w-[88px] shrink-0 border-r border-[var(--border-soft)]" />
              {Array.from({ length: stepsPerPattern }, (_, stepIndex) => {
                const noteCount = patternSteps[stepIndex]?.length ?? 0;

                return (
                  <button
                    className={`relative flex w-14 items-center justify-center border-r border-[var(--border-soft)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : ''} ${selectedStepIndex === stepIndex ? 'text-[var(--accent-strong)]' : ''}`}
                    key={stepIndex}
                    onClick={() => selectStep(stepIndex)}
                  >
                    <span className="font-mono text-[10px]">{stepIndex + 1}</span>
                    {noteCount > 1 && (
                      <span className="absolute right-1 top-1 rounded-sm bg-[rgba(10,15,21,0.8)] px-1 font-mono text-[8px] text-[var(--accent-strong)]">
                        {noteCount}
                      </span>
                    )}
                    {currentStep === stepIndex && <div className="absolute inset-x-1 bottom-1 h-[2px] rounded-full bg-[var(--accent)]" />}
                  </button>
                );
              })}
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
                    const step = patternSteps[stepIndex] ?? [];
                    const noteIndex = step.findIndex((event) => event.note === note);
                    const activeEvent = noteIndex >= 0 ? step[noteIndex] : null;
                    const isCurrent = currentStep === stepIndex;
                    const isSelected = selectedStepIndex === stepIndex;

                    return (
                      <button
                        className={`relative w-14 border-r border-[var(--border-soft)] transition-colors ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''} ${isSelected ? 'ring-1 ring-inset ring-[rgba(124,211,252,0.22)]' : ''} hover:bg-[rgba(255,255,255,0.04)]`}
                        key={`${note}-${stepIndex}`}
                        onClick={() => handleGridToggle(stepIndex, note)}
                      >
                        {activeEvent && (
                          <>
                            <span
                              className="absolute inset-y-[3px] left-[3px] rounded-md"
                              style={{
                                background: track.color,
                                boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.16)',
                                opacity: isCurrent ? 1 : 0.9,
                                width: `${Math.max(10, Math.min(52, activeEvent.gate * 14))}px`,
                              }}
                            />
                            <span
                              className="absolute bottom-1 right-1 rounded-full bg-black/25"
                              style={{
                                height: `${Math.max(3, Math.min(14, activeEvent.velocity * 14))}px`,
                                width: '4px',
                              }}
                            />
                          </>
                        )}
                        {step.length > 1 && (
                          <span className="absolute left-1 top-1 rounded-sm bg-black/20 px-1 font-mono text-[8px] text-white/80">
                            {step.length}
                          </span>
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

        <aside className="surface-panel-strong sonic-sidebar w-[320px] shrink-0 overflow-auto p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Step inspector</span>
          </div>

          {selectedStepIndex !== null ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Selected step</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {selectedStep.length} note{selectedStep.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {selectedNote ? `${selectedNote.note} · velocity ${Math.round(selectedNote.velocity * 100)} · gate ${selectedNote.gate.toFixed(2)}` : 'No note on this step yet'}
                </div>
              </div>

              {selectedStep.length > 0 && (
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[var(--accent)]" />
                    <span className="section-label">Note stack</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {selectedStep.map((event, noteIndex) => (
                      <button
                        className={`flex items-center justify-between rounded-[12px] border px-3 py-3 text-left transition-colors ${normalizedSelectedNoteIndex === noteIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
                        key={`${event.note}-${noteIndex}`}
                        onClick={() => setSelectedNoteIndex(noteIndex)}
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
                  {!isDrum && selectedNote && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const octaveNote = shiftNote(selectedNote.note, 12);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === octaveNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === octaveNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(octaveNote, selectedNote),
                          ]).findIndex((event) => event.note === octaveNote));
                          toggleStep(track.id, selectedStepIndex, octaveNote);
                        }}
                      >
                        Add +8va
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const octaveNote = shiftNote(selectedNote.note, -12);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === octaveNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === octaveNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(octaveNote, selectedNote),
                          ]).findIndex((event) => event.note === octaveNote));
                          toggleStep(track.id, selectedStepIndex, octaveNote);
                        }}
                      >
                        Add -8va
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const fifthNote = shiftNote(selectedNote.note, 7);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === fifthNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === fifthNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(fifthNote, selectedNote),
                          ]).findIndex((event) => event.note === fifthNote));
                          toggleStep(track.id, selectedStepIndex, fifthNote);
                        }}
                      >
                        Add fifth
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isDrum && (
                <div>
                  <div className="section-label">Pitch</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, -1) })}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <select
                      className="control-field h-10 flex-1 px-3 text-sm"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: event.target.value })}
                      value={selectedNote?.note ?? ''}
                    >
                      {!selectedNote && <option value="">Place a note first</option>}
                      {ALL_NOTES.map((note) => (
                        <option key={note} value={note}>
                          {note}
                        </option>
                      ))}
                    </select>
                    <button
                      className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, 1) })}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, -12) })}
                    >
                      -8va
                    </button>
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, 12) })}
                    >
                      +8va
                    </button>
                    <button
                      className="control-chip ml-auto flex items-center gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--danger)]"
                      disabled={!selectedNote}
                      onClick={() => {
                        if (!selectedNote) {
                          return;
                        }

                        const remainingLength = selectedStep.length - 1;
                        setSelectedNoteIndex(remainingLength > 0 ? Math.max(0, (normalizedSelectedNoteIndex ?? 0) - 1) : null);
                        toggleStep(track.id, selectedStepIndex, selectedNote.note);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Velocity</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedNote ? Math.round(selectedNote.velocity * 100) : 82}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                  max="1"
                  min="0.1"
                  onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { velocity: Number(event.target.value) })}
                  step="0.01"
                  type="range"
                  value={selectedNote?.velocity ?? 0.82}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Gate</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedNote ? selectedNote.gate.toFixed(2) : '1.00'}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                  max="4"
                  min="0.25"
                  onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { gate: Number(event.target.value) })}
                  step="0.25"
                  type="range"
                  value={selectedNote?.gate ?? 1}
                />
              </div>

              {!selectedNote && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Click any note cell to place a note. Stacking more notes in the same column now builds chords and octave layers directly inside the pattern.
                </p>
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
    className="rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
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

function shiftNote(note: string, semitones: number) {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return note;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return note;
  }

  const midi = (Number(match[2]) + 1) * 12 + pitchClass + semitones;
  const clampedMidi = Math.max(24, Math.min(96, midi));
  const nextPitch = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${nextPitch}${octave}`;
}

function noteToMidi(note: string) {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
}

function sortStepNotes(step: NoteEvent[]) {
  return [...step].sort((left, right) => (noteToMidi(right.note) ?? 0) - (noteToMidi(left.note) ?? 0));
}

function createPreviewEvent(note: string, template?: NoteEvent) {
  return {
    gate: template?.gate ?? 1,
    note,
    velocity: template?.velocity ?? 0.82,
  };
}
