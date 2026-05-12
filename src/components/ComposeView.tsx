import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, GripVertical, PanelLeft, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save } from 'lucide-react';

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
  sidePlacement: 'sonicstudio:compose:sidePlacement:v1',
  presets: 'sonicstudio:compose:presets:v1',
};

type SidePlacement = 'right' | 'left';
const isSidePlacement = (value: unknown): value is SidePlacement => value === 'left' || value === 'right';

interface LayoutPreset {
  name: string;
  topView: PaneTarget;
  bottomView: PaneTarget;
  sideOpen: boolean;
  sideView: PaneTarget;
  sidePlacement: SidePlacement;
  topRatio: number;
  sideWidth: number;
}

const DEFAULT_PRESETS: LayoutPreset[] = [
  { name: 'Writing', topView: 'ARRANGER', bottomView: 'PIANO_ROLL', sideOpen: false, sideView: 'MIXER', sidePlacement: 'right', topRatio: 0.5, sideWidth: 380 },
  { name: 'Mixing', topView: 'MIXER', bottomView: 'PIANO_ROLL', sideOpen: true, sideView: 'ARRANGER', sidePlacement: 'right', topRatio: 0.55, sideWidth: 420 },
  { name: 'Beat-making', topView: 'SEQUENCER', bottomView: 'PIANO_ROLL', sideOpen: false, sideView: 'MIXER', sidePlacement: 'right', topRatio: 0.45, sideWidth: 380 },
];

const readPresets = (): LayoutPreset[] => {
  if (typeof window === 'undefined') return DEFAULT_PRESETS;
  try {
    const raw = window.localStorage.getItem(STORAGE.presets);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PRESETS;
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const e = entry as Record<string, unknown>;
        if (!isPaneTarget(e.topView) || !isPaneTarget(e.bottomView) || !isPaneTarget(e.sideView)) return null;
        if (!isSidePlacement(e.sidePlacement)) return null;
        const name = typeof e.name === 'string' && e.name.trim() ? e.name.trim().slice(0, 24) : 'Preset';
        const sideOpen = e.sideOpen === true;
        const topRatio = typeof e.topRatio === 'number' ? Math.min(MAX_TOP_RATIO, Math.max(MIN_TOP_RATIO, e.topRatio)) : DEFAULT_TOP_RATIO;
        const sideWidth = typeof e.sideWidth === 'number' ? Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, e.sideWidth)) : DEFAULT_SIDE_WIDTH;
        return { name, topView: e.topView, bottomView: e.bottomView, sideOpen, sideView: e.sideView, sidePlacement: e.sidePlacement, topRatio, sideWidth };
      })
      .filter((entry): entry is LayoutPreset => entry !== null)
      .slice(0, 6);
  } catch {
    return DEFAULT_PRESETS;
  }
};

const writePresets = (presets: LayoutPreset[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE.presets, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
};

const MIN_TOP_RATIO = 0.12;
const MAX_TOP_RATIO = 0.88;
const DEFAULT_TOP_RATIO = 0.5;

const MIN_SIDE_WIDTH = 220;
const MAX_SIDE_WIDTH = 880;
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
  const [sidePlacement, setSidePlacement] = useState<SidePlacement>(() => {
    if (typeof window === 'undefined') return 'right';
    try {
      const raw = window.localStorage.getItem(STORAGE.sidePlacement);
      return isSidePlacement(raw) ? raw : 'right';
    } catch {
      return 'right';
    }
  });
  const [presets, setPresets] = useState<LayoutPreset[]>(readPresets);
  const [recentlyApplied, setRecentlyApplied] = useState<string | null>(null);
  const splitDragRef = useRef<{ startY: number; startRatio: number; containerHeight: number } | null>(null);
  const sideDragRef = useRef<{ startX: number; startWidth: number; placement: SidePlacement } | null>(null);

  useEffect(() => { writeString(STORAGE.topRatio, String(topRatio)); }, [topRatio]);
  useEffect(() => { writeString(STORAGE.topView, topView); }, [topView]);
  useEffect(() => { writeString(STORAGE.bottomView, bottomView); }, [bottomView]);
  useEffect(() => { writeString(STORAGE.sideOpen, sideOpen ? '1' : '0'); }, [sideOpen]);
  useEffect(() => { writeString(STORAGE.sideView, sideView); }, [sideView]);
  useEffect(() => { writeString(STORAGE.sideWidth, String(sideWidth)); }, [sideWidth]);
  useEffect(() => { writeString(STORAGE.sidePlacement, sidePlacement); }, [sidePlacement]);
  useEffect(() => { writePresets(presets); }, [presets]);
  useEffect(() => {
    if (!recentlyApplied) return undefined;
    const id = window.setTimeout(() => setRecentlyApplied(null), 1400);
    return () => window.clearTimeout(id);
  }, [recentlyApplied]);

  const applyPreset = useCallback((preset: LayoutPreset) => {
    setTopView(preset.topView);
    setBottomView(preset.bottomView);
    setSideOpen(preset.sideOpen);
    setSideView(preset.sideView);
    setSidePlacement(preset.sidePlacement);
    setTopRatio(preset.topRatio);
    setSideWidth(preset.sideWidth);
    setRecentlyApplied(preset.name);
  }, []);

  const overwritePreset = useCallback((index: number) => {
    setPresets((current) => current.map((preset, i) => (
      i === index
        ? { ...preset, topView, bottomView, sideOpen, sideView, sidePlacement, topRatio, sideWidth }
        : preset
    )));
    setRecentlyApplied(`Saved to ${presets[index]?.name ?? 'preset'}`);
  }, [topView, bottomView, sideOpen, sideView, sidePlacement, topRatio, sideWidth, presets]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const match = event.key.match(/^[1-3]$/);
      if (!match) return;
      const index = Number(event.key) - 1;
      if (event.shiftKey) {
        event.preventDefault();
        overwritePreset(index);
      } else if (presets[index]) {
        event.preventDefault();
        applyPreset(presets[index]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyPreset, overwritePreset, presets]);

  // Keep top and bottom panes distinct. If a duplicate is picked, swap the old view into the other pane.
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
    sideDragRef.current = { startX: event.clientX, startWidth: sideWidth, placement: sidePlacement };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [sideWidth, sidePlacement]);

  const handleSideMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = sideDragRef.current;
    if (!state) return;
    // For right placement, dragging left grows. For left placement, dragging right grows.
    const rawDelta = event.clientX - state.startX;
    const delta = state.placement === 'right' ? -rawDelta : rawDelta;
    setSideWidth(Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, state.startWidth + delta)));
  }, []);

  const handleSideEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    sideDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const sideSeparator = sideOpen && (
    <div
      aria-label="Resize side rack"
      aria-orientation="vertical"
      className="hidden md:flex w-2 cursor-ew-resize items-center justify-center"
      onPointerCancel={handleSideEnd}
      onPointerDown={handleSideStart}
      onPointerMove={handleSideMove}
      onPointerUp={handleSideEnd}
      role="separator"
      tabIndex={0}
      title="Resize the side rack"
    >
      <GripVertical className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 hover:opacity-100" />
    </div>
  );

  const sidePane = sideOpen && (
    <section
      className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
      style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${sideWidth}px` : undefined, flexShrink: 0 }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.014)] px-3 py-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          <span>Side rack</span>
          <button
            aria-label={sidePlacement === 'right' ? 'Move side rack to left' : 'Move side rack to right'}
            className="ghost-icon-button flex h-6 w-6 items-center justify-center"
            onClick={() => setSidePlacement(sidePlacement === 'right' ? 'left' : 'right')}
            title={sidePlacement === 'right' ? 'Move to left' : 'Move to right'}
            type="button"
          >
            <PanelLeft className="h-3.5 w-3.5" style={{ transform: sidePlacement === 'left' ? 'scaleX(-1)' : undefined }} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Side rack content"
            className="control-field h-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onChange={(event) => setSideView(event.target.value as PaneTarget)}
            value={sideView}
          >
            {(Object.keys(TARGET_LABELS) as PaneTarget[]).map((target) => (
              <option key={target} value={target}>{TARGET_LABELS[target]}</option>
            ))}
          </select>
          <button
            aria-label="Close side rack"
            className="ghost-icon-button flex h-7 w-7 items-center justify-center"
            onClick={() => setSideOpen(false)}
            title="Close side rack"
            type="button"
          >
            {sidePlacement === 'right' ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderTarget(sideView)}
      </div>
    </section>
  );

  return (
    <main
      ref={containerRef}
      className="relative flex min-h-[60vh] flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden"
    >
      {sidePlacement === 'left' && sidePane}
      {sidePlacement === 'left' && sideSeparator}
      <div
        ref={mainColumnRef}
        className="flex flex-1 min-w-0 flex-col gap-3 md:min-h-0 md:overflow-hidden"
      >
        <PresetBar
          presets={presets}
          recentlyApplied={recentlyApplied}
          onApply={applyPreset}
          onOverwrite={overwritePreset}
          onRename={(index, name) => {
            setPresets((current) => current.map((preset, i) => (i === index ? { ...preset, name: name.trim().slice(0, 24) || preset.name } : preset)));
          }}
        />
        <section
          className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
          style={{ flexBasis: `${topRatio * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <PaneHeader label="Song desk" value={topView} onChange={handleTopChange} exclude={bottomView} />
          <div className="compose-pane-body flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
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
          title="Resize the main split"
        >
          <GripHorizontal className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />
        </div>
        <section
          className="surface-panel flex min-h-[420px] flex-col overflow-hidden md:min-h-0"
          style={{ flexBasis: `${(1 - topRatio) * 100}%`, flexShrink: 0, flexGrow: 0 }}
        >
          <PaneHeader label="Note desk" value={bottomView} onChange={handleBottomChange} exclude={topView} />
          <div className="compose-pane-body flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
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
            {sideOpen ? 'Close side rack' : 'Open side rack'}
          </button>
        </div>
      </div>

      {sidePlacement === 'right' && sideSeparator}
      {sidePlacement === 'right' && sidePane}

      {!sideOpen && (
        <button
          aria-label="Open side rack"
          className={`ghost-icon-button absolute top-2 z-20 hidden md:flex h-8 w-8 items-center justify-center ${sidePlacement === 'right' ? 'right-2' : 'left-2'}`}
          onClick={() => setSideOpen(true)}
          title="Open side rack"
          type="button"
        >
          {sidePlacement === 'right' ? <PanelRightOpen className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      )}
    </main>
  );
};

const PresetBar = ({
  presets,
  recentlyApplied,
  onApply,
  onOverwrite,
  onRename,
}: {
  presets: LayoutPreset[];
  recentlyApplied: string | null;
  onApply: (preset: LayoutPreset) => void;
  onOverwrite: (index: number) => void;
  onRename: (index: number, name: string) => void;
}) => {
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="surface-panel-muted flex items-center justify-between gap-2 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Layouts
        </span>
        {presets.slice(0, 3).map((preset, index) => (
          <div key={index} className="flex items-center">
            {renamingIndex === index ? (
              <input
                autoFocus
                className="control-field h-7 w-28 px-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
                onBlur={() => { onRename(index, draft); setRenamingIndex(null); }}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { onRename(index, draft); setRenamingIndex(null); }
                  if (event.key === 'Escape') { setRenamingIndex(null); }
                }}
                value={draft}
              />
            ) : (
              <button
                className="control-chip flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => onApply(preset)}
                onDoubleClick={() => { setDraft(preset.name); setRenamingIndex(index); }}
                title={`Apply "${preset.name}". Key ${index + 1}. Shift plus ${index + 1} saves the current layout here. Double click to rename.`}
                type="button"
              >
                <span className="font-mono text-[9px] opacity-60">{index + 1}</span>
                {preset.name}
              </button>
            )}
            <button
              aria-label={`Save current layout to ${preset.name}`}
              className="ghost-icon-button -ml-px flex h-7 w-7 items-center justify-center"
              onClick={() => onOverwrite(index)}
              title={`Save current layout to "${preset.name}" (Shift+${index + 1})`}
              type="button"
            >
              <Save className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {recentlyApplied && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
          {recentlyApplied}
        </span>
      )}
    </div>
  );
};
