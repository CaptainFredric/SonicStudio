import type { ReactNode } from 'react';
import { HardDrive, Keyboard, Palette, Rows2, Trash2, Type, Volume2, Waves, Zap } from 'lucide-react';

import { ACCENT_PRESETS, type AccentColor, type DefaultWorkspace, type Density, type MotionMode } from '../../project/preferences';
import { getSupersonicTransitionOrigin, runSupersonicTransition } from '../../utils/supersonicTransition';
import { SegmentButton, StateButton } from './SettingsPrimitives';

interface PreferencesPanelProps {
  accentColor: AccentColor;
  density: Density;
  motionMode: MotionMode;
  superSonicMode: boolean;
  uiSoundsEnabled: boolean;
  defaultWorkspace: DefaultWorkspace;
  onAccentChange: (color: AccentColor) => void;
  onDensityChange: (density: Density) => void;
  onMotionModeChange: (mode: MotionMode) => void;
  onSuperSonicModeChange: (enabled: boolean) => void;
  onUiSoundsEnabledChange: (enabled: boolean) => void;
  onDefaultWorkspaceChange: (workspace: DefaultWorkspace) => void;
}

const SHORTCUTS: Array<{ keys: string; label: string; group: 'Transport' | 'Edit' | 'Tap to play' }> = [
  { keys: 'Space', label: 'Play or pause', group: 'Transport' },
  { keys: '⌘ S', label: 'Save', group: 'Edit' },
  { keys: '⌘ Z', label: 'Undo', group: 'Edit' },
  { keys: '⇧ ⌘ Z', label: 'Redo', group: 'Edit' },
  { keys: '[ ]', label: 'Shorten or lengthen the selected note', group: 'Edit' },
  { keys: 'A to L', label: 'White keys for melodic tracks', group: 'Tap to play' },
  { keys: 'W E T Y U O P', label: 'Black keys', group: 'Tap to play' },
  { keys: 'A S D F', label: 'Drum pads (when a drum track is selected)', group: 'Tap to play' },
];

export const PreferencesPanel = ({
  accentColor,
  density,
  motionMode,
  superSonicMode,
  uiSoundsEnabled,
  defaultWorkspace,
  onAccentChange,
  onDensityChange,
  onMotionModeChange,
  onSuperSonicModeChange,
  onUiSoundsEnabledChange,
  onDefaultWorkspaceChange,
}: PreferencesPanelProps) => (
  <div className="space-y-4">
    <PanelCard icon={<Rows2 className="h-4 w-4 text-[var(--accent)]" />} title="Default workspace">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Which view opens when you start a new session. Compose shows the arranger and piano roll together.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SegmentButton active={defaultWorkspace === 'compose'} label="Compose" onClick={() => onDefaultWorkspaceChange('compose')} />
        <SegmentButton active={defaultWorkspace === 'arranger'} label="Arranger" onClick={() => onDefaultWorkspaceChange('arranger')} />
        <SegmentButton active={defaultWorkspace === 'piano-roll'} label="Piano roll" onClick={() => onDefaultWorkspaceChange('piano-roll')} />
        <SegmentButton active={defaultWorkspace === 'mixer'} label="Mixer" onClick={() => onDefaultWorkspaceChange('mixer')} />
        <SegmentButton active={defaultWorkspace === 'sequencer'} label="Sequencer" onClick={() => onDefaultWorkspaceChange('sequencer')} />
      </div>
    </PanelCard>

    <PanelCard icon={<Palette className="h-4 w-4 text-[var(--accent)]" />} title="Accent color">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Used for active tabs, focus rings, and highlights.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((id) => {
          const preset = ACCENT_PRESETS[id];
          const isActive = accentColor === id;
          return (
            <button
              key={id}
              aria-label={`Accent color ${preset.label}`}
              aria-pressed={isActive}
              className="group flex flex-col items-center gap-1.5 px-2 py-1.5 transition-colors"
              onClick={() => onAccentChange(id)}
              type="button"
              title={preset.description}
            >
              <span
                aria-hidden
                className="h-7 w-7 rounded-full border-2 transition-transform group-hover:scale-105"
                style={{
                  background: preset.accent,
                  borderColor: isActive ? preset.accentStrong : 'rgba(255,255,255,0.08)',
                  boxShadow: isActive ? `0 0 0 2px ${preset.accent}55` : 'none',
                }}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-[0.16em]"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </PanelCard>

    <PanelCard icon={<Type className="h-4 w-4 text-[var(--accent)]" />} title="Density">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Compact reduces padding around panels and controls.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SegmentButton active={density === 'comfortable'} label="Comfortable" onClick={() => onDensityChange('comfortable')} />
        <SegmentButton active={density === 'compact'} label="Compact" onClick={() => onDensityChange('compact')} />
      </div>
    </PanelCard>

    <PanelCard icon={<Waves className="h-4 w-4 text-[var(--accent)]" />} title="Motion">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        How fast UI elements animate.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SegmentButton active={motionMode === 'fluid'} label="Fluid" onClick={() => onMotionModeChange('fluid')} />
        <SegmentButton active={motionMode === 'focus'} label="Focus" onClick={() => onMotionModeChange('focus')} />
        <SegmentButton active={motionMode === 'still'} label="Still" onClick={() => onMotionModeChange('still')} />
      </div>
    </PanelCard>

    <PanelCard icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="SuperSonic mode">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Turns on the brighter advanced workspace: macro zoom, precision hover ladders in Sequencer and Roll, and stitch-ready track map tools.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
          data-active={superSonicMode}
          data-ui-sound="action"
          onClick={(event) => {
            runSupersonicTransition(true, getSupersonicTransitionOrigin(event.currentTarget));
            onSuperSonicModeChange(true);
          }}
          type="button"
        >
          On
        </button>
        <button
          className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
          data-active={!superSonicMode}
          data-ui-sound="action"
          onClick={(event) => {
            runSupersonicTransition(false, getSupersonicTransitionOrigin(event.currentTarget));
            onSuperSonicModeChange(false);
          }}
          type="button"
        >
          Off
        </button>
      </div>
    </PanelCard>

    <PanelCard icon={<Volume2 className="h-4 w-4 text-[var(--accent)]" />} title="UI sounds">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Subtle clicks when you interact with controls.
      </p>
      <div className="mt-3 flex gap-2">
        <StateButton active={uiSoundsEnabled} label="On" onClick={() => onUiSoundsEnabledChange(true)} />
        <StateButton active={!uiSoundsEnabled} label="Off" onClick={() => onUiSoundsEnabledChange(false)} />
      </div>
    </PanelCard>

    <PanelCard icon={<Keyboard className="h-4 w-4 text-[var(--accent)]" />} title="Keyboard shortcuts">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Reference for transport, editing, and playable keys.
      </p>
      <ShortcutGroup title="Transport" shortcuts={SHORTCUTS.filter((s) => s.group === 'Transport')} />
      <ShortcutGroup title="Edit" shortcuts={SHORTCUTS.filter((s) => s.group === 'Edit')} />
      <ShortcutGroup title="Tap to play" shortcuts={SHORTCUTS.filter((s) => s.group === 'Tap to play')} />
    </PanelCard>

    <PanelCard icon={<HardDrive className="h-4 w-4 text-[var(--accent)]" />} title="Where saves live">
      <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
        SonicStudio saves to <span className="font-mono text-[11px] text-[var(--text-primary)]">localStorage</span> in your browser — not to a server. That means:
      </p>
      <ul className="mt-2 grid gap-1 text-[12px] leading-5 text-[var(--text-secondary)]">
        <li>· Sessions stay on this browser profile on this device. Not your IP.</li>
        <li>· Different browser or device → different saves. Use Share to move work across.</li>
        <li>· Clearing browser data deletes saved sessions, scoresheets, and preferences.</li>
      </ul>
      <button
        className="control-chip mt-4 flex w-full items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
        onClick={() => {
          if (typeof window === 'undefined') return;
          const ok = window.confirm('Clear all SonicStudio local data?\n\nThis deletes the current session, every saved scoresheet, all checkpoints, layouts, and preferences. The page will reload afterward. There is no undo.');
          if (!ok) return;
          try {
            const removable: string[] = [];
            for (let i = 0; i < window.localStorage.length; i += 1) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith('sonicstudio:')) removable.push(key);
            }
            removable.forEach((key) => window.localStorage.removeItem(key));
            window.location.reload();
          } catch (error) {
            console.error('SonicStudio: failed to clear local data', error);
          }
        }}
        title="Wipe every sonicstudio:* key in localStorage and reload"
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear all local data
      </button>
    </PanelCard>
  </div>
);

const PanelCard = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      {icon}
      <span className="section-label">{title}</span>
    </div>
    {children}
  </section>
);

const ShortcutGroup = ({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: Array<{ keys: string; label: string }>;
}) => (
  <div className="mt-4">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{title}</div>
    <div className="mt-2 grid gap-1.5">
      {shortcuts.map((s) => (
        <div
          key={s.label}
          className="flex items-center justify-between gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
        >
          <span className="text-xs text-[var(--text-secondary)]">{s.label}</span>
          <kbd className="font-mono text-[11px] text-[var(--accent-strong)] tracking-wider">{s.keys}</kbd>
        </div>
      ))}
    </div>
  </div>
);
