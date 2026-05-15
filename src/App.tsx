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
import { markOnboardingCompleted, markOnboardingSkipped, shouldAutoOpenOnboarding } from './services/onboardingState';
import { AudioWaveform, LayoutGrid, Volume2, Settings, Layers3, Sparkles, Rows2, Share2, Radio, Coffee } from 'lucide-react';
import { Circle, Pause, Play, Square } from 'lucide-react';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';

const SideNav = ({ onOpenLaunchpad, onOpenShare, onOpenRecord }: { onOpenLaunchpad: () => void; onOpenShare: () => void; onOpenRecord: () => void }) => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();

  const navItems = [
    { id: 'COMPOSE', icon: <Rows2 size={20} />, label: 'Compose' },
    { id: 'SEQUENCER', icon: <AudioWaveform size={20} />, label: 'Sequencer' },
    { id: 'PIANO_ROLL', icon: <LayoutGrid size={20} />, label: 'Piano Roll' },
    { id: 'MIXER', icon: <Volume2 size={20} />, label: 'Mixer' },
    { id: 'ARRANGER', icon: <Layers3 size={20} />, label: 'Arranger' },
  ];

  const renderViewButton = (item: { icon: React.ReactNode; id: string; label: string }) => (
    <button
      key={item.id}
      aria-label={item.label}
      className="studio-nav-button w-full"
      data-active={activeView === item.id}
      data-ui-sound="nav"
      onClick={() => setActiveView(item.id as any)}
      title={item.label}
      type="button"
    >
      <div className="flex flex-col items-center gap-2">
        {item.icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.18em]">
          {item.label === 'Piano Roll' ? 'Roll' : item.label === 'Sequencer' ? 'Seq' : item.label === 'Mixer' ? 'Mix' : item.label === 'Arranger' ? 'Arrange' : item.label}
        </span>
      </div>
    </button>
  );

  return (
    <aside className="studio-rail w-full shrink-0 px-2 py-2 md:w-[88px] md:py-3" data-tour-target="views">
      <div className="section-label hidden md:block">Views</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <button
          className="studio-nav-button w-full"
          data-tour-target="sessions"
          data-ui-sound="nav"
          onClick={onOpenLaunchpad}
          title="Open session library"
          type="button"
        >
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Sparkles size={20} className="text-[var(--accent)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Library</span>
          </div>
        </button>
        <button
          className="studio-nav-button studio-nav-button-capture w-full"
          data-capture="true"
          data-tour-target="record"
          data-ui-sound="record"
          onClick={onOpenRecord}
          title="Record a vocal, sound, or note and match it to a lane"
          type="button"
        >
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Radio size={20} className="text-[var(--danger)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Capture</span>
          </div>
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:mt-0 md:hidden">
        <div className="grid grid-cols-3 gap-2">
          {navItems.slice(0, 3).map(renderViewButton)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {navItems.slice(3).map(renderViewButton)}
        </div>
      </div>

      <div className="hidden md:grid md:w-full md:gap-2">
        {navItems.map(renderViewButton)}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-soft)] pt-3 md:mt-auto md:grid-cols-1 md:gap-2">
        <button
          className="studio-nav-button w-full"
          data-tour-target="share"
          data-ui-sound="action"
          onClick={onOpenShare}
          title="Share this session"
          type="button"
        >
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Share2 size={20} className="text-[var(--accent)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Share</span>
          </div>
        </button>
        <button
          className="studio-nav-button w-full"
          data-active={isSettingsOpen}
          data-tour-target="options"
          data-ui-sound="settings"
          onClick={toggleSettings}
          title="Options"
          type="button"
        >
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Settings size={20} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Options</span>
          </div>
        </button>
        <a
          className="studio-nav-button flex w-full items-center justify-center"
          data-tour-target="support"
          data-ui-sound="action"
          href={SUPPORT_URL}
          rel="noreferrer noopener"
          target="_blank"
          title="Support SonicStudio on Buy Me a Coffee"
        >
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Coffee size={20} className="text-[var(--accent)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Support</span>
          </div>
        </a>
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
    <main className="relative flex min-h-[44vh] flex-col md:min-h-[38vh] md:min-w-0 md:flex-1 xl:min-h-[34vh]">
      {activeView === 'SEQUENCER' && <Sequencer />}
      {activeView === 'PIANO_ROLL' && <PianoRoll />}
      {activeView === 'MIXER' && <Mixer />}
      {activeView === 'ARRANGER' && <Arranger />}
    </main>
  );
};

const MobileTransportStrip = () => {
  const {
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    togglePlay,
    stop,
    toggleRecording,
  } = useAudio();

  const armAudio = () => {
    if (!isInitialized) {
      void initAudio();
    }
  };

  return (
    <div className="mobile-transport-strip md:hidden" role="group" aria-label="Transport controls">
      <button
        aria-label={isPlaying ? 'Pause playback' : 'Play'}
        className="control-chip mobile-transport-btn"
        data-active={isPlaying ? 'true' : 'false'}
        data-primary="true"
        onPointerDown={armAudio}
        onClick={() => void togglePlay()}
        type="button"
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        aria-label="Stop"
        className="control-chip mobile-transport-btn"
        onClick={stop}
        type="button"
      >
        <Square className="h-4 w-4 fill-current" />
        Stop
      </button>
      <button
        aria-label={isRecording ? 'Stop recording' : 'Record'}
        className="control-chip mobile-transport-btn"
        data-active={isRecording ? 'true' : 'false'}
        data-record="true"
        onPointerDown={armAudio}
        onClick={() => void toggleRecording()}
        type="button"
      >
        <Circle className="h-4 w-4 fill-current" />
        {isRecording ? 'Recording' : 'Record'}
      </button>
    </div>
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
    setSettingsOpen,
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
  const autoGuidePendingRef = useRef(!routeState.showGuide && shouldAutoOpenOnboarding());
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
    loadSessionTemplate(templateId);
    setActiveView('SEQUENCER');
    setLaunchpadOpen(false);
    setGuideOpen(autoGuidePendingRef.current);
    void initAudio();
  };

  const handleStartGuide = () => {
    loadSessionTemplate('night-transit');
    setActiveView('SEQUENCER');
    setLaunchpadOpen(false);
    setGuideOpen(true);
    void initAudio();
  };

  const handleImportMidi = () => {
    fileInputRef.current?.click();
  };
  const openCapture = useCallback(() => {
    setGuideOpen(false);
    setRecordOpen(true);
  }, []);

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const ok = await importMidiSession(file);
      if (ok) {
        setLaunchpadOpen(false);
        setGuideOpen(autoGuidePendingRef.current);
      }
    }
    event.target.value = '';
  };

  return (
    <div className="app-shell min-h-screen w-full antialiased text-[var(--text-primary)]">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <OnboardingGuide
        onComplete={() => {
          autoGuidePendingRef.current = false;
          markOnboardingCompleted();
          setGuideOpen(false);
        }}
        onSkip={() => {
          autoGuidePendingRef.current = false;
          markOnboardingSkipped();
          setGuideOpen(false);
        }}
        open={isGuideOpen && !isLaunchpadOpen && !isShareOpen && !isRecordOpen}
      />
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
        <div className="fixed inset-0 z-[60] overflow-auto bg-[var(--bg-app)] p-3">
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
      {isSettingsOpen ? (
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-[64] bg-[rgba(5,8,12,0.62)] backdrop-blur-[2px] md:hidden"
            onClick={() => setSettingsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="fixed inset-x-3 bottom-3 top-3 z-[65] md:static md:inset-auto md:z-auto md:flex md:min-h-0 md:w-[380px] md:max-w-[380px] md:flex-col">
            <SettingsSidebar requestedTab={routeState.requestedSettingsTab} />
          </div>
        </>
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-col">
        <div className="px-3 pt-3">
          <TopBar firstImpression={isFirstImpression} isCaptureOpen={isRecordOpen} onOpenCapture={openCapture} />
        </div>
        <MobileTransportStrip />
        <div className="studio-shell-grid flex min-w-0 flex-col gap-3 px-3 pb-3 md:min-h-0 md:flex-1 md:flex-row">
          <SideNav
            onOpenLaunchpad={() => setLaunchpadOpen(true)}
            onOpenRecord={openCapture}
            onOpenShare={() => {
              setGuideOpen(false);
              setShareOpen(true);
            }}
          />
          <div className="studio-workbench flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1">
            <div className="flex flex-col md:flex-row md:min-h-0 md:flex-1 gap-3">
              <ViewRouter />
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
