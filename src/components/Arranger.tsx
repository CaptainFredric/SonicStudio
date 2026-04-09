import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';

export const Arranger = () => {
  const {
    addArrangerSection,
    arrangerSections,
    bpm,
    patternCount,
    removeArrangerSection,
    updateArrangerSection,
  } = useAudio();
  const totalBeats = arrangerSections.reduce((sum, s) => sum + s.duration, 0) || 64;
  const pixelsPerBeat = 12;
  const timelineWidth = totalBeats * pixelsPerBeat;
  const totalDurationSeconds = totalBeats * (60 / bpm);

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Arranger</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Song composition</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Persisted arrangement sections for turning loop sketches into a full song path.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right">
            <div className="section-label">Song length</div>
            <div className="mt-1 font-mono text-sm text-[var(--text-primary)]">{totalBeats} beats · {totalDurationSeconds.toFixed(1)}s</div>
          </div>
          <button
            className="control-field flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
            onClick={addArrangerSection}
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 p-5">
        <div className="surface-panel-strong w-[200px] shrink-0 overflow-y-auto p-4">
          <div className="section-label mb-4">Sections</div>
          <div className="space-y-2">
            {arrangerSections.map((section) => (
              <div
                key={section.id}
                className="group relative border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3 hover:bg-[rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                      onChange={(event) => updateArrangerSection(section.id, { name: event.target.value })}
                      value={section.name}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="section-label block mb-1">Pattern</span>
                        <select
                          className="control-field w-full px-2 py-1 text-xs"
                          onChange={(event) => updateArrangerSection(section.id, { patternIndex: Number(event.target.value) })}
                          value={section.patternIndex}
                        >
                          {Array.from({ length: patternCount }, (_, patternIndex) => (
                            <option key={patternIndex} value={patternIndex}>
                              {String.fromCharCode(65 + patternIndex)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="section-label block mb-1">Length</span>
                        <input
                          className="control-field w-full px-2 py-1 text-xs"
                          min={4}
                          onChange={(event) => updateArrangerSection(section.id, { duration: Number(event.target.value) })}
                          step={4}
                          type="number"
                          value={section.duration}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                      <span>Starts at beat {section.positionInBeats + 1}</span>
                      <span>{(section.duration * (60 / bpm)).toFixed(1)}s</span>
                    </div>
                  </div>
                  <button
                    className="ghost-icon-button flex h-8 w-8 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeArrangerSection(section.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {arrangerSections.length === 0 && (
              <div className="border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-secondary)]">
                Add sections to turn your patterns into a real arrangement.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="section-label mb-3">Timeline</div>
          <div className="flex-1 min-h-0 overflow-auto bg-[rgba(0,0,0,0.2)] border border-[var(--border-soft)]">
            <div style={{ width: `${timelineWidth}px`, minWidth: '100%', height: '100%' }} className="p-4">
              <div className="relative h-full">
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  {Array.from({ length: Math.ceil(totalBeats / 4) }).map((_, i) => (
                    <line
                      key={i}
                      x1={i * 4 * pixelsPerBeat}
                      x2={i * 4 * pixelsPerBeat}
                      y1="0"
                      y2="100%"
                      stroke="rgba(151, 163, 180, 0.08)"
                      strokeWidth="1"
                    />
                  ))}
                </svg>

                <div className="relative h-full space-y-2">
                  {arrangerSections.map((section, index) => (
                    <div
                      key={section.id}
                      className="surface-panel-strong p-3 hover:opacity-95 transition-opacity"
                      style={{
                        marginLeft: `${section.positionInBeats * pixelsPerBeat}px`,
                        width: `${section.duration * pixelsPerBeat}px`,
                        borderLeft: `3px solid hsl(${(index * 47) % 360} 70% 65%)`,
                      }}
                    >
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {section.name}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)] truncate">
                        <span>Pattern {String.fromCharCode(65 + section.patternIndex)}</span>
                        <span>{section.duration} beats</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
