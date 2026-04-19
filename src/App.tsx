import React, { useEffect, useRef, useState } from 'react';
import { resolveStudioRoute, type StudioRouteState } from './app/routeController';
import { playUiSound, type UiSoundVariant } from './audio/uiSounds';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { MainWorkspace as Sequencer } from './components/MainWorkspace';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { DeviceRack } from './components/DeviceRack';
import { SettingsSidebar } from './components/SettingsSidebar';
import { Arranger } from './components/Arranger';
import { Launchpad } from './components/Launchpad';
import type { SessionTemplateId } from './project/schema';
import { hasPersistedSession } from './project/storage';
import { Music, LayoutGrid, Volume2, Settings, Layers3, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
const TEMPLATE_VIEW_MAP: Record<SessionTemplateId, 'SEQUENCER' | 'PIANO_ROLL' | 'ARRANGER'> = {
  'ambient-drift': 'PIANO_ROLL',
  'beat-lab': 'SEQUENCER',
  'blank-grid': 'ARRANGER',
  'night-transit': 'ARRANGER',
};

const resolveCurrentRoute = (): StudioRouteState => {
  if (typeof window === 'undefined') {
    return resolveStudioRoute('', true);
  }

  return resolveStudioRoute(window.location.search, hasPersistedSession());
};

const SideNav = () => {
  const { activeView, isSettingsOpen, setActiveView, setSettingsOpen } = useAudio();

  const navItems = [
    { id: 'SEQUENCER', icon: <Music size={20} />, label: 'Sequencer' },
    { id: 'PIANO_ROLL', icon: <LayoutGrid size={20} />, label: 'Piano Roll' },
    { id: 'MIXER', icon: <Volume2 size={20} />, label: 'Mixer' },
    { id: 'ARRANGER', icon: <Layers3 size={20} />, label: 'Arranger' },
  ];

  return (
    <aside className="studio-nav sm:w-[88px] w-full shrink-0 shrink px-2 py-3 sm:py-4 flex sm:flex-col flex-row items-center justify-start sm:justify-start gap-2 sm:gap-4 overflow-x-auto sm:overflow-x-visible [-webkit-overflow-scrolling:touch]">
      <div className="section-label hidden sm:block">Deck</div>
      <div className="flex sm:flex-col flex-row gap-2 w-full sm:w-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={`nav-button px-2 py-3 transition-colors ${activeView === item.id ? 'is-active' : ''}`}
            data-ui-sound="nav"
            title={item.label}
          >
            <div className="flex flex-col items-center gap-2">
              {item.icon}
            <span className="font-mono text-[8px] uppercase tracking-[0.18em]">{item.label === 'Piano Roll' ? 'Roll' : item.label === 'Sequencer' ? 'Seq' : item.label === 'Mixer' ? 'Mix' : 'Arrange'}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="ml-auto sm:mt-auto sm:w-full pt-3 sm:border-t border-[var(--border-soft)]">
        <button
          className={`nav-button px-2 py-3 transition-colors shrink-0 sm:w-full ${isSettingsOpen ? 'is-active' : ''}`}
          data-ui-sound="settings"
          onClick={() => setSettingsOpen(!isSettingsOpen)}
        >
          <div className="flex sm:flex-col flex-row items-center gap-2">
            <Settings size={20} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Opts</span>
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

const StudioShell = ({
  routeState,
}: {
  routeState: StudioRouteState;
}) => {
  const {
    initAudio,
    importMidiSession,
    isInitialized,
    isSettingsOpen,
    loadSessionTemplate,
    setSettingsOpen,
    selectedTrackId,
    setActiveView,
    tracks,
    uiSoundsEnabled,
  } = useAudio();
  const [isRackOpen, setIsRackOpen] = useState(true);
  const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(routeState.showLaunchpad);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const midiLaunchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) {
      return;
    }

    const handleFirstStudioInteraction = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest('input, select, textarea, a[href], [data-skip-audio-init="true"]')) {
        return;
      }

      void initAudio();
    };

    window.addEventListener('pointerdown', handleFirstStudioInteraction, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstStudioInteraction, true);
    };
  }, [initAudio, isInitialized]);

  useEffect(() => {
    setIsLaunchpadOpen(routeState.showLaunchpad);
  }, [routeState.showLaunchpad]);

  useEffect(() => {
    if (typeof window === 'undefined' || !uiSoundsEnabled) {
      return undefined;
    }

    const resolveSoundVariant = (element: HTMLElement): UiSoundVariant => {
      const explicitVariant = element.dataset.uiSound as UiSoundVariant | 'off' | undefined;
      if (explicitVariant && explicitVariant !== 'off') {
        return explicitVariant;
      }

      if (explicitVariant === 'off') {
        return 'action';
      }

      if (element.classList.contains('nav-button')) {
        return 'nav';
      }

      return 'action';
    };

    const handleUiClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('button');
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return;
      }

      if (button.dataset.uiSound === 'off') {
        return;
      }

      playUiSound(resolveSoundVariant(button));
    };

    window.addEventListener('click', handleUiClick, true);
    return () => {
      window.removeEventListener('click', handleUiClick, true);
    };
  }, [uiSoundsEnabled]);

  const handleLaunchpadTemplate = (templateId: SessionTemplateId) => {
    loadSessionTemplate(templateId);
    setActiveView(TEMPLATE_VIEW_MAP[templateId]);
    setIsLaunchpadOpen(false);
  };

  const handleLaunchpadImportMidi = () => {
    midiLaunchInputRef.current?.click();
  };

  if (isLaunchpadOpen) {
    return (
      <div className="app-shell min-h-screen w-full overflow-x-hidden antialiased text-[var(--text-primary)]">
        <input
          ref={midiLaunchInputRef}
          accept=".mid,.midi,audio/midi,audio/x-midi"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            const imported = await importMidiSession(file);
            if (imported) {
              setActiveView('ARRANGER');
              setIsLaunchpadOpen(false);
            }
            event.target.value = '';
          }}
          type="file"
        />
        <div className="min-h-screen px-3 py-3">
          <Launchpad
            isInitialized={isInitialized}
            isOpen
            onClose={() => setIsLaunchpadOpen(false)}
            onImportMidi={handleLaunchpadImportMidi}
            onSelectTemplate={handleLaunchpadTemplate}
            onWakeAudio={() => { void initAudio(); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen w-full overflow-x-hidden antialiased text-[var(--text-primary)]">
      <input
        ref={midiLaunchInputRef}
        accept=".mid,.midi,audio/midi,audio/x-midi"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const imported = await importMidiSession(file);
          if (imported) {
            setActiveView('ARRANGER');
            setIsLaunchpadOpen(false);
          }
          event.target.value = '';
        }}
        type="file"
      />
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
                    data-ui-sound="off"
                    onClick={() => setSettingsOpen(false)}
                  />
                  <div
                    className="absolute inset-y-0 right-0 z-30"
                    style={{ width: 'min(360px, calc(100% - 1rem))' }}
                  >
                    <SettingsSidebar requestedTab={routeState.requestedSettingsTab} />
                  </div>
                </>
              )}
            </div>

            <button
              className="flex w-full items-center justify-between gap-3 border-t border-[var(--border-soft)] px-1 py-3 text-left"
              data-ui-sound="settings"
              onClick={() => setIsRackOpen((current) => !current)}
              type="button"
            >
              <div className="min-w-0">
                <div className="section-label">Sound desk</div>
                <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {selectedTrack ? `${selectedTrack.name} · ${selectedTrack.type}` : 'Select a track to shape its sound'}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {isRackOpen ? 'Dock open' : 'Open source, shape, and output'}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
                {isRackOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </button>

            {isRackOpen && (
              <div className="rack-sheet">
                <DeviceRack />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [routeState, setRouteState] = useState<StudioRouteState>(() => resolveCurrentRoute());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncRouteState = () => {
      setRouteState(resolveCurrentRoute());
    };

    window.addEventListener('popstate', syncRouteState);
    return () => {
      window.removeEventListener('popstate', syncRouteState);
    };
  }, []);

  return (
    <AudioProvider routeState={routeState}>
      <StudioShell routeState={routeState} />
    </AudioProvider>
  );
}
