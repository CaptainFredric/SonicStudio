import React, { useState } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { MainWorkspace as Sequencer } from './components/MainWorkspace';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { DeviceRack } from './components/DeviceRack';
import { SettingsSidebar } from './components/SettingsSidebar';
import { Arranger } from './components/Arranger';
import { Music, LayoutGrid, Volume2, Settings, Layers3, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

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
    <main className="flex min-h-[440px] flex-col overflow-visible lg:min-h-[520px]">
      {activeView === 'SEQUENCER' && <Sequencer />}
      {activeView === 'PIANO_ROLL' && <PianoRoll />}
      {activeView === 'MIXER' && <Mixer />}
      {activeView === 'ARRANGER' && <Arranger />}
    </main>
  );
};

const StudioShell = () => {
  const { isSettingsOpen, selectedTrackId, toggleSettings, tracks } = useAudio();
  const [isMobileRackOpen, setIsMobileRackOpen] = useState(true);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;

  return (
    <div className="app-shell min-h-screen w-full overflow-x-hidden antialiased text-[var(--text-primary)]">
      <div className="flex min-h-screen flex-col">
        <div className="px-3 pt-3">
          <TopBar />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-3 pb-3 sm:flex-row">
          <SideNav />
          <div className="chrome-frame flex min-w-0 flex-1 flex-col gap-3 p-3">
            <div className="relative min-h-[440px] lg:min-h-[520px]">
              <ViewRouter />
              {isSettingsOpen && (
                <>
                  <button
                    aria-label="Close studio setup"
                    className="absolute inset-0 z-20 bg-[rgba(1,3,6,0.58)] xl:hidden"
                    onClick={toggleSettings}
                  />
                  <div
                    className="absolute inset-y-0 right-0 z-30"
                    style={{ width: 'min(360px, calc(100% - 1rem))' }}
                  >
                    <SettingsSidebar />
                  </div>
                </>
              )}
            </div>
            <div className="lg:hidden">
              <button
                className="surface-panel-muted flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setIsMobileRackOpen((current) => !current)}
                type="button"
              >
                <div className="min-w-0">
                  <div className="section-label">Sound desk</div>
                  <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {selectedTrack ? `${selectedTrack.name} · ${selectedTrack.type}` : 'Select a track to shape its sound'}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
                  {isMobileRackOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>
              </button>
            </div>
            <div className={`${isMobileRackOpen ? 'block' : 'hidden'} lg:block`}>
              <DeviceRack />
            </div>
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
