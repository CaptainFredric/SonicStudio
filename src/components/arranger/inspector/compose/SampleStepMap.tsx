import React from 'react';

import type { NoteEvent, SampleSliceMemory } from '../../../../project/schema';

interface SampleStepMapProps {
  activeSampleSlice: number | null;
  composerSteps: NoteEvent[][];
  onBeginSlicePaint: (stepIndex: number, sliceIndex: number | null, isActive: boolean) => void;
  onContinueSlicePaint: (stepIndex: number) => void;
  onSelectSampleSlice: (sliceIndex: number) => void;
  sampleSlices: SampleSliceMemory[];
}

export const SampleStepMap = ({
  activeSampleSlice,
  composerSteps,
  onBeginSlicePaint,
  onContinueSlicePaint,
  onSelectSampleSlice,
  sampleSlices,
}: SampleStepMapProps) => (
  <div className="mt-4">
    <div className="mb-3 flex flex-wrap gap-2">
      {sampleSlices.map((slice, index) => (
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          data-active={activeSampleSlice === index}
          key={`${slice.label}-${index}`}
          onClick={() => onSelectSampleSlice(index)}
        >
          {slice.label}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))] gap-1">
      <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        Slice
      </div>
      {composerSteps.map((step, stepIndex) => {
        const activeSliceIndex = step[0]?.sampleSliceIndex ?? null;
        const isActive = typeof activeSliceIndex === 'number';
        const currentSliceIndex = typeof activeSampleSlice === 'number'
          ? activeSampleSlice
          : sampleSlices[0] ? 0 : null;
        const currentSliceLabel = typeof activeSliceIndex === 'number'
          ? sampleSlices[activeSliceIndex]?.label ?? `Slice ${activeSliceIndex + 1}`
          : 'Rest';

        return (
          <button
            className={`h-12 rounded-[10px] border px-1 transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'}`}
            key={`slice-step-${stepIndex}`}
            onPointerDown={(event) => {
              event.preventDefault();
              onBeginSlicePaint(stepIndex, currentSliceIndex, isActive && activeSliceIndex === currentSliceIndex);
            }}
            onPointerEnter={() => onContinueSlicePaint(stepIndex)}
          >
            <div className="font-mono text-[10px]">{stepIndex + 1}</div>
            <div className="mt-1 truncate text-[9px] uppercase tracking-[0.12em]">
              {currentSliceLabel}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
