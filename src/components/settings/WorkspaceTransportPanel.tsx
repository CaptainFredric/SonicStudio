import React from 'react';
import { Gauge, Layers3 } from 'lucide-react';

import { MetricCell, SegmentButton, ShortcutRow } from './SettingsPrimitives';
import { TapTempoButton } from './TapTempoButton';

const PATTERN_OPTIONS = [2, 4, 6, 8, 12, 16];
const STEP_OPTIONS = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];

interface WorkspaceTransportPanelProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  onPatternCountChange: (count: number) => void;
  onStepsPerPatternChange: (steps: number) => void;
  onTransportModeChange: (mode: 'PATTERN' | 'SONG') => void;
  patternCount: number;
  songLengthInBeats: number;
  stepsPerPattern: number;
  transportMode: 'PATTERN' | 'SONG';
}

export const WorkspaceTransportPanel = ({
  bpm,
  onBpmChange,
  onPatternCountChange,
  onStepsPerPatternChange,
  onTransportModeChange,
  patternCount,
  songLengthInBeats,
  stepsPerPattern,
  transportMode,
}: WorkspaceTransportPanelProps) => (
  <>
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Layers3 className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Transport</span>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <div className="section-label">Playback mode</div>
          <div className="mt-2 flex gap-2">
            <SegmentButton active={transportMode === 'PATTERN'} label="Pattern" onClick={() => onTransportModeChange('PATTERN')} />
            <SegmentButton active={transportMode === 'SONG'} label="Song" onClick={() => onTransportModeChange('SONG')} />
          </div>
        </div>

        <div>
          <div className="section-label">Tempo</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="control-field h-11 w-24 px-3 text-center font-mono text-sm"
              max="240"
              min="40"
              onChange={(event) => onBpmChange(Number(event.target.value))}
              type="number"
              value={bpm}
            />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">BPM</span>
            <TapTempoButton onBpmChange={onBpmChange} />
            <button
              aria-label="Halve the tempo"
              className="control-chip h-11 min-h-[2.75rem] px-3 font-mono text-[11px] font-semibold tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={Math.round(bpm / 2) < 40}
              onClick={() => onBpmChange(Math.max(40, Math.round(bpm / 2)))}
              title="Half-time. Drops the tempo to half its current value."
              type="button"
            >
              ÷2
            </button>
            <button
              aria-label="Double the tempo"
              className="control-chip h-11 min-h-[2.75rem] px-3 font-mono text-[11px] font-semibold tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={Math.round(bpm * 2) > 240}
              onClick={() => onBpmChange(Math.min(240, Math.round(bpm * 2)))}
              title="Double-time. Raises the tempo to twice its current value."
              type="button"
            >
              ×2
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCell label="Song span" value={`${songLengthInBeats} steps`} />
          <MetricCell label="Pattern size" value={`${stepsPerPattern} steps`} />
        </div>

        <div>
          <div className="section-label">Pattern banks</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PATTERN_OPTIONS.map((option) => (
              <React.Fragment key={option}>
                <SegmentButton
                  active={patternCount === option}
                  label={String(option)}
                  onClick={() => onPatternCountChange(option)}
                />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label">Steps per pattern</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              className="control-field h-11 w-28 px-3 text-center font-mono text-sm"
              max="4096"
              min="8"
              onChange={(event) => onStepsPerPatternChange(Number(event.target.value))}
              step="8"
              type="number"
              value={stepsPerPattern}
            />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">steps</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEP_OPTIONS.map((option) => (
              <React.Fragment key={option}>
                <SegmentButton
                  active={stepsPerPattern === option}
                  label={String(option)}
                  onClick={() => onStepsPerPatternChange(option)}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Gauge className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Shortcuts</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
        <ShortcutRow command="Space" description="Play or pause" />
        <ShortcutRow command="M" description="Toggle metronome" />
        <ShortcutRow command="Alt+R" description="Arm or stop recording" />
        <ShortcutRow command="Alt+S" description="Toggle SuperSonic" />
        <ShortcutRow command="Alt+C" description="Quick capture a note string" />
        <ShortcutRow command="Alt+1 … 5" description="Sequencer, Notes, Mix, Song, Compose" />
        <ShortcutRow command="1 … 8" description="Switch pattern bank" />
        <ShortcutRow command="Cmd/Ctrl+S" description="Save session" />
        <ShortcutRow command="Cmd/Ctrl+Z" description="Undo" />
        <ShortcutRow command="Shift+Cmd/Ctrl+Z" description="Redo" />
        <ShortcutRow command="Esc" description="Close Studio settings" />
      </div>
    </section>
  </>
);
