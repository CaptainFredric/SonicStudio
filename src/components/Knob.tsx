import React, { useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface KnobProps {
  color?: string;
  disabled?: boolean;
  help?: string;
  label: string;
  max: number;
  min: number;
  onChange: (val: number) => void;
  step?: number;
  unit?: string;
  value: number;
}

const KNOB_HELP: Record<string, string> = {
  Attack: 'Time for a note to reach full level. Raise it to soften the front edge.',
  Chorus: 'Sends the lane into a widened, modulated copy. Add it for width and movement.',
  Crush: 'Reduces digital resolution. Increase it for grain, grit, and lo-fi edges.',
  Cutoff: 'Sets the filter edge. Lower values remove more highs and darken the sound.',
  Decay: 'Time to fall from the peak toward sustain. It shapes the body after the attack.',
  Delay: 'Sends the lane to timed echoes. Use it for rhythmic space around the dry note.',
  Detune: 'Offsets pitch in cents. Use small amounts for tuning or larger ones for effects.',
  Drive: 'Adds harmonic distortion before output. Use it for density and bite.',
  'Env amt': 'Controls how strongly each note sweeps the filter. Raise it for more tonal movement.',
  'Env fall': 'Sets how quickly the filter sweep relaxes. Short is plucky; long is broader.',
  Glide: 'Slides between consecutive synth notes. Raise it for smoother legato movement.',
  High: 'Adjusts the bright upper range of the master output. Use it for clarity or to tame harshness.',
  Low: 'Adjusts the bass range of the master output. Use it for weight or to clear excess rumble.',
  Mid: 'Adjusts the center range of the master output. Use it to shape presence and reduce congestion.',
  Octave: 'Shifts the source by whole octaves. Use it to place the lane higher or lower.',
  Release: 'Time for sound to fade after note off. Raise it for a longer tail.',
  Res: 'Emphasizes the cutoff frequency. Raise it for a sharper, more vocal filter tone.',
  Reverb: 'Sends the lane into room reflections. Use it to add depth and distance.',
  Sustain: 'Level held while a note continues. Raise it for a fuller held tone.',
  Unison: 'Blends detuned synth voices. Raise it for width and thickness.',
  'Vib depth': 'Sets how far vibrato bends pitch around each note. Keep it low for natural motion.',
  'Vib rate': 'Sets how fast vibrato cycles. Faster rates create a tighter shimmer.',
};

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
  help,
}: KnobProps) => {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const helpId = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpText = help ?? KNOB_HELP[label] ?? `${label} changes this lane's sound. Adjust it while auditioning to hear the result.`;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const angle = KNOB_MIN_ANGLE + (ratio * KNOB_SWEEP);
  const formattedValue = formatValue(value, unit);
  const normalizedStep = step ?? (max - min) / 100;
  const backgroundArc = describeKnobArc(KNOB_MIN_ANGLE, KNOB_MAX_ANGLE);
  const progressArc = ratio > 0.002 ? describeKnobArc(KNOB_MIN_ANGLE, angle) : '';
  const needleStart = pointOnKnob(angle, KNOB_NEEDLE_INNER_RADIUS);
  const needleEnd = pointOnKnob(angle, KNOB_NEEDLE_OUTER_RADIUS);

  const precision = normalizedStep >= 1 ? 0 : Math.min(4, Math.max(0, `${normalizedStep}`.split('.')[1]?.length ?? 0));
  const commitValue = (raw: number) => {
    const steppedValue = min + Math.round((raw - min) / normalizedStep) * normalizedStep;
    onChange(Number(Math.max(min, Math.min(max, steppedValue)).toFixed(precision)));
  };

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
    commitValue(min + (max - min) * pointerRatio);
  };

  return (
    <div
      className={`relative flex flex-col items-center gap-2 ${disabled ? 'opacity-45' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
      }}
    >
      <div
        aria-describedby={helpOpen ? helpId : undefined}
        aria-disabled={disabled || undefined}
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={formattedValue}
        className={`relative flex h-14 w-14 items-center justify-center border border-[var(--border-soft)] bg-[var(--bg-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${disabled ? 'cursor-not-allowed' : 'cursor-ns-resize'}`}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          let next: number | null = null;
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = value + normalizedStep;
          else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = value - normalizedStep;
          else if (event.key === 'Home') next = min;
          else if (event.key === 'End') next = max;
          if (next === null) {
            return;
          }

          event.preventDefault();
          commitValue(next);
        }}
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
        role="slider"
        style={{ borderRadius: '2px', touchAction: 'none' }}
        tabIndex={disabled ? -1 : 0}
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
        <span className="flex items-center gap-1">
          <span className="section-label">{label}</span>
          <button
            aria-expanded={helpOpen}
            aria-label={`About ${label}`}
            className="control-chip flex h-5 w-5 items-center justify-center p-0 text-[var(--text-tertiary)] hover:text-[var(--accent-strong)]"
            onClick={() => setHelpOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setHelpOpen(false);
              }
            }}
            title={`About ${label}`}
            type="button"
          >
            <Info className="h-3 w-3" />
          </button>
        </span>
        <span className="font-mono text-[11px] text-[var(--text-primary)]">{formattedValue}</span>
      </div>
      {helpOpen && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-panel-strong)] px-2.5 py-2 text-left text-[11px] leading-4 text-[var(--text-secondary)] shadow-[0_10px_28px_rgba(0,0,0,0.42)]"
          id={helpId}
          role="tooltip"
        >
          {helpText}
        </span>
      )}
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
