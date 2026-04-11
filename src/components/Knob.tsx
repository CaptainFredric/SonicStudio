import React, { useRef } from 'react';

interface KnobProps {
  color?: string;
  disabled?: boolean;
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
  disabled = false,
}: KnobProps) => {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const percentage = ((value - min) / (max - min)) * 100;
  const rotation = (percentage / 100) * 270 - 135;
  const formattedValue = formatValue(value, unit);
  const normalizedStep = step ?? (max - min) / 100;

  const applyPointerValue = (clientX: number, clientY: number) => {
    const knob = knobRef.current;
    if (!knob || disabled) {
      return;
    }

    const bounds = knob.getBoundingClientRect();
    const centerX = bounds.left + (bounds.width / 2);
    const centerY = bounds.top + (bounds.height / 2);
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const pointerAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    let normalizedAngle = pointerAngle + 90;

    if (normalizedAngle < 0) {
      normalizedAngle += 360;
    }

    if (normalizedAngle > 315) {
      normalizedAngle -= 360;
    }

    const clampedAngle = Math.max(-135, Math.min(135, normalizedAngle));
    const pointerRatio = (clampedAngle + 135) / 270;
    const rawValue = min + (max - min) * pointerRatio;
    const steppedValue = min + Math.round((rawValue - min) / normalizedStep) * normalizedStep;
    const precision = normalizedStep >= 1 ? 0 : Math.min(4, Math.max(0, `${normalizedStep}`.split('.')[1]?.length ?? 0));

    onChange(Number(Math.max(min, Math.min(max, steppedValue)).toFixed(precision)));
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${disabled ? 'opacity-45' : ''}`}>
      <div
        className={`relative flex h-14 w-14 items-center justify-center border border-[var(--border-soft)] bg-[var(--bg-control)] ${disabled ? 'cursor-not-allowed' : 'cursor-ns-resize'}`}
        onPointerDown={(event) => {
          if (disabled) {
            return;
          }

          event.preventDefault();
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
          applyPointerValue(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (disabled || event.buttons === 0) {
            return;
          }

          applyPointerValue(event.clientX, event.clientY);
        }}
        ref={knobRef}
        style={{ borderRadius: '2px', touchAction: 'none' }}
      >
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" fill="none" r="22" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            fill="none"
            r="22"
            stroke={disabled ? 'rgba(255,255,255,0.16)' : color}
            strokeDasharray={`${(percentage / 100) * 138} 138`}
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>

        <div
          className="absolute h-5 w-[3px] rounded-full bg-[var(--text-primary)] origin-bottom"
          style={{ transform: `rotate(${rotation}deg) translateY(-10px)` }}
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
