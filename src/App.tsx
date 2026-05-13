import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { ComposeView } from './components/ComposeView';
import { ShareDialog } from './components/ShareDialog';
import { AudioCapture } from './components/AudioCapture';
import { OnboardingGuide } from './components/OnboardingGuide';
import { ToastStack, type ToastItem } from './components/ToastStack';
import { resolveStudioRoute, type StudioRouteState } from './app/routeController';
import type { SessionTemplateId } from './project/schema';
import { Music, LayoutGrid, Volume2, Settings, Layers3, Sparkles, Rows2, Share2, Mic } from 'lucide-react';

const SideNav = ({ onOpenLaunchpad, onOpenShare, onOpenRecord }: { onOpenLaunchpad: () => void; onOpenShare: () => void; onOpenRecord: () => void }) => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();

  const navItems = [
    { id: 'COMPOSE', icon: <Rows2 size={20} />, label: 'Compose' },
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
        data-tour-target="sessions"
        onClick={onOpenLaunchpad}
        title="Open session library"
        type="button"
      >
        <div className="flex md:flex-col flex-row items-center gap-2">
          <Sparkles size={20} className="text-[var(--accent)]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Library</span>
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
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{item.label === 'Piano Roll' ? 'Roll' : item.label === 'Sequencer' ? 'Seq' : item.label === 'Mixer' ? 'Mix' : item.label === 'Arranger' ? 'Arrange' : item.label}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="ml-auto md:mt-auto md:w-full md:border-t border-[var(--border-soft)] pt-3 flex md:flex-col flex-row gap-2 md:gap-0">
        <button
          className="studio-nav-button shrink-0 md:w-full"
          onClick={onOpenRecord}
          title="Record audio and match it to a track type"
          type="button"
        >
          <div className="flex md:flex-col flex-row items-center gap-2">
            <Mic size={20} className="text-[var(--danger)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Record</span>
          </div>
        </button>
        <button
          className="studio-nav-button shrink-0 md:w-full"
          data-tour-target="share"
          onClick={onOpenShare}
          title="Share this session"
          type="button"
        >
          <div className="flex md:flex-col flex-row items-center gap-2">
            <Share2 size={20} className="text-[var(--accent)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Share</span>
          </div>
        </button>
        <button
          className="studio-nav-button shrink-0 md:w-full"
          data-active={isSettingsOpen}
          data-tour-target="options"
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
  if (activeView === 'COMPOSE') {
    return <ComposeView />;
  }
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

const decodeShareHashOnce = (() => {
  let consumed = false;
  return (): string | null => {
    if (consumed) return null;
    if (typeof window === 'undefined') return null;
    const match = window.location.hash.match(/#share=([^&]+)/);
    if (!match) return null;
    consumed = true;
    try {
      const encoded = match[1];
      const decoded = decodeURIComponent(escape(window.atob(encoded)));
      // Clear the hash so reloads don't re-import
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return decoded;
    } catch (error) {
      console.error('SonicStudio: failed to decode share link', error);
      return null;
    }
  };
})();

const readInitialRouteState = (): StudioRouteState => {
  if (typeof window === 'undefined') {
    return resolveStudioRoute('', false);
  }
  let hasPersistedSession = false;
  try {
    hasPersistedSession = !!window.localStorage.getItem('sonicstudio:session:v1');
  } catch {
    hasPersistedSession = false;
  }
  return resolveStudioRoute(window.location.search, hasPersistedSession);
};

type ToastTone = ToastItem['tone'];

const StudioShell = ({ routeState }: { routeState: StudioRouteState }) => {
  const {
    importMidiSession,
    importSession,
    initAudio,
    isInitialized,
    isSettingsOpen,
    latestNotice,
    loadSessionTemplate,
    setActiveView,
  } = useAudio();
  const isFirstImpression = useFirstImpression();

  const [isLaunchpadOpen, setLaunchpadOpen] = useState<boolean>(() => {
    return routeState.showLaunchpad;
  });
  const [isGuideOpen, setGuideOpen] = useState<boolean>(() => routeState.showGuide);
  const [isShareOpen, setShareOpen] = useState(false);
  const [isRecordOpen, setRecordOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Record<number, number>>({});

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete toastTimersRef.current[id];
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { detail, id, title, tone }]);
    toastTimersRef.current[id] = window.setTimeout(() => {
      dismissToast(id);
    }, 3600);
  }, [dismissToast]);

  useEffect(() => () => {
    (Object.values(toastTimersRef.current) as number[]).forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!latestNotice) {
      return;
    }
    pushToast(latestNotice.tone, latestNotice.title, latestNotice.detail);
  }, [latestNotice, pushToast]);

  useEffect(() => {
    if (!isLaunchpadOpen) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setLaunchpadOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLaunchpadOpen]);

  useEffect(() => {
    const shared = decodeShareHashOnce();
    if (!shared) return;
    let cancelled = false;
    const loadSharedSession = async () => {
      setLaunchpadOpen(false);
      const file = new File([shared], 'shared-session.sonicstudio.json', { type: 'application/json' });
      await importSession(file);
      if (!cancelled) {
        setGuideOpen(false);
      }
    };
    void loadSharedSession();
    return () => {
      cancelled = true;
    };
  }, [importSession]);

  const handleSelectTemplate = (templateId: SessionTemplateId) => {
    setGuideOpen(false);
    loadSessionTemplate(templateId);
    setLaunchpadOpen(false);
    void initAudio();
  };

  const handleStartGuide = () => {
    loadSessionTemplate('night-transit');
    setActiveView('ARRANGER');
    setLaunchpadOpen(false);
    setGuideOpen(true);
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
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <OnboardingGuide open={isGuideOpen && !isLaunchpadOpen && !isShareOpen && !isRecordOpen} onClose={() => setGuideOpen(false)} />
      <ShortcutOverlay />
      <ShareDialog open={isShareOpen} onClose={() => setShareOpen(false)} onNotify={pushToast} />
      <AudioCapture open={isRecordOpen} onClose={() => setRecordOpen(false)} />
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
            onStartGuide={handleStartGuide}
            onWakeAudio={() => void initAudio()}
          />
        </div>
      ) : null}
      <div className="flex flex-col md:h-full md:overflow-hidden">
        <div className="px-3 pt-3">
          <TopBar firstImpression={isFirstImpression} />
        </div>
        <div className="studio-shell-grid flex flex-col md:flex-row md:flex-1 md:min-h-0 gap-3 px-3 pb-3">
          <SideNav
            onOpenLaunchpad={() => setLaunchpadOpen(true)}
            onOpenRecord={() => {
              setGuideOpen(false);
              setRecordOpen(true);
            }}
            onOpenShare={() => {
              setGuideOpen(false);
              setShareOpen(true);
            }}
          />
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
  const [routeState] = useState(readInitialRouteState);

  return (
    <AudioProvider routeState={routeState}>
      <StudioShell routeState={routeState} />
    </AudioProvider>
  );
}
