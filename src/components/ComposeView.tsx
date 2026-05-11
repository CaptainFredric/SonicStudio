import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, GripVertical, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Arranger } from './Arranger';
import { PianoRoll } from './PianoRoll';
import { Mixer } from './Mixer';
import { MainWorkspace as Sequencer } from './MainWorkspace';

type PaneTarget = 'ARRANGER' | 'PIANO_ROLL' | 'MIXER' | 'SEQUENCER';

const TARGET_LABELS: Record<PaneTarget, string> = {
  ARRANGER: 'Arranger',
  PIANO_ROLL: 'Piano roll',
  MIXER: 'Mixer',
  SEQUENCER: 'Sequencer',
};

const STORAGE = {
  topRatio: 'sonicstudio:compose:topRatio:v1',
  topView: 'sonicstudio:compose:topView:v1',
  bottomView: 'sonicstudio:compose:bottomView:v1',
  sideOpen: 'sonicstudio:compose:sideOpen:v1',
  sideView: 'sonicstudio:compose:sideView:v1',
  sideWidth: 'sonicstudio:compose:sideWidth:v1',
};

const MIN_TOP_RATIO = 0.22;
const MAX_TOP_RATIO = 0.78;
const DEFAULT_TOP_RATIO = 0.5;

const MIN_SIDE_WIDTH = 280;
const MAX_SIDE_WIDTH = 640;
const DEFAULT_SIDE_WIDTH = 380;

const readNumberSetting = (key: string, fallback: number, min: number, max: number) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  } catch {
    return fallback;
  }
};

const isPaneTarget = (value: unknown): value is PaneTarget => (
  value === 'ARRANGER' || value === 'PIANO_ROLL' || value === 'MIXER' || value === 'SEQUENCER'
);

const readPaneTarget = (key: string, fallback: PaneTarget): PaneTarget => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return isPaneTarget(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
};

const readBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
};

const writeString = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const renderTarget = (target: PaneTarget) => {
  switch (target) {
    case 'ARRANGER': return <Arranger />;
    case 'PIANO_ROLL': return <PianoRoll />;
    case 'MIXER': return <Mixer />;
    case 'SEQUENCER': return <Sequencer />;
  }
};

const PaneHeader = ({
  value,
  onChange,
  exclude,
  label,
}: {
  value: PaneTarget;
  onChange: (next: PaneTarget) => void;
  exclude?: PaneTarget;
  label: string;
}) => (
  <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.014)] px-3 py-1.5">
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
      <span>{label}</span>
    </div>
    <select
      aria-label={`${label} pane content`}
      className="control-field h-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
      onChange={(event) => onChange(event.target.value as PaneTarget)}
      value={value}
    >
      {(Object.keys(TARGET_LABELS) as PaneTarget[]).filter((t) => t !== exclude).map((target) => (
        <option key={target} value={target}>{TARGET_LABELS[target]}</option>
      ))}
    </select>
  </div>
);

export const ComposeView = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainColumnRef = useRef<HTMLDivElement | null>(null);
  const [topRatio, setTopRatio] = useState<number>(() => readNumberSetting(STORAGE.topRatio, DEFAULT_TOP_RATIO, MIN_TOP_RATIO, MAX_TOP_RATIO));
  const [topView, setTopView] = useState<PaneTarget>(() => readPaneTarget(STORAGE.topView, 'ARRANGER'));
  const [bottomView, setBottomView] = useState<PaneTarget>(() => readPaneTarget(STORAGE.bottomView, 'PIANO_ROLL'));
  const [sideOpen, setSideOpen] = useState<boolean>(() => readBoolean(STORAGE.sideOpen, false));
  const [sideView, setSideView] = useState<PaneTarget>(() => readPaneTarget(STORAGE.sideView, 'MIXER'));
  const [sideWidth, setSideWidth] = useState<number>(() => readNumberSetting(STORAGE.sideWidth, DEFAULT_SIDE_WIDTH, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH));
  const splitDragRef = useRef<{ startY: number; startRatio: number; containerHeight: number } | null>(null);
  const sideDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => { writeString(STORAGE.topRatio, String(topRatio)); }, [topRatio]);
  useEffect(() => { writeString(STORAGE.topView, topView); }, [topView]);
  useEffect(() => { writeString(STORAGE.bottomView, bottomView); }, [bottomView]);
  useEffect(() => { writeString(STORAGE.sideOpen, sideOpen ? '1' : '0'); }, [sideOpen]);
  useEffect(() => { writeString(STORAGE.sideView, sideView); }, [sideView]);
  useEffect(() => { writeString(STORAGE.sideWidth, String(sideWidth)); }, [sideWidth]);

  // Prevent picking the same target in both top and bottom — if the user picks a duplicate, swap them
  const handleTopChange = (next: PaneTarget) => {
    if (next === bottomView) setBottomView(topView);
    setTopView(next);
  };
  const handleBottomChange = (next: PaneTarget) => {
    if (next === topView) setTopView(bottomView);
    setBottomView(next);
  };

  const handleSplitStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!mainColumnRef.current) return;
    const rect = mainColumnRef.current.getBoundingClientRect();
    splitDragRef.current = { startY: event.clientY, startRatio: topRatio, containerHeight: rect.height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [topRatio]);

  const handleSplitMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = splitDragRef.current;
    if (!state || state.containerHeight <= 0) return;
    const delta = (event.clientY - state.startY) / state.containerHeight;
    setTopRatio(Math.min(MAX_TOP_RATIO, Math.max(MIN_TOP_RATIO, state.startRatio + delta)));
  }, []);

  const handleSplitEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    splitDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleSplitKey = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setTopRatio((c) => Math.max(MIN_TOP_RATIO, c - 0.04));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setTopRatio((c) => Math.min(MAX_TOP_RATIO, c + 0.04));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setTopRatio(DEFAULT_TOP_RATIO);
    }
  }, []);

  const handleSideStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    sideDragRef.current = { startX: event.clientX, startWidth: sideWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [sideWidth]);

  const handleSideMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = sideDragRef.current;
    if (!state) return;
    const delta = state.startX - event.clientX;
    setSideWidth(Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, state.startWidth + delta)));
  }, []);

  const handleSideEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    sideDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return (
    <main
      ref={containerRef}
      className="relative flex min-h-[60vh] flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden"
    >
      <div
        ref={mainColumnRef}
        className="flex flex-1 min-w-0 flex-col gap-3 md:min-h-0 md:overflow-hidden"
      >
        <section
          className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
          style={{ flexBasis: `${topRatio * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <PaneHeader label="Top pane" value={topView} onChange={handleTopChange} exclude={bottomView} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {renderTarget(topView)}
          </div>
        </section>
        <div
          aria-label="Resize compose split"
          aria-orientation="horizontal"
          aria-valuemax={Math.round(MAX_TOP_RATIO * 100)}
          aria-valuemin={Math.round(MIN_TOP_RATIO * 100)}
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
          className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
          style={{ flexBasis: `${(1 - topRatio) * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <PaneHeader label="Bottom pane" value={bottomView} onChange={handleBottomChange} exclude={topView} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {renderTarget(bottomView)}
          </div>
        </section>
        <div className="md:hidden">
          <button
            className="control-chip flex w-full items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => setSideOpen((current) => !current)}
            type="button"
          >
            {sideOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            {sideOpen ? 'Hide side pane' : 'Show side pane'}
          </button>
        </div>
      </div>

      {sideOpen && (
        <div
          aria-label="Resize side pane"
          aria-orientation="vertical"
          className="hidden md:flex w-2 cursor-ew-resize items-center justify-center"
          onPointerCancel={handleSideEnd}
          onPointerDown={handleSideStart}
          onPointerMove={handleSideMove}
          onPointerUp={handleSideEnd}
          role="separator"
          tabIndex={0}
          title="Drag to resize the side pane"
        >
          <GripVertical className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 hover:opacity-100" />
        </div>
      )}

      {sideOpen && (
        <section
          className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${sideWidth}px` : undefined, flexShrink: 0 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.014)] px-3 py-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Side pane</div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Side pane content"
                className="control-field h-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                onChange={(event) => setSideView(event.target.value as PaneTarget)}
                value={sideView}
              >
                {(Object.keys(TARGET_LABELS) as PaneTarget[]).map((target) => (
                  <option key={target} value={target}>{TARGET_LABELS[target]}</option>
                ))}
              </select>
              <button
                aria-label="Close side pane"
                className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                onClick={() => setSideOpen(false)}
                title="Close side pane"
                type="button"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {renderTarget(sideView)}
          </div>
        </section>
      )}

      {!sideOpen && (
        <button
          aria-label="Open side pane"
          className="ghost-icon-button absolute right-2 top-2 z-20 hidden md:flex h-8 w-8 items-center justify-center"
          onClick={() => setSideOpen(true)}
          title="Open side pane"
          type="button"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}
    </main>
  );
};
