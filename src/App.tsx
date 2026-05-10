import React, { useEffect, useState } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { MainWorkspace as Sequencer } from './components/MainWorkspace';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { DeviceRack } from './components/DeviceRack';
import { SettingsSidebar } from './components/SettingsSidebar';
import { Arranger } from './components/Arranger';
import { Music, LayoutGrid, Volume2, Settings, Layers3 } from 'lucide-react';

const SideNav = () => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();

  const navItems = [
    { id: 'SEQUENCER', icon: <Music size={20} />, label: 'Sequencer' },
    { id: 'PIANO_ROLL', icon: <LayoutGrid size={20} />, label: 'Piano Roll' },
    { id: 'MIXER', icon: <Volume2 size={20} />, label: 'Mixer' },
    { id: 'ARRANGER', icon: <Layers3 size={20} />, label: 'Arranger' },
  ];

  return (
    <aside className="studio-rail sm:w-[88px] w-full shrink-0 px-2 py-2 sm:py-3 flex sm:flex-col flex-row items-center justify-start gap-2 overflow-x-auto sm:overflow-x-visible [-webkit-overflow-scrolling:touch]">
      <div className="section-label hidden sm:block">Views</div>
      <div className="flex sm:flex-col flex-row gap-2 w-full sm:w-auto">
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
      <div className="ml-auto sm:mt-auto sm:w-full pt-3 sm:border-t border-[var(--border-soft)]">
        <button
          className="studio-nav-button shrink-0 sm:w-full"
          data-active={isSettingsOpen}
          onClick={toggleSettings}
          title="Options"
          type="button"
        >
          <div className="flex sm:flex-col flex-row items-center gap-2">
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
    <main className="relative flex flex-col min-h-[60vh] sm:min-h-0 sm:flex-1 sm:overflow-hidden">
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
  const { isSettingsOpen } = useAudio();
  const isFirstImpression = useFirstImpression();

  return (
    <div className="app-shell min-h-screen w-full sm:h-screen sm:w-screen sm:overflow-hidden antialiased text-[var(--text-primary)]">
      <div className="flex flex-col sm:h-full sm:overflow-hidden">
        <div className="px-3 pt-3">
          <TopBar firstImpression={isFirstImpression} />
        </div>
        <div className="studio-shell-grid flex flex-col sm:flex-row sm:flex-1 sm:min-h-0 gap-3 px-3 pb-3">
          <SideNav />
          <div className="studio-workbench flex sm:min-h-0 sm:flex-1 flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:min-h-0 sm:flex-1 gap-3">
              <ViewRouter />
              {isSettingsOpen && <SettingsSidebar />}
            </div>
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
