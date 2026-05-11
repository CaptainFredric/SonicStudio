import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';

import { Arranger } from './Arranger';
import { PianoRoll } from './PianoRoll';

const STORAGE_KEY = 'sonicstudio:compose:topRatio:v1';
const MIN_RATIO = 0.22;
const MAX_RATIO = 0.78;
const DEFAULT_RATIO = 0.5;

const readRatio = (): number => {
  if (typeof window === 'undefined') return DEFAULT_RATIO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATIO;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_RATIO;
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, parsed));
  } catch {
    return DEFAULT_RATIO;
  }
};

export const ComposeView = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [topRatio, setTopRatio] = useState<number>(readRatio);
  const dragStateRef = useRef<{ startY: number; startRatio: number; containerHeight: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(topRatio));
    } catch {
      /* ignore */
    }
  }, [topRatio]);

  const handleSplitStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStateRef.current = { startY: event.clientY, startRatio: topRatio, containerHeight: rect.height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [topRatio]);

  const handleSplitMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.containerHeight <= 0) return;
    const delta = (event.clientY - state.startY) / state.containerHeight;
    setTopRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, state.startRatio + delta)));
  }, []);

  const handleSplitEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    dragStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleSplitKey = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setTopRatio((current) => Math.max(MIN_RATIO, current - 0.04));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setTopRatio((current) => Math.min(MAX_RATIO, current + 0.04));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setTopRatio(DEFAULT_RATIO);
    }
  }, []);

  return (
    <main className="relative flex flex-col min-h-[60vh] md:min-h-0 md:flex-1 md:overflow-hidden">
      <div
        ref={containerRef}
        className="flex flex-1 flex-col gap-3 md:min-h-0 md:overflow-hidden"
      >
        <section
          className="flex min-h-[420px] flex-col md:min-h-0 md:overflow-hidden"
          style={{ flexBasis: `${topRatio * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <Arranger />
        </section>
        <div
          aria-label="Resize compose split"
          aria-orientation="horizontal"
          aria-valuemax={Math.round(MAX_RATIO * 100)}
          aria-valuemin={Math.round(MIN_RATIO * 100)}
          aria-valuenow={Math.round(topRatio * 100)}
          className="group hidden md:flex h-3 cursor-ns-resize items-center justify-center"
          onKeyDown={handleSplitKey}
          onPointerCancel={handleSplitEnd}
          onPointerDown={handleSplitStart}
          onPointerMove={handleSplitMove}
          onPointerUp={handleSplitEnd}
          role="separator"
          tabIndex={0}
          title="Drag to resize. Up and down arrow keys for fine adjustments."
        >
          <GripHorizontal className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />
        </div>
        <section
          className="flex min-h-[420px] flex-col md:min-h-0 md:overflow-hidden"
          style={{ flexBasis: `${(1 - topRatio) * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <PianoRoll />
        </section>
      </div>
    </main>
  );
};
