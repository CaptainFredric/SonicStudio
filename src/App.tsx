import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { MainWorkspace as Sequencer } from './components/MainWorkspace';
import { NotesPanel } from './components/NotesPanel';
import { DeviceRack } from './components/DeviceRack';
import { ArrangementPanel } from './components/ArrangementPanel';
import { TapToPlay } from './components/TapToPlay';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { SuperSonicAssistBar } from './components/SuperSonicAssistBar';
import { QuickCaptureBar } from './components/QuickCaptureBar';
import { useDialogFocus } from './hooks/useDialogFocus';
import { MidiKeyboardBridge } from './components/MidiKeyboardBridge';
import { setManualKeyOverride } from './services/manualKeyOverride';
import { AudioHealthDot } from './components/AudioHealthDot';
import { KeyTag } from './components/KeyTag';
import { MidiRecordTag } from './components/MidiRecordTag';
import { TransportElapsedTag } from './components/TransportElapsedTag';
import { TransportPositionTag } from './components/TransportPositionTag';
import { ToastStack, type ToastItem } from './components/ToastStack';
import { resolveStudioRoute, type StudioRouteState } from './app/routeController';
import { APP_VIEW_ORDER, type AppView, type SessionTemplateId } from './project/schema';
import { markOnboardingCompleted, markOnboardingSkipped, shouldAutoOpenOnboarding } from './services/onboardingState';
import { useMediaQuery } from './utils/useMediaQuery';
import { readString } from './utils/safeStorage';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { decodeSharePayload } from './utils/shareCodec';
import { TransportSpectrum } from './components/TransportSpectrum';
import { playSupersonicToggleSound } from './audio/uiSounds';
import { getSupersonicTransitionOrigin, runSupersonicTransition } from './utils/supersonicTransition';
import { AudioWaveform, Volume2, Settings, Sparkles, Share2, Coffee } from 'lucide-react';
import { Circle, Maximize2, Minimize2, Minus, Pause, Play, Plus, Square, Zap } from 'lucide-react';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';

// Everything a visitor does not need for the first paint loads on demand: the
// library overlay, the capture and transcribe dialogs, settings, sharing, the
// onboarding tour, and the Mixer view. This keeps the boot bundle to the
// sequencer path; each surface fetches its own chunk the first time it opens.
const Mixer = lazyWithRetry(() => import('./components/Mixer').then((module) => ({ default: module.Mixer })), 'mixer');
const Launchpad = lazyWithRetry(() => import('./components/Launchpad').then((module) => ({ default: module.Launchpad })), 'launchpad');
const SettingsSidebar = lazyWithRetry(() => import('./components/SettingsSidebar').then((module) => ({ default: module.SettingsSidebar })), 'settings');
const AudioCapture = lazyWithRetry(() => import('./components/AudioCapture').then((module) => ({ default: module.AudioCapture })), 'capture');
const SongTranscriber = lazyWithRetry(() => import('./components/SongTranscriber').then((module) => ({ default: module.SongTranscriber })), 'transcriber');
const ShareDialog = lazyWithRetry(() => import('./components/ShareDialog').then((module) => ({ default: module.ShareDialog })), 'share');
const OnboardingGuide = lazyWithRetry(() => import('./components/OnboardingGuide').then((module) => ({ default: module.OnboardingGuide })), 'guide');

const SideNav = ({ onOpenLaunchpad, onOpenShare, onOpenRecord, onOpenTranscribe, onToggleFocus }: { onOpenLaunchpad: () => void; onOpenShare: () => void; onOpenRecord: () => void; onOpenTranscribe: () => void; onToggleFocus: () => void }) => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();
  const withSuperFill = (icon: React.ReactNode, fillClass = 'studio-icon-fill-core') => (
    <span className="studio-icon-shell">
      {icon}
      <span className={`studio-icon-fill ${fillClass}`} />
    </span>
  );

  const navItems = [
    {
      id: 'SEQUENCER',
      icon: (
        <span className="studio-icon-shell">
          <svg aria-hidden="true" className="h-5 w-5 studio-seq-icon" viewBox="0 0 20 20">
            <circle className="studio-seq-head-fill" cx="5.25" cy="14.25" r="2.5" />
            <circle className="studio-seq-head-fill" cx="13.25" cy="12.25" r="2.5" />
            <path className="studio-seq-outline" d="M7.5 14.25V5.5L15.5 3.75V12.25" />
            <circle className="studio-seq-outline" cx="5.25" cy="14.25" r="2.5" />
            <circle className="studio-seq-outline" cx="13.25" cy="12.25" r="2.5" />
          </svg>
        </span>
      ),
      label: 'Sequencer',
      title: 'Sequencer · lay down the groove, step by step',
    },
    { id: 'MIXER', icon: withSuperFill(<Volume2 size={20} />, 'studio-icon-fill-mixer-core'), label: 'Mixer', title: 'Mixer · balance the levels, panning, and tone' },
  ];

  // Keep the rail in the one canonical order so the tabs and the Alt+1..3
  // shortcuts can never drift apart.
  const orderedNavItems = [...navItems].sort(
    (left, right) => APP_VIEW_ORDER.indexOf(left.id as AppView) - APP_VIEW_ORDER.indexOf(right.id as AppView),
  );

  const renderViewButton = (item: { icon: React.ReactNode; id: string; label: string; title: string }) => (
    <button
      key={item.id}
      aria-label={item.title}
      className="studio-nav-button w-full"
      data-active={activeView === item.id}
      data-ui-sound="nav"
      onClick={() => setActiveView(item.id as AppView)}
      title={item.title}
      type="button"
    >
      <div className="flex flex-col items-center gap-2">
        {item.icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.18em]">
          {item.label === 'Sequencer' ? 'Seq' : item.label === 'Mixer' ? 'Mix' : item.label}
        </span>
      </div>
    </button>
  );

  return (
    <aside className="studio-rail w-full shrink-0 px-2 py-2 md:w-[88px] md:py-3 md:min-h-0 md:overflow-y-auto" data-tour-target="views">
      <div className="section-label hidden md:block">Views</div>
      <div className="grid grid-cols-4 gap-1.5 md:mb-2 md:grid-cols-1 md:gap-2">
        <button
          className="studio-nav-button w-full"
          data-tour-target="sessions"
          data-ui-sound="nav"
          onClick={onOpenLaunchpad}
          title="Browse starter scenes and your saved sessions"
          type="button"
        >
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            {withSuperFill(<Sparkles size={20} className="text-[var(--accent)]" />, 'studio-icon-fill-spark-core')}
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
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            <span className="studio-icon-shell text-[var(--danger)]">
              <svg aria-hidden="true" className="h-5 w-5 studio-mic-icon" viewBox="0 0 20 20">
                <rect className="studio-mic-capsule-fill" height="10" rx="3" width="6" x="7" y="2.5" />
                <rect className="studio-mic-outline" height="10" rx="3" width="6" x="7" y="2.5" />
                <path className="studio-mic-outline" d="M5.5 8.5a4.5 4.5 0 0 0 9 0" />
                <line className="studio-mic-outline" x1="10" x2="10" y1="13.5" y2="16.8" />
                <line className="studio-mic-outline" x1="7.4" x2="12.6" y1="16.8" y2="16.8" />
              </svg>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Capture</span>
          </div>
        </button>
        <button
          className="studio-nav-button w-full"
          data-ui-sound="action"
          onClick={onOpenTranscribe}
          title="Transcribe a recording or song into editable notes"
          type="button"
        >
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            {withSuperFill(<AudioWaveform size={20} className="text-[var(--accent)]" />, 'studio-icon-fill-spark-core')}
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Transcribe</span>
          </div>
        </button>
        <button
          className="studio-nav-button w-full"
          data-active={isSettingsOpen}
          data-tour-target="options"
          data-ui-sound="settings"
          onClick={toggleSettings}
          title="Studio settings"
          type="button"
        >
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            <span className="studio-icon-shell studio-icon-shell-gear">
              <Settings size={20} />
              <span className="studio-icon-fill studio-icon-fill-gear-core" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Options</span>
          </div>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 md:mt-0 md:hidden">
        {orderedNavItems.map(renderViewButton)}
      </div>

      <div className="hidden md:grid md:w-full md:gap-2.5">
        {orderedNavItems.map(renderViewButton)}
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
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            {withSuperFill(<Share2 size={20} className="text-[var(--accent)]" />, 'studio-icon-fill-share-core')}
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Share</span>
          </div>
        </button>
        <button
          className="studio-nav-button w-full"
          data-ui-sound="settings"
          onClick={onToggleFocus}
          title="Focus mode · hide the panels, keep just your work"
          type="button"
        >
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            <span className="studio-icon-shell">
              <Maximize2 size={20} className="text-[var(--accent)]" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Focus</span>
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
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            {withSuperFill(<Coffee size={20} className="text-[var(--accent)]" />, 'studio-icon-fill-support-core')}
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Support</span>
          </div>
        </a>
      </div>
    </aside>
  );
};

const ViewRouter = () => {
  const { activeView } = useAudio();
  return (
    <main className="relative flex min-h-[44vh] flex-col md:min-h-0 md:min-w-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden">
      {/* Keyed on the view so switching SEQ <-> MIX replays a soft entrance
          instead of the new view popping in. */}
      <div key={activeView} className="view-swap-in flex min-h-0 flex-1 flex-col">
        {activeView === 'SEQUENCER' && <Sequencer />}
        {activeView === 'MIXER' && (
          <Suspense fallback={<div className="surface-panel flex flex-1 items-center justify-center text-sm text-[var(--text-secondary)]">Opening the mixer</div>}>
            <Mixer />
          </Suspense>
        )}
      </div>
    </main>
  );
};

// The always-visible transport bar. It keeps the core controls — play, stop,
// record, tempo, SuperSonic — within reach at every size while the heavier
// TopBar detail panel stays collapsed, so the editing surface gets the room it
// needs on phones, laptops, and large desktops alike.
const CompactTransportBar = () => {
  const {
    isPlaying,
    isRecording,
    togglePlay,
    stop,
    toggleRecording,
    bpm,
    setBpm,
    superSonicMode,
    setSuperSonicMode,
    uiSoundsEnabled,
    stickyMobileTransport,
  } = useAudio();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isFirstImpression = useFirstImpression();
  const playTogglePendingRef = useRef(false);
  const recordingTogglePendingRef = useRef(false);

  const handleTogglePlay = async () => {
    if (playTogglePendingRef.current) {
      return;
    }

    playTogglePendingRef.current = true;
    try {
      await togglePlay();
    } finally {
      playTogglePendingRef.current = false;
    }
  };

  const handleToggleRecording = async () => {
    if (recordingTogglePendingRef.current) {
      return;
    }

    recordingTogglePendingRef.current = true;
    try {
      await toggleRecording();
    } finally {
      recordingTogglePendingRef.current = false;
    }
  };

  const nudgeBpm = (delta: number) => {
    setBpm(Math.max(40, Math.min(220, Math.round(bpm + delta))));
  };

  const handleToggleSupersonic = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = !superSonicMode;
    if (uiSoundsEnabled) {
      playSupersonicToggleSound(next);
    }
    runSupersonicTransition(next, getSupersonicTransitionOrigin(event.currentTarget));
    setSuperSonicMode(next);
  };

  return (
    <div
      className="compact-transport-bar"
      data-sticky={stickyMobileTransport ? undefined : 'off'}
      role="group"
      aria-label="Transport controls"
    >
      <AudioHealthDot className="ml-1" />
      <TransportPositionTag />
      <TransportElapsedTag />
      <KeyTag />
      <MidiRecordTag />
      {isFirstImpression && !isPlaying && (
        <span
          aria-live="polite"
          className="rounded-full border border-[rgba(114,217,255,0.32)] bg-[rgba(114,217,255,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]"
          role="note"
        >
          Tap play
        </span>
      )}
      <div className="compact-transport-group">
        <button
          aria-label={isPlaying ? 'Pause playback' : 'Play'}
          className="control-chip compact-transport-btn"
          data-active={isPlaying ? 'true' : 'false'}
          data-primary="true"
          data-ui-sound="transport"
          onClick={() => void handleTogglePlay()}
          type="button"
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          aria-label="Stop"
          className="control-chip compact-transport-btn"
          data-ui-sound="transport"
          onClick={stop}
          type="button"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop
        </button>
        <button
          aria-label={isRecording ? 'Stop recording' : 'Record'}
          className="control-chip compact-transport-btn"
          data-active={isRecording ? 'true' : 'false'}
          data-record="true"
          data-ui-sound="record"
          onClick={() => void handleToggleRecording()}
          type="button"
        >
          <Circle className="h-4 w-4 fill-current" />
          {isRecording ? 'Rec' : 'Record'}
        </button>
      </div>
      <div
        className="overflow-hidden rounded-[3px] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-1.5"
        style={{ flex: '1 1 120px', minWidth: '96px', maxWidth: '720px' }}
      >
        <TransportSpectrum active={isPlaying} />
      </div>
      {/* Tempo stays off the phone bar to keep it light, but the SuperSonic
          toggle shows at every size so the mode is always one tap away. */}
      {!isMobile && (
        <div className="compact-transport-tempo" role="group" aria-label="Tempo">
          <button
            aria-label="Slower by one BPM"
            className="control-chip compact-tempo-step"
            data-ui-sound="tab"
            onClick={() => nudgeBpm(-1)}
            type="button"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            aria-label="Tempo in BPM"
            className="control-field compact-tempo-input"
            inputMode="numeric"
            max={220}
            min={40}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) {
                setBpm(Math.max(40, Math.min(220, Math.round(next))));
              }
            }}
            type="number"
            value={bpm}
          />
          <span className="compact-tempo-unit">BPM</span>
          <button
            aria-label="Faster by one BPM"
            className="control-chip compact-tempo-step"
            data-ui-sound="tab"
            onClick={() => nudgeBpm(1)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button
        aria-label={superSonicMode ? 'Turn off SuperSonic mode' : 'Turn on SuperSonic mode'}
        aria-pressed={superSonicMode}
        className="control-chip compact-transport-super"
        data-active={superSonicMode ? 'true' : 'false'}
        data-super="true"
        onClick={handleToggleSupersonic}
        title="SuperSonic mode keeps the common edits one tap away"
        type="button"
      >
        <Zap className="h-3.5 w-3.5" />
        <span className="compact-super-label">{superSonicMode ? 'SuperSonic on' : 'SuperSonic'}</span>
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

// Pull the encoded share payload out of the URL exactly once and clear the
// hash so reloads don't re-import. Decoding happens separately because gzip
// links decompress asynchronously.
const consumeShareHashOnce = (() => {
  let consumed = false;
  return (): string | null => {
    if (consumed) return null;
    if (typeof window === 'undefined') return null;
    const match = window.location.hash.match(/#share=([^&]+)/);
    if (!match) return null;
    consumed = true;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return match[1];
  };
})();

const readInitialRouteState = (): StudioRouteState => {
  if (typeof window === 'undefined') {
    return resolveStudioRoute('', false);
  }
  const hasPersistedSession = readString('sonicstudio:session:v1') !== null;
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
    requestDemoPlayback,
    setActiveView,
    setSettingsOpen,
  } = useAudio();
  const isFirstImpression = useFirstImpression();
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isSettingsOpen, settingsPanelRef);
  const launchpadRef = useRef<HTMLDivElement>(null);

  const [isLaunchpadOpen, setLaunchpadOpen] = useState<boolean>(() => {
    return routeState.showLaunchpad;
  });
  const [isGuideOpen, setGuideOpen] = useState<boolean>(() => routeState.showGuide);
  const [isShareOpen, setShareOpen] = useState(false);
  const [isRecordOpen, setRecordOpen] = useState(false);
  const [isTranscribeOpen, setTranscribeOpen] = useState(false);
  const [isQuickCaptureOpen, setQuickCaptureOpen] = useState(false);
  useDialogFocus(isLaunchpadOpen, launchpadRef, { trap: true });
  const [focusMode, setFocusMode] = useState(false);
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
    const encodedShare = consumeShareHashOnce();
    if (!encodedShare) return;
    let cancelled = false;
    const loadSharedSession = async () => {
      let shared: string;
      try {
        shared = await decodeSharePayload(encodedShare);
      } catch (error) {
        console.error('SonicStudio: failed to decode share link', error);
        return;
      }
      if (cancelled) return;
      setLaunchpadOpen(false);
      // Wrapped share payloads also carry the sender's manual key
      // override. Restore it so the receiver picks up the same pin
      // the sender saw. Older share links lacked the wrapper and
      // simply skip this branch.
      try {
        const parsed = JSON.parse(shared) as unknown;
        if (parsed && typeof parsed === 'object' && 'manualKeyOverride' in parsed) {
          const value = (parsed as { manualKeyOverride?: unknown }).manualKeyOverride;
          if (value && typeof value === 'object' && 'rootName' in (value as object) && 'mode' in (value as object)) {
            const candidate = value as { rootName: unknown; mode: unknown };
            if (typeof candidate.rootName === 'string' && (candidate.mode === 'major' || candidate.mode === 'minor')) {
              setManualKeyOverride({ rootName: candidate.rootName, mode: candidate.mode });
            } else {
              setManualKeyOverride(null);
            }
          } else {
            setManualKeyOverride(null);
          }
        }
      } catch {
        /* malformed wrapper — let importSession handle it */
      }
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
    // The guide auto-opens at most once. Picking another template later
    // should not keep reopening it.
    const willAutoOpenGuide = autoGuidePendingRef.current;
    autoGuidePendingRef.current = false;
    if (willAutoOpenGuide) {
      // Record that the guide has been shown so a reload mid-tour does not
      // surface it again. Completing it later upgrades the status.
      markOnboardingSkipped();
    }
    setGuideOpen(willAutoOpenGuide);
    void initAudio();
  };

  // Load a scene and start it playing in one go. Arms the autoplay flag before
  // the load so the project-sync effect kicks off playback once the engine has
  // the new scene. Distinct from picking a scene and then pressing Play.
  const handlePlayDemo = (templateId: SessionTemplateId) => {
    requestDemoPlayback();
    handleSelectTemplate(templateId);
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
  const openTranscribe = useCallback(() => {
    setGuideOpen(false);
    setLaunchpadOpen(false);
    setTranscribeOpen(true);
  }, []);

  // Allow distant components (e.g. the capture-shelf empty state in
  // Studio Settings) to open the song transcriber without prop-drilling
  // through MainWorkspace.
  useEffect(() => {
    const handler = () => openTranscribe();
    window.addEventListener('sonicstudio:open-transcriber', handler);
    return () => window.removeEventListener('sonicstudio:open-transcriber', handler);
  }, [openTranscribe]);

  // Alt+C in the keyboard layer dispatches this event so the quick
  // capture overlay opens from anywhere in the studio.
  useEffect(() => {
    const handler = () => setQuickCaptureOpen(true);
    window.addEventListener('sonicstudio:open-quick-capture', handler);
    return () => window.removeEventListener('sonicstudio:open-quick-capture', handler);
  }, []);

  // Focus mode hides the chrome so the workspace fills the screen; Esc leaves.
  useEffect(() => {
    if (!focusMode) {
      return undefined;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [focusMode]);

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const ok = await importMidiSession(file);
      if (ok) {
        setLaunchpadOpen(false);
        const willAutoOpenGuide = autoGuidePendingRef.current;
        autoGuidePendingRef.current = false;
        if (willAutoOpenGuide) {
          markOnboardingSkipped();
        }
        setGuideOpen(willAutoOpenGuide);
      }
    }
    event.target.value = '';
  };

  return (
    <div className="app-shell min-h-screen w-full antialiased text-[var(--text-primary)] md:flex md:flex-row md:h-screen md:min-h-0 md:overflow-hidden">
      <MidiKeyboardBridge />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {isGuideOpen && !isLaunchpadOpen && !isShareOpen && !isRecordOpen && !isTranscribeOpen && (
        <Suspense fallback={null}>
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
            open
          />
        </Suspense>
      )}
      <ShortcutOverlay />
      {isShareOpen && (
        <Suspense fallback={null}>
          <ShareDialog open onClose={() => setShareOpen(false)} onNotify={pushToast} />
        </Suspense>
      )}
      {isRecordOpen && (
        <Suspense fallback={null}>
          <AudioCapture open onClose={() => setRecordOpen(false)} />
        </Suspense>
      )}
      {isTranscribeOpen && (
        <Suspense fallback={null}>
          <SongTranscriber open onClose={() => setTranscribeOpen(false)} onNotify={pushToast} />
        </Suspense>
      )}
      <QuickCaptureBar open={isQuickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} onNotify={pushToast} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        onChange={handleFileChosen}
        style={{ display: 'none' }}
        aria-hidden
      />
      {isLaunchpadOpen ? (
        <div ref={launchpadRef} className="fixed inset-0 z-[60] overflow-auto bg-[var(--bg-app)] p-3">
          <Suspense fallback={null}>
            <Launchpad
              isInitialized={isInitialized}
              isOpen={isLaunchpadOpen}
              onClose={() => setLaunchpadOpen(false)}
              onImportMidi={handleImportMidi}
              onPlayDemo={handlePlayDemo}
              onSelectTemplate={handleSelectTemplate}
              onStartGuide={handleStartGuide}
              onTranscribeSong={openTranscribe}
              onWakeAudio={() => void initAudio()}
            />
          </Suspense>
        </div>
      ) : null}
      {isSettingsOpen ? (
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-[64] bg-[rgba(4,7,11,0.72)] backdrop-blur-[2px] md:hidden"
            onClick={() => setSettingsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div ref={settingsPanelRef} className="fixed inset-x-3 bottom-3 top-3 z-[65] md:static md:inset-auto md:z-auto md:flex md:min-h-0 md:w-[380px] md:max-w-[380px] md:flex-col">
            <Suspense fallback={null}>
              <SettingsSidebar requestedTab={routeState.requestedSettingsTab} />
            </Suspense>
          </div>
        </>
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-col md:h-full md:min-h-0 md:flex-1 md:overflow-hidden">
        {!focusMode && (
          <div className="px-3 pt-3">
            <TopBar
              firstImpression={isFirstImpression}
              isCaptureOpen={isRecordOpen}
              onOpenCapture={openCapture}
              onOpenLibrary={() => setLaunchpadOpen(true)}
              onOpenShare={() => setShareOpen(true)}
            />
          </div>
        )}
        <CompactTransportBar />
        <div className="studio-shell-grid flex min-w-0 flex-col gap-2 px-3 pb-3 md:min-h-0 md:flex-1 md:flex-row md:gap-3">
          {!focusMode && (
            <SideNav
              onOpenLaunchpad={() => setLaunchpadOpen(true)}
              onOpenRecord={openCapture}
              onOpenTranscribe={openTranscribe}
              onToggleFocus={() => setFocusMode(true)}
              onOpenShare={() => {
                setGuideOpen(false);
                setShareOpen(true);
              }}
            />
          )}
          <div className="studio-workbench flex min-w-0 flex-col gap-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:gap-3">
            <div className="flex flex-col gap-3 md:min-h-[300px] md:flex-row md:flex-1">
              <ViewRouter />
            </div>
            <DeviceRack />
            <NotesPanel />
            <ArrangementPanel />
          </div>
        </div>
        {!focusMode && (
          <div className="shrink-0 flex flex-col gap-3 px-3 pb-3">
            <SuperSonicAssistBar />
            <TapToPlay />
          </div>
        )}
      </div>
      {focusMode && (
        <button
          aria-label="Exit focus mode"
          className="control-chip fixed right-3 top-3 z-[70] flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-lg max-md:top-auto max-md:bottom-5"
          data-ui-sound="nav"
          onClick={() => setFocusMode(false)}
          title="Exit focus mode (Esc)"
          type="button"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Exit focus
        </button>
      )}
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
