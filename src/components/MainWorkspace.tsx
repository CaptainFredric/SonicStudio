import React from 'react';
import { Copy, Eraser, Music2, Trash2 } from 'lucide-react';

import { getSamplePresetMeta } from '../audio/sampleLibrary';
import { useAudio } from '../context/AudioContext';

const TRACK_BUTTONS = [
  { label: 'Kick', type: 'kick' as const },
  { label: 'Snr', type: 'snare' as const },
  { label: 'Hat', type: 'hihat' as const },
  { label: 'Bass', type: 'bass' as const },
  { label: 'Lead', type: 'lead' as const },
  { label: 'Pad', type: 'pad' as const },
  { label: 'Pluck', type: 'pluck' as const },
  { label: 'FX', type: 'fx' as const },
];

export const MainWorkspace = () => {
  const {
    clearTrack,
    createTrack,
    currentStep,
    currentPattern,
    duplicateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    stepsPerPattern,
    toggleStep,
    tracks,
  } = useAudio();

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Sequencer</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Pattern grid</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Drums, bass, leads, pads, plucks, and motion layers now share one clip skeleton, and melodic lanes can stack notes inside a single step for thicker phrases.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TRACK_BUTTONS.map((button) => (
            <button
              className="control-chip shrink-0 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors hover:text-[var(--text-primary)]"
              key={button.type}
              onClick={() => createTrack(button.type)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
          <div className="w-[284px] shrink-0 border-r border-[var(--border-soft)] px-5 py-3">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-[var(--accent)]" />
              <span className="section-label">Tracks</span>
            </div>
          </div>
          <div className="flex flex-1">
            {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => (
              <div
                className={`flex-1 border-r border-[var(--border-soft)] flex items-center justify-center ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.035)]' : ''}`}
                key={stepIndex}
              >
                <span className={`font-mono text-[11px] ${stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {stepIndex + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {tracks.map((track) => {
            const patternSteps = track.patterns[currentPattern] || Array.from({ length: stepsPerPattern }, () => []);
            const selected = selectedTrackId === track.id;
            const sourceLabel = track.source.engine === 'sample'
              ? track.source.customSampleName ?? getSamplePresetMeta(track.source.samplePreset).label
              : waveformLabel(track.source.waveform);

            return (
              <div
                className={`flex border-b border-[var(--border-soft)] transition-colors ${selected ? 'bg-[rgba(125,211,252,0.06)]' : 'bg-transparent hover:bg-[rgba(255,255,255,0.02)]'}`}
                key={track.id}
              >
                <div
                  className="group relative w-[284px] shrink-0 border-r border-[var(--border-soft)] px-5 py-4 text-left cursor-pointer"
                  onClick={() => setSelectedTrackId(track.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedTrackId(track.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {selected && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ backgroundColor: track.color }} />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                        <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.source.engine}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{sourceLabel}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.volume.toFixed(0)} dB</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          {patternSteps.reduce((sum, step) => sum + step.length, 0)} notes
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <RowActionBtn label="Duplicate track" onClick={(event) => {
                        event.stopPropagation();
                        duplicateTrack(track.id);
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                      </RowActionBtn>
                      <RowActionBtn label="Clear pattern" onClick={(event) => {
                        event.stopPropagation();
                        clearTrack(track.id);
                      }}>
                        <Eraser className="h-3.5 w-3.5" />
                      </RowActionBtn>
                      <RowActionBtn label="Delete track" onClick={(event) => {
                        event.stopPropagation();
                        removeTrack(track.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </RowActionBtn>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 gap-[2px] px-2 py-2">
                  {patternSteps.map((value, stepIndex) => {
                    const isActive = value.length > 0;
                    const isCurrent = currentStep === stepIndex;
                    const leadEvent = value[0];
                    const extraNotes = Math.max(0, value.length - 1);
                    const maxGate = value.reduce((gate, event) => Math.max(gate, event.gate), 0);

                    return (
                      <button
                        className={`relative flex-1 border transition-colors ${isActive ? 'border-transparent' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]'} ${isCurrent ? 'ring-1 ring-inset ring-[rgba(255,255,255,0.08)]' : ''}`}
                        key={`${track.id}-${stepIndex}`}
                        onClick={() => toggleStep(track.id, stepIndex)}
                        style={isActive
                          ? {
                              background: isCurrent ? track.color : `${track.color}cc`,
                              boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.12)',
                            }
                          : undefined}
                      >
                        {isActive && !['kick', 'snare', 'hihat'].includes(track.type) && leadEvent && (
                          <span className="absolute bottom-1 right-1 font-mono text-[9px] font-medium text-black/60">
                            {leadEvent.note}
                            {extraNotes > 0 ? ` +${extraNotes}` : ''}
                          </span>
                        )}
                        {isActive && (
                          <span
                            className="absolute bottom-1 left-1 rounded-full bg-black/20"
                            style={{ height: '3px', width: `${Math.max(6, Math.min(20, maxGate * 6))}px` }}
                          />
                        )}
                        {extraNotes > 0 && (
                          <span className="absolute left-1 top-1 rounded-sm bg-black/20 px-1 font-mono text-[8px] text-white/80">
                            {value.length}
                          </span>
                        )}
                        {isCurrent && <span className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-white/50" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const RowActionBtn = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
    onClick={onClick}
  >
    {children}
  </button>
);

const waveformLabel = (waveform: 'sine' | 'triangle' | 'sawtooth' | 'square') => {
  switch (waveform) {
    case 'sawtooth':
      return 'Saw';
    case 'triangle':
      return 'Triangle';
    default:
      return waveform.charAt(0).toUpperCase() + waveform.slice(1);
  }
};
