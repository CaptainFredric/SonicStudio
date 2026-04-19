import { Settings2, Volume2, Waves } from 'lucide-react';

import type { MotionMode } from '../../project/preferences';
import { SegmentButton, StateButton } from './SettingsPrimitives';

interface WorkspaceOptionsPanelProps {
  motionMode: MotionMode;
  onMotionModeChange: (mode: MotionMode) => void;
  onUiSoundsEnabledChange: (enabled: boolean) => void;
  uiSoundsEnabled: boolean;
}

export const WorkspaceOptionsPanel = ({
  motionMode,
  onMotionModeChange,
  onUiSoundsEnabledChange,
  uiSoundsEnabled,
}: WorkspaceOptionsPanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Settings2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Studio options</span>
    </div>

    <div className="mt-4 space-y-4">
      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">UI sounds</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Button presses use varied studio clicks for navigation, transport, and edit actions.
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <StateButton active={uiSoundsEnabled} label="On" onClick={() => onUiSoundsEnabledChange(true)} />
          <StateButton active={!uiSoundsEnabled} label="Off" onClick={() => onUiSoundsEnabledChange(false)} />
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Motion</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Fluid adds softer panel and button movement. Focus tightens the pace. Still removes most motion.
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SegmentButton active={motionMode === 'fluid'} label="Fluid" onClick={() => onMotionModeChange('fluid')} />
          <SegmentButton active={motionMode === 'focus'} label="Focus" onClick={() => onMotionModeChange('focus')} />
          <SegmentButton active={motionMode === 'still'} label="Still" onClick={() => onMotionModeChange('still')} />
        </div>
      </div>
    </div>
  </section>
);
