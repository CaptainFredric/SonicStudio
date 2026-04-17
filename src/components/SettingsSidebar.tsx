import { useState } from 'react';
import { X } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { OutputSettingsPanel } from './settings/OutputSettingsPanel';
import { SegmentButton } from './settings/SettingsPrimitives';
import { TrackSettingsPanel } from './settings/TrackSettingsPanel';
import { WorkspaceSettingsPanel } from './settings/WorkspaceSettingsPanel';

type SettingsTab = 'WORKSPACE' | 'TRACK' | 'OUTPUT';

const getInitialSettingsTab = (): SettingsTab => {
  if (typeof window === 'undefined') {
    return 'WORKSPACE';
  }

  const requestedTab = new URLSearchParams(window.location.search).get('setup')?.toUpperCase();
  if (requestedTab === 'TRACK' || requestedTab === 'OUTPUT' || requestedTab === 'WORKSPACE') {
    return requestedTab;
  }

  return 'WORKSPACE';
};

export const SettingsSidebar = () => {
  const { isSettingsOpen, toggleSettings } = useAudio();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(getInitialSettingsTab);

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <aside className="surface-panel h-full w-full overflow-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-label">Workspace</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Studio Setup</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Session actions, transport, and output settings.</p>
        </div>
        <button
          aria-label="Close settings"
          className="ghost-icon-button flex h-10 w-10 items-center justify-center"
          onClick={toggleSettings}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <SegmentButton active={settingsTab === 'WORKSPACE'} label="Workspace" onClick={() => setSettingsTab('WORKSPACE')} />
          <SegmentButton active={settingsTab === 'TRACK'} label="Track" onClick={() => setSettingsTab('TRACK')} />
          <SegmentButton active={settingsTab === 'OUTPUT'} label="Output" onClick={() => setSettingsTab('OUTPUT')} />
        </div>

        {settingsTab === 'WORKSPACE' ? <WorkspaceSettingsPanel /> : null}
        {settingsTab === 'TRACK' ? <TrackSettingsPanel /> : null}
        {settingsTab === 'OUTPUT' ? <OutputSettingsPanel /> : null}
      </div>
    </aside>
  );
};
