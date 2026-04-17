import React from 'react';
import { Gauge, Layers3 } from 'lucide-react';

import { MetricCell, SegmentButton, ShortcutRow } from './SettingsPrimitives';

const PATTERN_OPTIONS = [2, 4, 6, 8];
const STEP_OPTIONS = [8, 16, 32, 64];

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
          <div className="mt-2 flex items-center gap-2">
            <input
              className="control-field h-11 w-24 px-3 text-center font-mono text-sm"
              max="240"
              min="40"
              onChange={(event) => onBpmChange(Number(event.target.value))}
              type="number"
              value={bpm}
            />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">BPM</span>
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
          <div className="mt-2 flex flex-wrap gap-2">
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
        <ShortcutRow command="Cmd/Ctrl+S" description="Save session" />
        <ShortcutRow command="Cmd/Ctrl+Z" description="Undo" />
        <ShortcutRow command="Shift+Cmd/Ctrl+Z" description="Redo" />
        <ShortcutRow command="1-8" description="Switch pattern bank" />
      </div>
    </section>
  </>
);
