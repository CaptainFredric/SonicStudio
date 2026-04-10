import React from 'react';

interface KnobProps {
  color?: string;
  label: string;
  max: number;
  min: number;
  onChange: (val: number) => void;
  step?: number;
  unit?: string;
  value: number;
}

export const Knob = ({
  label,
  value,
  min,
  max,
  onChange,
  step,
  unit = '',
  color = 'var(--accent)',
}: KnobProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const rotation = (percentage / 100) * 270 - 135;
  const formattedValue = formatValue(value, unit);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-14 w-14 items-center justify-center border border-[var(--border-soft)] bg-[var(--bg-control)]" style={{borderRadius: '2px'}}>
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" fill="none" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            fill="none"
            r="22"
            stroke={color}
            strokeDasharray={`${(percentage / 100) * 138} 138`}
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>

        <div
          className="absolute h-5 w-[3px] rounded-full bg-[var(--text-primary)] origin-bottom"
          style={{ transform: `rotate(${rotation}deg) translateY(-10px)` }}
        />

        <input
          className="absolute inset-0 opacity-0 cursor-ns-resize"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step ?? (max - min) / 100}
          type="range"
          value={value}
        />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className="section-label">{label}</span>
        <span className="font-mono text-[11px] text-[var(--text-primary)]">{formattedValue}</span>
      </div>
    </div>
  );
};

const formatValue = (value: number, unit: string) => {
  if (unit === 'Hz') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k${unit}` : `${Math.round(value)}${unit}`;
  }

  if (unit === 's') {
    return `${value.toFixed(value < 1 ? 2 : 1)}${unit}`;
  }

  return unit ? `${value.toFixed(2)}${unit}` : value.toFixed(2);
};
