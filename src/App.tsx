import React, { useEffect, useRef, useState } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { MainWorkspace as Sequencer } from './components/MainWorkspace';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { DeviceRack } from './components/DeviceRack';
import { SettingsSidebar } from './components/SettingsSidebar';
import { Arranger } from './components/Arranger';
import { TapToPlay } from './components/TapToPlay';
import { Launchpad } from './components/Launchpad';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { resolveStudioRoute } from './app/routeController';
import type { SessionTemplateId } from './project/schema';
import { Music, LayoutGrid, Volume2, Settings, Layers3, Sparkles } from 'lucide-react';

const SideNav = ({ onOpenLaunchpad }: { onOpenLaunchpad: () => void }) => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();

  const navItems = [
    { id: 'SEQUENCER', icon: <Music size={20} />, label: 'Sequencer' },
    { id: 'PIANO_ROLL', icon: <LayoutGrid size={20} />, label: 'Piano Roll' },
    { id: 'MIXER', icon: <Volume2 size={20} />, label: 'Mixer' },
    { id: 'ARRANGER', icon: <Layers3 size={20} />, label: 'Arranger' },
  ];

  return (
    <aside className="studio-rail md:w-[88px] w-full shrink-0 px-2 py-2 md:py-3 flex md:flex-col flex-row items-center justify-start gap-2 overflow-x-auto md:overflow-x-visible [-webkit-overflow-scrolling:touch]">
      <div className="section-label hidden md:block">Views</div>
      <button
        className="studio-nav-button shrink-0 md:w-full"
        onClick={onOpenLaunchpad}
        title="Open a starter session"
        type="button"
      >
        <div className="flex md:flex-col flex-row items-center gap-2">
          <Sparkles size={20} className="text-[var(--accent)]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Sessions</span>
        </div>
      </button>
      <div className="flex md:flex-col flex-row gap-2 w-full md:w-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className="studio-nav-button"
            data-active={activeView === item.id}
            title={item.label}
            type="button"
          >
            <div className="flex flex-col items-center gap-2">
              {item.icon}
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{item.label === 'Piano Roll' ? 'Roll' : item.label === 'Sequencer' ? 'Seq' : item.label === 'Mixer' ? 'Mix' : 'Arrange'}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="ml-auto md:mt-auto md:w-full pt-3 md:border-t border-[var(--border-soft)]">
        <button
          className="studio-nav-button shrink-0 md:w-full"
          data-active={isSettingsOpen}
          onClick={toggleSettings}
          title="Options"
          type="button"
        >
          <div className="flex md:flex-col flex-row items-center gap-2">
            <Settings size={20} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Options</span>
          </div>
        </button>
      </div>
    </aside>
  );
};

const ViewRouter = () => {
  const { activeView } = useAudio();
  return (
    <main className="relative flex flex-col min-h-[60vh] md:min-h-0 md:flex-1 md:overflow-hidden">
      {activeView === 'SEQUENCER' && <Sequencer />}
      {activeView === 'PIANO_ROLL' && <PianoRoll />}
      {activeView === 'MIXER' && <Mixer />}
      {activeView === 'ARRANGER' && <Arranger />}
    </main>
  );
};

const useFirstImpression = () => {
  const { isPlaying } = useAudio();
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  useEffect(() => {
    if (isPlaying) setHasEverPlayed(true);
  }, [isPlaying]);
  return !hasEverPlayed;
};

const StudioShell = () => {
  const { initAudio, isInitialized, isSettingsOpen, importMidiSession, loadSessionTemplate } = useAudio();
  const isFirstImpression = useFirstImpression();

  const hasPersistedRef = useRef<boolean | null>(null);
  if (hasPersistedRef.current === null && typeof window !== 'undefined') {
    try {
      hasPersistedRef.current = !!window.localStorage.getItem('sonicstudio:session');
    } catch {
      hasPersistedRef.current = false;
    }
  }
  const [isLaunchpadOpen, setLaunchpadOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return resolveStudioRoute(window.location.search, hasPersistedRef.current ?? false).showLaunchpad;
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectTemplate = (templateId: SessionTemplateId) => {
    loadSessionTemplate(templateId);
    setLaunchpadOpen(false);
    void initAudio();
  };
  const handleImportMidi = () => {
    fileInputRef.current?.click();
  };
  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const ok = await importMidiSession(file);
      if (ok) setLaunchpadOpen(false);
    }
    event.target.value = '';
  };

  return (
    <div className="app-shell min-h-screen w-full md:h-screen md:w-screen md:overflow-hidden antialiased text-[var(--text-primary)]">
      <ShortcutOverlay />
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        onChange={handleFileChosen}
        style={{ display: 'none' }}
        aria-hidden
      />
      {isLaunchpadOpen ? (
        <div className="fixed inset-0 z-40 overflow-auto bg-[var(--bg-app)] p-3">
          <Launchpad
            isInitialized={isInitialized}
            isOpen={isLaunchpadOpen}
            onClose={() => setLaunchpadOpen(false)}
            onImportMidi={handleImportMidi}
            onSelectTemplate={handleSelectTemplate}
            onWakeAudio={() => void initAudio()}
          />
        </div>
      ) : null}
      <div className="flex flex-col md:h-full md:overflow-hidden">
        <div className="px-3 pt-3">
          <TopBar firstImpression={isFirstImpression} />
        </div>
        <div className="studio-shell-grid flex flex-col md:flex-row md:flex-1 md:min-h-0 gap-3 px-3 pb-3">
          <SideNav onOpenLaunchpad={() => setLaunchpadOpen(true)} />
          <div className="studio-workbench flex md:min-h-0 md:flex-1 flex-col gap-3">
            <div className="flex flex-col md:flex-row md:min-h-0 md:flex-1 gap-3">
              <ViewRouter />
              {isSettingsOpen && <SettingsSidebar />}
            </div>
            <TapToPlay />
            <DeviceRack />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AudioProvider>
      <StudioShell />
    </AudioProvider>
  );
}
