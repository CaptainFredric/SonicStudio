import React from 'react';

import type { FilterMode, OscillatorShape, SampleTriggerMode } from '../../project/schema';

export const WAVEFORM_OPTIONS: OscillatorShape[] = ['sine', 'triangle', 'sawtooth', 'square'];
export const FILTER_OPTIONS: FilterMode[] = ['lowpass', 'bandpass', 'highpass'];

export type RackView = 'SOURCE' | 'SHAPE' | 'SPACE';
export type SourceSubView = 'CORE' | 'SLICES';

export const SAMPLE_WINDOW_PRESETS = [
  { end: 0.25, key: 'attack', label: 'Attack', start: 0 },
  { end: 0.65, key: 'body', label: 'Body', start: 0.2 },
  { end: 1, key: 'tail', label: 'Tail', start: 0.55 },
  { end: 0.25, key: 'q1', label: 'Q1', start: 0 },
  { end: 0.5, key: 'q2', label: 'Q2', start: 0.25 },
  { end: 0.75, key: 'q3', label: 'Q3', start: 0.5 },
  { end: 1, key: 'q4', label: 'Q4', start: 0.75 },
] as const;

export const SAMPLE_TRIGGER_MODE_OPTIONS: Array<{
  description: string;
  label: string;
  value: SampleTriggerMode;
}> = [
  { description: 'Use the selected slice for all sample playback on this track.', label: 'Active slice', value: 'active-slice' },
  { description: 'Ignore slices and play the current full source window.', label: 'Full source', value: 'full-source' },
  { description: 'Let each step choose its own slice for beat making.', label: 'Step mapped', value: 'step-mapped' },
];

export const RackSection = ({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="flex flex-col border border-[rgba(149,169,189,0.1)] bg-[rgba(255,255,255,0.015)] p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="section-label">{title}</span>
    </div>
    <div className="mt-5 flex-1">{children}</div>
  </div>
);

export const RackTab = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="flex items-center gap-2 border-b border-transparent px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    data-active={active}
    data-ui-sound="tab"
    onClick={onClick}
    style={active
      ? {
          borderBottomColor: 'rgba(124, 211, 252, 0.4)',
          color: 'var(--text-primary)',
        }
      : undefined}
    type="button"
  >
    {icon}
    {label}
  </button>
);

export const StatusCell = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-[rgba(149,169,189,0.1)] bg-[rgba(255,255,255,0.015)] px-3 py-2">
    <div className="section-label">{label}</div>
    <div className="mt-1 text-xs font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

export const InlineSlider = ({
  label,
  max,
  min,
  onChange,
  step,
  unit = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) => (
  <div>
    <div className="flex items-center justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
        {unit === 'dB'
          ? `${value.toFixed(1)} ${unit}`
          : unit === '%'
            ? `${Math.round(value * 100)}%`
            : unit
              ? `${value.toFixed(1)} ${unit}`
              : value.toFixed(1)}
      </span>
    </div>
    <input
      className="mt-3"
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      step={step}
      type="range"
      value={value}
    />
  </div>
);

export const waveformLabel = (waveform: OscillatorShape) => {
  switch (waveform) {
    case 'sawtooth':
      return 'Saw';
    case 'triangle':
      return 'Triangle';
    default:
      return waveform.charAt(0).toUpperCase() + waveform.slice(1);
  }
};

export const filterLabel = (mode: FilterMode) => {
  switch (mode) {
    case 'highpass':
      return 'High-pass';
    case 'bandpass':
      return 'Band-pass';
    default:
      return 'Low-pass';
  }
};
