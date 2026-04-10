import React from 'react';
import { Layers3, Plus, Trash2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';

const PIXELS_PER_STEP = 22;

export const Arranger = () => {
  const {
    addArrangerClip,
    arrangerClips,
    bpm,
    currentStep,
    patternCount,
    removeArrangerClip,
    selectedTrackId,
    setSelectedTrackId,
    songLengthInBeats,
    tracks,
    transportMode,
    updateArrangerClip,
  } = useAudio();

  const timelineWidth = Math.max(songLengthInBeats, 32) * PIXELS_PER_STEP;
  const totalDurationSeconds = songLengthInBeats * (60 / bpm) * 0.25;

  return (
    <section className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Arranger</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Clip lanes</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Place patterns per track, extend them into phrases, and let song mode read the whole lane stack.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="section-label">Song span</div>
            <div className="mt-1 font-mono text-sm text-[var(--text-primary)]">{songLengthInBeats} steps · {totalDurationSeconds.toFixed(1)}s</div>
            <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{transportMode === 'SONG' ? 'Live transport follows these clips' : 'Switch to song mode to play this timeline'}</div>
          </div>
          <button
            className="control-field flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
            onClick={() => addArrangerClip(selectedTrackId ?? undefined)}
          >
            <Plus className="h-4 w-4" />
            Add clip
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-5">
        <div className="surface-panel-strong w-[280px] shrink-0 overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[var(--accent)]" />
            <div className="section-label">Clip inspector</div>
          </div>
          <div className="space-y-3">
            {arrangerClips.map((clip) => {
              const track = tracks.find((candidate) => candidate.id === clip.trackId);
              if (!track) {
                return null;
              }

              const selected = selectedTrackId === track.id;

              return (
                <div
                  className={`rounded-2xl border p-3 transition-colors ${selected ? 'border-[rgba(124,211,252,0.3)] bg-[rgba(124,211,252,0.08)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                  key={clip.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 text-left"
                      onClick={() => setSelectedTrackId(track.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{track.name}</span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                        Pattern {String.fromCharCode(65 + clip.patternIndex)}
                      </div>
                    </button>
                    <button
                      className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                      onClick={() => removeArrangerClip(clip.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <label className="text-xs text-[var(--text-secondary)]">
                      <span className="section-label mb-1 block">Pattern</span>
                      <select
                        className="control-field h-9 w-full px-2 text-xs"
                        onChange={(event) => updateArrangerClip(clip.id, { patternIndex: Number(event.target.value) })}
                        value={clip.patternIndex}
                      >
                        {Array.from({ length: patternCount }, (_, patternIndex) => (
                          <option key={patternIndex} value={patternIndex}>
                            {String.fromCharCode(65 + patternIndex)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-[var(--text-secondary)]">
                      <span className="section-label mb-1 block">Start</span>
                      <input
                        className="control-field h-9 w-full px-2 text-xs"
                        min={0}
                        onChange={(event) => updateArrangerClip(clip.id, { startBeat: Number(event.target.value) })}
                        type="number"
                        value={clip.startBeat}
                      />
                    </label>
                    <label className="text-xs text-[var(--text-secondary)]">
                      <span className="section-label mb-1 block">Length</span>
                      <input
                        className="control-field h-9 w-full px-2 text-xs"
                        min={4}
                        onChange={(event) => updateArrangerClip(clip.id, { beatLength: Number(event.target.value) })}
                        step={4}
                        type="number"
                        value={clip.beatLength}
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {arrangerClips.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-secondary)]">
                Add a clip to any lane and start mapping a full song path.
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="section-label mb-3">Timeline</div>
          <div className="min-h-0 flex-1 overflow-auto rounded-[24px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.24)]">
            <div className="min-h-full p-4" style={{ minWidth: `${timelineWidth}px` }}>
              <div className="grid" style={{ gridTemplateColumns: '220px minmax(0, 1fr)' }}>
                <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] px-4 py-3 backdrop-blur">
                  <div className="section-label">Track lanes</div>
                </div>
                <div className="relative border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
                  <div className="flex h-full min-w-full">
                    {Array.from({ length: Math.max(songLengthInBeats, 32) }, (_, stepIndex) => (
                      <div
                        className={`flex h-14 items-center justify-center border-r border-[rgba(151,163,180,0.08)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.025)]' : ''}`}
                        key={stepIndex}
                        style={{ width: `${PIXELS_PER_STEP}px` }}
                      >
                        <span className={`font-mono text-[10px] ${stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                          {stepIndex + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[rgba(124,211,252,0.8)]"
                    style={{ left: `${currentStep * PIXELS_PER_STEP}px` }}
                  />
                </div>

                {tracks.map((track) => {
                  const laneClips = arrangerClips.filter((clip) => clip.trackId === track.id);
                  const isSelected = selectedTrackId === track.id;

                  return (
                    <React.Fragment key={track.id}>
                      <button
                        className={`sticky left-0 z-10 flex items-center gap-3 border-b border-r border-[var(--border-soft)] px-4 py-4 text-left transition-colors ${isSelected ? 'bg-[rgba(124,211,252,0.09)]' : 'bg-[rgba(8,12,17,0.96)] hover:bg-[rgba(255,255,255,0.03)]'}`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{track.name}</div>
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
                        </div>
                      </button>
                      <div className="relative border-b border-[var(--border-soft)] py-3">
                        <div className="absolute inset-0">
                          {Array.from({ length: Math.max(songLengthInBeats, 32) }, (_, stepIndex) => (
                            <div
                              className={`${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : 'bg-transparent'} absolute inset-y-0 border-r border-[rgba(151,163,180,0.08)]`}
                              key={stepIndex}
                              style={{
                                left: `${stepIndex * PIXELS_PER_STEP}px`,
                                width: `${PIXELS_PER_STEP}px`,
                              }}
                            />
                          ))}
                        </div>
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 z-[1] w-[2px] bg-[rgba(124,211,252,0.8)]"
                          style={{ left: `${currentStep * PIXELS_PER_STEP}px` }}
                        />
                        <div className="relative z-[2] flex h-20 items-center">
                          {laneClips.map((clip) => (
                            <div
                              className="group absolute top-1/2 flex h-14 -translate-y-1/2 overflow-hidden rounded-2xl border px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.24)]"
                              key={clip.id}
                              style={{
                                background: `linear-gradient(135deg, ${track.color}33, ${track.color}1a)`,
                                borderColor: `${track.color}66`,
                                left: `${clip.startBeat * PIXELS_PER_STEP}px`,
                                width: `${clip.beatLength * PIXELS_PER_STEP}px`,
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                  {track.name}
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-[var(--text-secondary)]">
                                  <span>Pattern {String.fromCharCode(65 + clip.patternIndex)}</span>
                                  <span>{clip.beatLength} steps</span>
                                </div>
                              </div>
                              <div className="ml-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                  onClick={() => updateArrangerClip(clip.id, { startBeat: Math.max(0, clip.startBeat - 4) })}
                                >
                                  <span className="font-mono text-xs">{'<'}</span>
                                </button>
                                <button
                                  className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                  onClick={() => updateArrangerClip(clip.id, { startBeat: clip.startBeat + 4 })}
                                >
                                  <span className="font-mono text-xs">{'>'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            className={`absolute top-1/2 flex h-14 -translate-y-1/2 items-center justify-center rounded-2xl border border-dashed px-4 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${isSelected ? 'border-[rgba(124,211,252,0.26)] bg-[rgba(124,211,252,0.08)] text-[#d9f2ff]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            onClick={() => addArrangerClip(track.id)}
                            style={{
                              left: `${laneClips.reduce((maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength), 0) * PIXELS_PER_STEP}px`,
                              width: `${Math.max(4, Math.floor(PIXELS_PER_STEP * 3.5))}px`,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
