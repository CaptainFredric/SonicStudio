import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Settings2, Sliders, Speaker, X } from 'lucide-react';

import { MidiInputManager } from '../audio/midiInput';
import { useAudio } from '../context/AudioContext';
import { OutputSettingsPanel } from './settings/OutputSettingsPanel';
import { PreferencesPanel } from './settings/PreferencesPanel';
import { ScoresheetsPanel } from './settings/ScoresheetsPanel';
import { TrackSettingsPanel } from './settings/TrackSettingsPanel';
import { WorkspaceSettingsPanel } from './settings/WorkspaceSettingsPanel';
import type { SettingsTab } from '../app/routeController';

type StudioTab = SettingsTab | 'PREFERENCES' | 'SCORESHEETS';

const TAB_DEFINITIONS: Array<{ id: StudioTab; label: string; icon: ReactNode; description: string }> = [
  {
    id: 'PREFERENCES',
    label: 'Preferences',
    icon: <Settings2 className="h-3.5 w-3.5" />,
    description: 'How the app looks and feels, plus a keyboard shortcut reference.',
  },
  {
    id: 'SCORESHEETS',
    label: 'Scoresheets',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    description: 'Save many named snapshots of the current session and switch between them.',
  },
  {
    id: 'WORKSPACE',
    label: 'Workspace',
    icon: <Sliders className="h-3.5 w-3.5" />,
    description: 'Session tools, transport settings, recovery checkpoints, and exporting.',
  },
  {
    id: 'TRACK',
    label: 'Track',
    icon: <Sliders className="h-3.5 w-3.5" />,
    description: 'Settings for the selected track: source, voice preset, and routing.',
  },
  {
    id: 'OUTPUT',
    label: 'Output',
    icon: <Speaker className="h-3.5 w-3.5" />,
    description: 'Master chain, glue compression, and limiter ceiling.',
  },
];

export const SettingsSidebar = ({
  requestedTab = 'WORKSPACE',
}: {
  requestedTab?: SettingsTab;
}) => {
  const {
    accentColor,
    density,
    defaultWorkspace,
    isSettingsOpen,
    motionMode,
    setAccentColor,
    setDefaultWorkspace,
    setDensity,
    setMotionMode,
    setSettingsOpen,
    setSuperSonicMode,
    setUiSoundsEnabled,
    setMidiInputEnabled,
    setMidiRecordEnabled,
    superSonicMode,
    uiSoundsEnabled,
    midiInputEnabled,
    midiRecordEnabled,
  } = useAudio();
  const [settingsTab, setSettingsTab] = useState<StudioTab>(requestedTab);

  useEffect(() => {
    setSettingsTab(requestedTab);
  }, [requestedTab]);

  if (!isSettingsOpen) {
    return null;
  }

  const activeDefinition = TAB_DEFINITIONS.find((tab) => tab.id === settingsTab) ?? TAB_DEFINITIONS[0];

  return (
    <aside className="surface-panel settings-sheet flex h-full w-full flex-col overflow-hidden">
      <div className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 pb-3 pt-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="section-label">Controls</div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{activeDefinition.label}</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{activeDefinition.description}</p>
          </div>
          <button
            aria-label="Close settings"
            className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center"
            data-ui-sound="settings"
            onClick={() => setSettingsOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Settings sections">
          {TAB_DEFINITIONS.map((tab) => {
            const isActive = settingsTab === tab.id;
            return (
              <button
                key={tab.id}
                className="control-chip flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors"
                data-active={isActive}
                data-ui-sound="tab"
                onClick={() => setSettingsTab(tab.id)}
                type="button"
              >
                <span className="text-[var(--accent)]">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {settingsTab === 'PREFERENCES' ? (
          <PreferencesPanel
            accentColor={accentColor}
            defaultWorkspace={defaultWorkspace}
            density={density}
            motionMode={motionMode}
            superSonicMode={superSonicMode}
            uiSoundsEnabled={uiSoundsEnabled}
            midiInputEnabled={midiInputEnabled}
            midiRecordEnabled={midiRecordEnabled}
            midiSupported={MidiInputManager.isSupported()}
            onAccentChange={setAccentColor}
            onDefaultWorkspaceChange={setDefaultWorkspace}
            onDensityChange={setDensity}
            onMotionModeChange={setMotionMode}
            onSuperSonicModeChange={setSuperSonicMode}
            onUiSoundsEnabledChange={setUiSoundsEnabled}
            onMidiInputEnabledChange={setMidiInputEnabled}
            onMidiRecordEnabledChange={setMidiRecordEnabled}
          />
        ) : null}
        {settingsTab === 'SCORESHEETS' ? <ScoresheetsPanel /> : null}
        {settingsTab === 'WORKSPACE' ? <WorkspaceSettingsPanel /> : null}
        {settingsTab === 'TRACK' ? <TrackSettingsPanel /> : null}
        {settingsTab === 'OUTPUT' ? <OutputSettingsPanel /> : null}
      </div>
    </aside>
  );
};
