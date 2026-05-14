import { Mic, Settings2, Volume2, Waves, Zap } from 'lucide-react';

import type { MotionMode } from '../../project/preferences';
import { SegmentButton, StateButton } from './SettingsPrimitives';

interface WorkspaceOptionsPanelProps {
  motionMode: MotionMode;
  onMotionModeChange: (mode: MotionMode) => void;
  onSuperSonicModeChange: (enabled: boolean) => void;
  onUiSoundsEnabledChange: (enabled: boolean) => void;
  superSonicMode: boolean;
  uiSoundsEnabled: boolean;
}

export const WorkspaceOptionsPanel = ({
  motionMode,
  onMotionModeChange,
  onSuperSonicModeChange,
  onUiSoundsEnabledChange,
  superSonicMode,
  uiSoundsEnabled,
}: WorkspaceOptionsPanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Settings2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Studio options</span>
    </div>

    <div className="mt-4 space-y-4">
      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--danger)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">SuperSonic tools</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Precision ladders, stronger track-map guidance, brighter desk contrast, and the faster alternate studio skin.
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <StateButton active={superSonicMode} label="On" onClick={() => onSuperSonicModeChange(true)} />
          <StateButton active={!superSonicMode} label="Off" onClick={() => onSuperSonicModeChange(false)} />
        </div>
        <div className="mt-3 rounded-[4px] border border-[rgba(176,31,55,0.2)] bg-[rgba(176,31,55,0.05)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          Use the SuperSonic button in the top bar when you want the precision layout quickly. The mode also renames the desk header and shifts the wave mark to red.
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--danger)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Capture sound</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Record a short phrase, get nearby note guesses, and drop the result into a matching lane without leaving the session.
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Open it from the red Capture button in the rail or the top bar.</div>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Pitch matching, note suggestions, and source shaping stay local in the browser.</div>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Use it when you want custom notes, fast sample starts, or a new lane idea from live input.</div>
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
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

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Motion</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Choose the movement pace for panels, controls, and studio feedback.
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
