import { useEffect, useState, type ReactNode } from 'react';
import { Database, HardDrive, Keyboard, Palette, Trash2, Type, Volume2, Waves, Zap } from 'lucide-react';

import { ACCENT_PRESETS, type AccentColor, type DefaultWorkspace, type Density, type MotionMode } from '../../project/preferences';
import { getSupersonicTransitionOrigin, runSupersonicTransition } from '../../utils/supersonicTransition';
import { estimateOriginStorage, formatBytes, measureLocalStorageUsage, type StorageUsage } from '../../utils/storageUsage';
import { SegmentButton, StateButton } from './SettingsPrimitives';

interface PreferencesPanelProps {
  accentColor: AccentColor;
  density: Density;
  motionMode: MotionMode;
  superSonicMode: boolean;
  uiSoundsEnabled: boolean;
  midiInputEnabled: boolean;
  midiRecordEnabled: boolean;
  midiSupported: boolean;
  defaultWorkspace: DefaultWorkspace;
  onAccentChange: (color: AccentColor) => void;
  onDensityChange: (density: Density) => void;
  onMotionModeChange: (mode: MotionMode) => void;
  onSuperSonicModeChange: (enabled: boolean) => void;
  onUiSoundsEnabledChange: (enabled: boolean) => void;
  onMidiInputEnabledChange: (enabled: boolean) => void;
  onMidiRecordEnabledChange: (enabled: boolean) => void;
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
  midiInputEnabled,
  midiRecordEnabled,
  midiSupported,
  defaultWorkspace,
  onAccentChange,
  onDensityChange,
  onMotionModeChange,
  onSuperSonicModeChange,
  onUiSoundsEnabledChange,
  onMidiInputEnabledChange,
  onMidiRecordEnabledChange,
  onDefaultWorkspaceChange,
}: PreferencesPanelProps) => (
  <div className="space-y-4">
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
        SuperSonic puts a one-tap assist bar above the keyboard with Vary volume, Shift, Octave, and Clear for the focused lane. It also turns on hover guidance and a brighter look. Normal mode keeps the same tools tucked in their panels. Toggle whenever; staying in either is fine. Shortcut: Alt+S.
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

    <PanelCard icon={<Keyboard className="h-4 w-4 text-[var(--accent)]" />} title="MIDI keyboard">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        {midiSupported
          ? 'Play the selected lane from a connected MIDI keyboard. Your browser may ask permission the first time.'
          : 'This browser does not support MIDI input. Chrome or Edge on desktop works best.'}
      </p>
      <div className="mt-3 flex gap-2">
        <StateButton active={midiInputEnabled} label="On" onClick={() => onMidiInputEnabledChange(true)} />
        <StateButton active={!midiInputEnabled} label="Off" onClick={() => onMidiInputEnabledChange(false)} />
      </div>
      {midiSupported && midiInputEnabled ? (
        <div className="mt-4 border-t border-[var(--chrome-line)] pt-3">
          <p className="text-[11px] leading-5 text-[var(--text-secondary)]">
            Record into the lane while playing. Notes you play land on the step under the playhead.
          </p>
          <div className="mt-3 flex gap-2">
            <StateButton active={midiRecordEnabled} label="On" onClick={() => onMidiRecordEnabledChange(true)} />
            <StateButton active={!midiRecordEnabled} label="Off" onClick={() => onMidiRecordEnabledChange(false)} />
          </div>
        </div>
      ) : null}
    </PanelCard>

    <PanelCard icon={<Keyboard className="h-4 w-4 text-[var(--accent)]" />} title="Keyboard shortcuts">
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Reference for transport, editing, and playable keys.
      </p>
      <ShortcutGroup title="Transport" shortcuts={SHORTCUTS.filter((s) => s.group === 'Transport')} />
      <ShortcutGroup title="Edit" shortcuts={SHORTCUTS.filter((s) => s.group === 'Edit')} />
      <ShortcutGroup title="Tap to play" shortcuts={SHORTCUTS.filter((s) => s.group === 'Tap to play')} />
    </PanelCard>

    <StorageMeterCard />

    <PanelCard icon={<HardDrive className="h-4 w-4 text-[var(--accent)]" />} title="Where saves live">
      <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
        SonicStudio saves to <span className="font-mono text-[11px] text-[var(--text-primary)]">localStorage</span> in your browser, not to a server. That means:
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

const StorageMeterCard = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [estimate, setEstimate] = useState<{ usageBytes: number; quotaBytes: number } | null>(null);

  useEffect(() => {
    setUsage(measureLocalStorageUsage());
    let active = true;
    void estimateOriginStorage().then((result) => {
      if (active) setEstimate(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!usage) {
    return null;
  }

  const largest = usage.categories[0]?.bytes ?? 1;
  const quotaPercent = estimate
    ? Math.min(100, Math.max(1, Math.round((estimate.usageBytes / estimate.quotaBytes) * 100)))
    : 0;

  return (
    <PanelCard icon={<Database className="h-4 w-4 text-[var(--accent)]" />} title="Studio data">
      <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
        Saved in this browser:{' '}
        <span className="font-mono text-[11px] text-[var(--text-primary)]">{formatBytes(usage.totalBytes)}</span>
        {usage.categories.length === 0 ? ' (nothing saved yet)' : ''}
      </p>

      {usage.categories.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {usage.categories.map((category) => (
            <div className="grid gap-1" key={category.label}>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{category.label}</span>
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{formatBytes(category.bytes)}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--chrome-line)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.max(4, Math.round((category.bytes / largest) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {estimate ? (
        <div className="mt-4 border-t border-[var(--chrome-line)] pt-3">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>All site storage</span>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
              {formatBytes(estimate.usageBytes)} / {formatBytes(estimate.quotaBytes)}
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--chrome-line)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${quotaPercent}%` }} />
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">
            Counts layouts, samples, and the offline cache too, not just saves.
          </p>
        </div>
      ) : null}
    </PanelCard>
  );
};

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
