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

const KNOB_CENTER = 28;
const KNOB_RING_RADIUS = 22;
const KNOB_NEEDLE_INNER_RADIUS = 5;
const KNOB_NEEDLE_OUTER_RADIUS = 17;
const KNOB_MIN_ANGLE = -135;
const KNOB_MAX_ANGLE = 135;
const KNOB_SWEEP = KNOB_MAX_ANGLE - KNOB_MIN_ANGLE;

const pointOnKnob = (angle: number, radius: number) => {
  const radians = angle * (Math.PI / 180);
  return {
    x: KNOB_CENTER + (Math.sin(radians) * radius),
    y: KNOB_CENTER - (Math.cos(radians) * radius),
  };
};

const describeKnobArc = (startAngle: number, endAngle: number) => {
  const start = pointOnKnob(startAngle, KNOB_RING_RADIUS);
  const end = pointOnKnob(endAngle, KNOB_RING_RADIUS);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${KNOB_RING_RADIUS} ${KNOB_RING_RADIUS} 0 ${largeArcFlag} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
  ].join(' ');
};

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
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const angle = KNOB_MIN_ANGLE + (ratio * KNOB_SWEEP);
  const formattedValue = formatValue(value, unit);
  const normalizedStep = step ?? (max - min) / 100;
  const backgroundArc = describeKnobArc(KNOB_MIN_ANGLE, KNOB_MAX_ANGLE);
  const progressArc = ratio > 0.002 ? describeKnobArc(KNOB_MIN_ANGLE, angle) : '';
  const needleStart = pointOnKnob(angle, KNOB_NEEDLE_INNER_RADIUS);
  const needleEnd = pointOnKnob(angle, KNOB_NEEDLE_OUTER_RADIUS);

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
    const pointerAngle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
    const clampedAngle = Math.max(KNOB_MIN_ANGLE, Math.min(KNOB_MAX_ANGLE, pointerAngle));
    const pointerRatio = (clampedAngle - KNOB_MIN_ANGLE) / KNOB_SWEEP;
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
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 56 56">
          <path d={backgroundArc} fill="none" stroke="rgba(255,255,255,0.08)" strokeLinecap="round" strokeWidth="4" />
          {progressArc && (
            <path
              d={progressArc}
              fill="none"
              stroke={disabled ? 'rgba(255,255,255,0.16)' : color}
              strokeLinecap="round"
              strokeWidth="4"
            />
          )}
          <line
            x1={needleStart.x}
            x2={needleEnd.x}
            y1={needleStart.y}
            y2={needleEnd.y}
            fill="none"
            stroke="var(--text-primary)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
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
