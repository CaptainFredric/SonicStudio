import React from 'react';

import type { ArrangementClip } from '../../../project/schema';

interface AutomationPanelProps {
  composerStepCount: number;
  selectedAutomationLevel: number;
  selectedAutomationTone: number;
  selectedClip: ArrangementClip;
  selectedClipAutomation: {
    level: number[];
    tone: number[];
  };
  selectedPhraseStepIndex: number;
  setSelectedPhraseStepIndex: (value: number) => void;
  updateClipPatternAutomationStep: (
    clipId: string,
    stepIndex: number,
    lane: 'level' | 'tone',
    value: number,
  ) => void;
}

export const AutomationPanel = ({
  composerStepCount,
  selectedAutomationLevel,
  selectedAutomationTone,
  selectedClip,
  selectedClipAutomation,
  selectedPhraseStepIndex,
  setSelectedPhraseStepIndex,
  updateClipPatternAutomationStep,
}: AutomationPanelProps) => (
  <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="section-label">Automation</div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          Level and tone stay next to the phrase they shape.
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        Step {selectedPhraseStepIndex + 1}
      </span>
    </div>

    <div className="mt-4 space-y-3">
      <AutomationLaneRow
        label="Level"
        onSelectStep={setSelectedPhraseStepIndex}
        selectedStepIndex={selectedPhraseStepIndex}
        values={selectedClipAutomation.level.slice(0, composerStepCount)}
      />
      <AutomationLaneRow
        label="Tone"
        onSelectStep={setSelectedPhraseStepIndex}
        selectedStepIndex={selectedPhraseStepIndex}
        values={selectedClipAutomation.tone.slice(0, composerStepCount)}
      />
    </div>

    <div className="mt-4 grid gap-3">
      <label className="text-xs text-[var(--text-secondary)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Level focus</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationLevel * 100)}</span>
        </div>
        <input
          className="w-full"
          max="1"
          min="0"
          onChange={(event) => updateClipPatternAutomationStep(
            selectedClip.id,
            selectedPhraseStepIndex,
            'level',
            Number(event.target.value),
          )}
          step="0.01"
          type="range"
          value={selectedAutomationLevel}
        />
      </label>

      <label className="text-xs text-[var(--text-secondary)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Tone focus</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationTone * 100)}</span>
        </div>
        <input
          className="w-full"
          max="1"
          min="0"
          onChange={(event) => updateClipPatternAutomationStep(
            selectedClip.id,
            selectedPhraseStepIndex,
            'tone',
            Number(event.target.value),
          )}
          step="0.01"
          type="range"
          value={selectedAutomationTone}
        />
      </label>
    </div>
  </div>
);

const AutomationLaneRow = ({
  label,
  onSelectStep,
  selectedStepIndex,
  values,
}: {
  label: string;
  onSelectStep: (stepIndex: number) => void;
  selectedStepIndex: number;
  values: number[];
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        {Math.round((values[selectedStepIndex] ?? 0) * 100)}
      </span>
    </div>
    <div className="grid grid-cols-16 gap-1">
      {values.map((value, stepIndex) => (
        <button
          className={`rounded-[8px] border px-0 py-2 transition-colors ${selectedStepIndex === stepIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
          key={`${label}-${stepIndex}`}
          onClick={() => onSelectStep(stepIndex)}
        >
          <div className="mx-auto h-8 w-2 rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="w-full rounded-full bg-[var(--accent)]"
              style={{
                height: `${Math.max(8, value * 100)}%`,
                marginTop: `${Math.max(0, 100 - Math.max(8, value * 100))}%`,
              }}
            />
          </div>
        </button>
      ))}
    </div>
  </div>
);
