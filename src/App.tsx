import React from 'react';
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
    <aside className="studio-nav sm:w-[104px] w-full shrink-0 shrink px-2 py-3 sm:py-4 flex sm:flex-col flex-row items-center justify-start sm:justify-start gap-2 sm:gap-4 overflow-x-auto sm:overflow-x-visible [-webkit-overflow-scrolling:touch]">
      <div className="section-label hidden sm:block">Deck</div>
      <div className="flex sm:flex-col flex-row gap-2 w-full sm:w-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={`nav-button px-2 py-3 transition-colors ${activeView === item.id ? 'is-active' : ''}`}
            title={item.label}
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
          className={`nav-button px-2 py-3 transition-colors shrink-0 sm:w-full ${isSettingsOpen ? 'is-active' : ''}`}
          onClick={toggleSettings}
        >
          <div className="flex sm:flex-col flex-row items-center gap-2">
            <Settings size={20} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Setup</span>
          </div>
        </button>
      </div>
    </aside>
  );
};

const ViewRouter = () => {
  const { activeView } = useAudio();
  return (
    <main className="flex-1 min-h-0 relative overflow-hidden">
      {activeView === 'SEQUENCER' && <Sequencer />}
      {activeView === 'PIANO_ROLL' && <PianoRoll />}
      {activeView === 'MIXER' && <Mixer />}
      {activeView === 'ARRANGER' && <Arranger />}
    </main>
  );
};

const StudioShell = () => {
  const { isSettingsOpen } = useAudio();

  return (
    <div className="app-shell h-screen w-screen overflow-hidden antialiased text-[var(--text-primary)]">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="px-3 pt-3">
          <TopBar />
        </div>
        <div className="flex flex-1 min-h-0 gap-3 px-3 pb-3">
          <SideNav />
          <div className="chrome-frame flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex min-h-0 flex-1 gap-3">
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
