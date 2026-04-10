import React, { useEffect, useRef, useState } from 'react';

import { engine } from '../audio/ToneEngine';

export const Visualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<'fft' | 'waveform'>('fft');

  useEffect(() => {
    let animationId = 0;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      if (!canvas || !engine.analyzer) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const values = engine.analyzer.getValue();

      ctx.fillStyle = '#0c1116';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(151, 163, 180, 0.12)';
      ctx.lineWidth = 1;

      for (let gridIndex = 1; gridIndex < 4; gridIndex += 1) {
        const y = (height / 4) * gridIndex;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      for (let gridIndex = 1; gridIndex < 8; gridIndex += 1) {
        const x = (width / 8) * gridIndex;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.strokeStyle = '#82c9bb';
      ctx.lineWidth = 2;

      if (viewMode === 'fft') {
        const barWidth = width / values.length;

        for (let index = 0; index < values.length; index += 1) {
          const value = values[index] as number;
          const normalized = Math.max(0, Math.min(1, (value + 100) / 100));
          const y = height - (normalized * height);
          const x = index * barWidth;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      } else {
        for (let index = 0; index < values.length; index += 1) {
          const x = (index / values.length) * width;
          const y = ((values[index] as number) * 0.5 + 0.5) * height;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [viewMode]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden border border-[var(--border-soft)] bg-[#0c1116]">
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <ModeButton
          active={viewMode === 'fft'}
          label="Spectrum"
          onClick={() => {
            setViewMode('fft');
            if (engine.analyzer) {
              engine.analyzer.type = 'fft';
            }
          }}
        />
        <ModeButton
          active={viewMode === 'waveform'}
          label="Wave"
          onClick={() => {
            setViewMode('waveform');
            if (engine.analyzer) {
              engine.analyzer.type = 'waveform';
            }
          }}
        />
      </div>
      <canvas className="h-full w-full" height={190} ref={canvasRef} width={520} />
    </div>
  );
};

const ModeButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);