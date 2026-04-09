import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import type { ArrangerSection } from '../project/schema';

export const Arranger = () => {
  const { bpm, patternCount, tracks } = useAudio();
  const [sections, setSections] = useState<ArrangerSection[]>([
    {
      id: '1',
      name: 'Intro',
      patternIndex: 0,
      duration: 16,
      positionInBeats: 0,
    },
    {
      id: '2',
      name: 'Verse',
      patternIndex: 1,
      duration: 16,
      positionInBeats: 16,
    },
  ]);

  const [draggedSection, setDraggedSection] = useState<string | null>(null);

  const addSection = () => {
    const newSection: ArrangerSection = {
      id: String(Date.now()),
      name: `Section ${sections.length + 1}`,
      patternIndex: 0,
      duration: 16,
      positionInBeats: sections.length > 0 ? sections[sections.length - 1].positionInBeats + sections[sections.length - 1].duration : 0,
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, updates: Partial<ArrangerSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const totalBeats = sections.reduce((sum, s) => sum + s.duration, 0) || 64;
  const pixelsPerBeat = 12;
  const timelineWidth = totalBeats * pixelsPerBeat;

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Arranger</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Song composition</h2>
        </div>
        <button
          className="control-field flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
          onClick={addSection}
        >
          <Plus className="h-4 w-4" />
          Add section
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 p-5">
        <div className="surface-panel-strong w-[200px] shrink-0 overflow-y-auto p-4">
          <div className="section-label mb-4">Sections</div>
          <div className="space-y-2">
            {sections.map((section) => (
              <div
                key={section.id}
                className="group relative border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3 hover:bg-[rgba(255,255,255,0.04)]"
                draggable
                onDragEnd={() => setDraggedSection(null)}
                onDragStart={() => setDraggedSection(section.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                      onChange={(event) => updateSection(section.id, { name: event.target.value })}
                      value={section.name}
                    />
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      Pattern <span className="font-mono">{section.patternIndex + 1}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {Math.round((section.duration / (bpm / 60)) * 1000) / 1000}s
                    </div>
                  </div>
                  <button
                    className="ghost-icon-button flex h-8 w-8 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className="surface-panel-strong p-2 cursor-move hover:opacity-90 transition-opacity"
                      style={{
                        marginLeft: `${section.positionInBeats * pixelsPerBeat}px`,
                        width: `${section.duration * pixelsPerBeat}px`,
                        opacity: draggedSection === section.id ? 0.5 : 1,
                      }}
                    >
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {section.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                        Pattern {section.patternIndex + 1}
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
