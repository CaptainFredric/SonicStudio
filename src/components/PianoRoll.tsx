import React from 'react';
import { LayoutGrid } from 'lucide-react';

import { useAudio } from '../context/AudioContext';

const NOTES = ['C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4', 'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'];

export const PianoRoll = () => {
  const { currentPattern, currentStep, selectedTrackId, stepsPerPattern, toggleStep, tracks } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId);

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

  const isDrum = ['kick', 'snare', 'hihat'].includes(track.type);
  const renderNotes = isDrum ? ['C3'] : NOTES;

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Piano roll</div>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</h2>
            <span className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: `${track.color}55`, color: track.color }}>
              {track.type}
            </span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[var(--text-secondary)]">
          <LayoutGrid className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm">Pattern {String.fromCharCode(65 + currentPattern)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="inline-flex min-w-max flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
          <div className="flex h-10 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)]">
            <div className="w-[76px] shrink-0 border-r border-[var(--border-soft)]" />
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
            const patternSteps = track.patterns[currentPattern] || Array(stepsPerPattern).fill(null);

            return (
              <div className="flex h-9 border-b border-[var(--border-soft)]/80 last:border-b-0" key={note}>
                <div className={`w-[76px] shrink-0 border-r border-[var(--border-soft)] px-3 flex items-center justify-end font-mono text-[10px] ${isBlackKey ? 'bg-[rgba(255,255,255,0.02)] text-[var(--text-tertiary)]' : 'bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)]'}`}>
                  {isDrum ? 'TRIG' : note}
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