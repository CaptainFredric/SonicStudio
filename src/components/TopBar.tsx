import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Compass,
  Layers3,
  Mic,
  Pause,
  Play,
  Redo2,
  Save,
  SlidersHorizontal,
  Square,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';

import { useMediaQuery } from '../utils/useMediaQuery';

import { engine } from '../audio/ToneEngine';
import { playSupersonicToggleSound } from '../audio/uiSounds';
import { AudioHealthDot } from './AudioHealthDot';
import { KeyTag } from './KeyTag';
import { TransportElapsedTag } from './TransportElapsedTag';
import { useAudio } from '../context/AudioContext';
import {
  MASTER_PRESET_DEFINITIONS,
  MAX_STEPS_PER_PATTERN,
  MIN_STEPS_PER_PATTERN,
  type MasterSettings,
} from '../project/schema';
import { getSupersonicTransitionOrigin, runSupersonicTransition } from '../utils/supersonicTransition';
import { BrandMark } from './BrandMark';

const MASTER_MATCH_EPSILON = 0.015;
const SUPERSONIC_WIPE_DURATION_MS = 240;
const SUPERSONIC_OFF_PREVIEW_DELAY_MS = Math.round(SUPERSONIC_WIPE_DURATION_MS * 0.52);
const MIN_TEMPO_BPM = 40;
const MAX_TEMPO_BPM = 240;
const TAP_TEMPO_MAX_INTERVAL_MS = 2500;
const TAP_TEMPO_MIN_TAPS = 3;

interface AudioHealthSummary {
  detail: string;
  label: string;
  tone: 'attention' | 'error' | 'ready';
}

interface AudioNerdStat {
  label: string;
  tone: 'attention' | 'error' | 'ready';
  value: string;
}

const isMasterPresetMatch = (current: MasterSettings, target: MasterSettings) => (
  Math.abs(current.glueCompression - target.glueCompression) <= MASTER_MATCH_EPSILON
  && Math.abs(current.highCutHz - target.highCutHz) <= 120
  && Math.abs(current.tone - target.tone) <= MASTER_MATCH_EPSILON
  && Math.abs(current.lowCutHz - target.lowCutHz) <= 4
  && Math.abs(current.outputGain - target.outputGain) <= 0.11
  && Math.abs(current.stereoWidth - target.stereoWidth) <= MASTER_MATCH_EPSILON
  && Math.abs(current.limiterCeiling - target.limiterCeiling) <= 0.06
);

export const TopBar = ({
  firstImpression = false,
  isCaptureOpen = false,
  onOpenCapture,
}: {
  firstImpression?: boolean;
  isCaptureOpen?: boolean;
  onOpenCapture?: () => void;
}) => {
  const {
    activeView,
    bpm,
    canRedo,
    canUndo,
    countInActive,
    countInBars,
    countInBeatsRemaining,
    clearAllTrackNotes,
    currentPattern,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    isSettingsOpen,
    lastSavedAt,
    loopRangeEndBeat,
    loopRangeStartBeat,
    master,
    metronomeEnabled,
    patternCount,
    projectName,
    redo,
    renameProject,
    saveProject,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    setActiveView,
    setBpm,
    setCountInBars,
    setCurrentPattern,
    setLoopRange,
    setSettingsOpen,
    setStepsPerPattern,
    setSuperSonicMode,
    setMetronomeEnabled,
    setTransportMode,
    songLengthInBeats,
    stepsPerPattern,
    stop,
    superSonicMode,
    togglePlay,
    toggleRecording,
    transportMode,
    tracks,
    uiSoundsEnabled,
    undo,
  } = useAudio();
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [isSupersonicHovered, setIsSupersonicHovered] = useState(false);
  const [isRestartArmed, setIsRestartArmed] = useState(false);
  const [isRestartDisarming, setIsRestartDisarming] = useState(false);
  const [showSupersonicOffPreview, setShowSupersonicOffPreview] = useState(false);
  const [showAudioNerdStats, setShowAudioNerdStats] = useState(false);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);
  const [tapTempoLabel, setTapTempoLabel] = useState<string | null>(null);
  // On anything short of a roomy desktop the header collapses to a compact bar
  // so the work surface stays dominant on laptops and split-screen windows.
  // The transport itself lives in the always-visible CompactTransportBar, so
  // collapsing never hides it. Only a wide AND tall viewport keeps the full
  // header expanded by default.
  const isCompactHeader = useMediaQuery('(max-width: 1279px), (max-height: 899px)');
  const headerSectionVisible = !isCompactHeader || mobileHeaderExpanded;
  const [audioRuntime, setAudioRuntime] = useState<{
    baseLatencyMs: number | null;
    contextState: AudioContextState;
    masterDb: number;
  }>({
    baseLatencyMs: null,
    contextState: 'suspended',
    masterDb: -100,
  });
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const tapTempoHistoryRef = useRef<number[]>([]);
  const tapTempoLabelTimeoutRef = useRef<number | null>(null);
  const activeMasterPreset = MASTER_PRESET_DEFINITIONS.find((preset) => (
    isMasterPresetMatch(master, preset.settings)
  )) ?? null;

  useEffect(() => {
    setDraftProjectName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (!superSonicMode || !isSupersonicHovered) {
      setShowSupersonicOffPreview(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSupersonicOffPreview(true);
    }, SUPERSONIC_OFF_PREVIEW_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSupersonicHovered, superSonicMode]);

  useEffect(() => {
    if (!isRestartArmed) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsRestartArmed(false);
      setIsRestartDisarming(true);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isRestartArmed]);

  useEffect(() => {
    if (!isRestartDisarming) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsRestartDisarming(false);
    }, 240);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isRestartDisarming]);

  useEffect(() => () => {
    if (tapTempoLabelTimeoutRef.current !== null) {
      window.clearTimeout(tapTempoLabelTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      setAudioRuntime({
        baseLatencyMs: null,
        contextState: 'suspended',
        masterDb: -100,
      });
      return undefined;
    }

    const updateAudioRuntime = () => {
      const baseLatencySeconds = engine.getBaseLatencySeconds();
      setAudioRuntime({
        baseLatencyMs: baseLatencySeconds === null ? null : baseLatencySeconds * 1000,
        contextState: engine.getAudioContextState(),
        masterDb: engine.getMasterMeterValue(),
      });
    };

    updateAudioRuntime();
    const intervalId = window.setInterval(updateAudioRuntime, 700);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isInitialized]);

  const commitProjectName = () => {
    renameProject(draftProjectName);
  };

  const compactStart = firstImpression && !isPlaying;
  const isFirstImpression = compactStart;
  const showPlayPulse = !isPlaying && !countInActive;
  const brandName = superSonicMode ? 'SuperSonicStudio' : 'SonicStudio';
  const brandTagline = superSonicMode
    ? 'Sharper lanes, faster edits, same session.'
    : 'Sketch, arrange, and mix in one place.';
  const focusTitle = isFirstImpression
    ? projectName
    : selectedTrack
      ? `${selectedTrack.name} · ${selectedTrack.type}${selectedArrangerClipId ? ' · clip' : ''}`
      : 'Workspace';
  const focusMeta = isFirstImpression
    ? 'Song view'
    : selectedTrack
      ? `${selectedTrack.source.engine === 'sample' ? 'Sample lane' : 'Synth lane'} · Pattern ${String.fromCharCode(65 + currentPattern)}${selectedArrangerClipId ? ' · selected clip' : ''} · ${transportMode === 'SONG' ? 'Song' : 'Pattern'} playback${superSonicMode ? ' · SuperSonic tools on' : ''}`
      : 'Switch between song view, notes, mix, and sound design without leaving the session.';
  const loopSummary = loopRangeStartBeat !== null && loopRangeEndBeat !== null
    ? `Loop ${loopRangeStartBeat + 1} to ${loopRangeEndBeat}`
    : transportMode === 'SONG'
      ? 'Song timeline'
      : 'Pattern loop';
  const supersonicLabel = !superSonicMode
    ? 'SuperSonic'
    : showSupersonicOffPreview
      ? 'SuperSonic off'
      : 'SuperSonic on';
  const soloTrackCount = tracks.filter((track) => track.solo).length;
  const activeTrackCount = tracks.filter((track) => !track.muted && (soloTrackCount === 0 || track.solo)).length;
  const allTracksMuted = tracks.length > 0 && activeTrackCount === 0;
  const masterMuted = master.outputGain <= -45;
  const likelyDeviceMuted = isInitialized
    && isPlaying
    && !masterMuted
    && !allTracksMuted
    && Number.isFinite(audioRuntime.masterDb)
    && audioRuntime.masterDb <= -95;
  const isLoopWindowActive = loopRangeStartBeat !== null && loopRangeEndBeat !== null;
  const audioHealth = getAudioHealthSummary({
    activeTrackCount,
    allTracksMuted,
    audioContextState: audioRuntime.contextState,
    baseLatencyMs: audioRuntime.baseLatencyMs,
    isInitialized,
    isPlaying,
    likelyDeviceMuted,
    masterDb: audioRuntime.masterDb,
    masterMuted,
  });
  const audioNerdStats: AudioNerdStat[] = [
    {
      label: 'Context',
      tone: audioRuntime.contextState === 'running' ? 'ready' : 'error',
      value: audioRuntime.contextState,
    },
    {
      label: 'Base latency',
      tone: audioRuntime.baseLatencyMs !== null && audioRuntime.baseLatencyMs >= 120 ? 'attention' : 'ready',
      value: audioRuntime.baseLatencyMs === null ? 'Unknown' : `${Math.round(audioRuntime.baseLatencyMs)} ms`,
    },
    {
      label: 'Master level',
      tone: isPlaying && audioRuntime.masterDb > -1.2 ? 'attention' : 'ready',
      value: Number.isFinite(audioRuntime.masterDb) ? `${audioRuntime.masterDb.toFixed(1)} dB` : 'Unknown',
    },
    {
      label: 'Active lanes',
      tone: allTracksMuted ? 'attention' : 'ready',
      value: `${activeTrackCount}/${tracks.length}`,
    },
    {
      label: 'Loop window',
      tone: isLoopWindowActive ? 'attention' : 'ready',
      value: isLoopWindowActive ? `${loopRangeStartBeat + 1} to ${loopRangeEndBeat}` : 'Off',
    },
    {
      label: 'Pattern length',
      tone: 'ready',
      value: `${stepsPerPattern} steps`,
    },
  ];

  const applyPatternLength = (nextStepsPerPattern: number) => {
    const clamped = Math.max(MIN_STEPS_PER_PATTERN, Math.min(MAX_STEPS_PER_PATTERN, nextStepsPerPattern));
    if (clamped === stepsPerPattern) {
      return;
    }

    setStepsPerPattern(clamped);
    setTransportMode('PATTERN');
    if (isLoopWindowActive) {
      setLoopRange(null, null);
    }
  };

  const toggleSupersonicMode = (button: HTMLButtonElement) => {
    const enabled = !superSonicMode;
    setIsSupersonicHovered(false);
    setShowSupersonicOffPreview(false);
    if (uiSoundsEnabled) {
      playSupersonicToggleSound(enabled);
    }
    runSupersonicTransition(enabled, getSupersonicTransitionOrigin(button));
    setSuperSonicMode(enabled);
  };

  const pushTapTempoLabel = (label: string) => {
    setTapTempoLabel(label);
    if (tapTempoLabelTimeoutRef.current !== null) {
      window.clearTimeout(tapTempoLabelTimeoutRef.current);
    }
    tapTempoLabelTimeoutRef.current = window.setTimeout(() => {
      setTapTempoLabel(null);
      tapTempoLabelTimeoutRef.current = null;
    }, 1500);
  };

  const clampTempo = (nextBpm: number) => Math.max(MIN_TEMPO_BPM, Math.min(MAX_TEMPO_BPM, Math.round(nextBpm)));

  const setTempoValue = (nextBpm: number) => {
    const clamped = clampTempo(nextBpm);
    if (clamped === bpm) {
      return;
    }
    setBpm(clamped);
  };

  const nudgeTempo = (delta: number) => {
    setTempoValue(bpm + delta);
  };

  const applyTempoMultiplier = (multiplier: number) => {
    setTempoValue(bpm * multiplier);
  };

  const tapTempo = () => {
    const now = Date.now();
    const recent = tapTempoHistoryRef.current.filter((timestamp) => now - timestamp <= TAP_TEMPO_MAX_INTERVAL_MS);
    recent.push(now);
    tapTempoHistoryRef.current = recent.slice(-6);

    if (tapTempoHistoryRef.current.length < TAP_TEMPO_MIN_TAPS) {
      const remaining = TAP_TEMPO_MIN_TAPS - tapTempoHistoryRef.current.length;
      pushTapTempoLabel(remaining > 0 ? `Tap ${remaining} more` : 'Tap again');
      return;
    }

    const intervals = [] as number[];
    for (let index = 1; index < tapTempoHistoryRef.current.length; index += 1) {
      intervals.push(tapTempoHistoryRef.current[index] - tapTempoHistoryRef.current[index - 1]);
    }

    const averageIntervalMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    if (!Number.isFinite(averageIntervalMs) || averageIntervalMs <= 0) {
      pushTapTempoLabel('Tap again');
      return;
    }

    const detectedBpm = clampTempo(60000 / averageIntervalMs);
    setBpm(detectedBpm);
    pushTapTempoLabel(`${detectedBpm} BPM`);
  };

  const handleRestartSession = () => {
    if (isRestartArmed) {
      setIsRestartArmed(false);
      setIsRestartDisarming(false);
      stop();
      clearAllTrackNotes();
      return;
    }

    setIsRestartDisarming(false);
    setIsRestartArmed(true);
  };

  return (
    <header className="surface-panel px-3 py-3 sm:px-5 sm:py-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(296px,352px)] md:items-start" data-first-impression={isFirstImpression}>
        <div className="grid min-w-0 content-start gap-4">
          <div className={`flex min-w-0 items-center gap-3 ${headerSectionVisible ? 'border-b border-[var(--border-soft)] pb-3' : ''}`}>
            <div className="surface-panel-strong flex h-11 w-11 items-center justify-center" style={{ borderRadius: '4px' }}>
              <BrandMark
                className={superSonicMode ? 'h-5 w-5 text-[rgb(176,31,55)]' : 'h-5 w-5 text-[var(--accent)]'}
                speed={isPlaying ? 1.4 : 1}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">{brandName}</h1>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{brandTagline}</p>
            </div>
            {isCompactHeader && (
              <button
                aria-expanded={mobileHeaderExpanded}
                aria-label={mobileHeaderExpanded ? 'Collapse studio details' : 'Expand studio details'}
                className="ghost-icon-button flex h-9 shrink-0 items-center justify-center gap-1.5 px-2.5"
                data-ui-sound="tab"
                onClick={() => setMobileHeaderExpanded((current) => !current)}
                title={mobileHeaderExpanded ? 'Collapse studio details' : 'Project, tempo, and session tools'}
                type="button"
              >
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline">
                  {mobileHeaderExpanded ? 'Less' : 'Details'}
                </span>
                {mobileHeaderExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          <div className={`${headerSectionVisible ? 'grid' : 'hidden'} min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start`}>
            <label className="grid gap-2 self-start">
              <span className="section-label">Project</span>
              <input
                aria-label="Project name"
                className="control-field h-11 w-full px-4 text-sm font-medium tracking-tight"
                onBlur={commitProjectName}
                onChange={(event) => setDraftProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitProjectName();
                    event.currentTarget.blur();
                  }

                  if (event.key === 'Escape') {
                    setDraftProjectName(projectName);
                    event.currentTarget.blur();
                  }
                }}
                value={draftProjectName}
              />
            </label>

            {!isFirstImpression && (
              <div className="grid gap-2 self-start">
                <div className="section-label">Pattern bank</div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: patternCount }, (_, patternIndex) => (
                    <React.Fragment key={patternIndex}>
                      <PatternButton
                        active={currentPattern === patternIndex}
                        onClick={() => setCurrentPattern(patternIndex)}
                      >
                        {String.fromCharCode(65 + patternIndex)}
                      </PatternButton>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`${headerSectionVisible ? 'grid' : 'hidden'} gap-3 border-t border-[var(--border-soft)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-label">Current focus</span>
                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{focusTitle}</span>
              </div>
              {!isFirstImpression && (
                <>
                  <div className="mt-3 hidden flex-wrap gap-x-5 gap-y-2 xl:flex">
                    <MiniStat label="Track" value={selectedTrack ? selectedTrack.name : 'None'} />
                    <MiniStat label="Pattern" value={String.fromCharCode(65 + currentPattern)} />
                    <MiniStat label="Clip" value={selectedArrangerClipId ? 'Selected' : 'None'} />
                    <MiniStat label="Profile" value={activeMasterPreset ? activeMasterPreset.label : 'Custom'} />
                    <MiniStat label="Master" value={`${master.outputGain.toFixed(1)} dB`} />
                  </div>
                  <div className="mt-2 hidden text-[11px] leading-5 text-[var(--text-secondary)] xl:block">{focusMeta}</div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-4 border-t border-[var(--border-soft)] pt-3 xl:border-t-0 xl:pt-0 xl:justify-end">
              <WorkflowButton
                active={activeView === 'SEQUENCER'}
                icon={<Compass className="h-3.5 w-3.5" />}
                label="Grid"
                onClick={() => setActiveView('SEQUENCER')}
              />
              <WorkflowButton
                active={activeView === 'PIANO_ROLL'}
                icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                label="Notes"
                onClick={() => setActiveView('PIANO_ROLL')}
              />
              <WorkflowButton
                active={activeView === 'ARRANGER'}
                icon={<Layers3 className="h-3.5 w-3.5" />}
                label="Song"
                onClick={() => setActiveView('ARRANGER')}
              />
            </div>
          </div>
        </div>

        <div className={`${headerSectionVisible ? 'grid' : 'hidden'} gap-3 border-t border-[var(--border-soft)] pt-3 md:self-stretch md:border-l md:border-t-0 md:pl-4 md:pt-0`}>
          <div className="grid gap-3 border-b border-[var(--border-soft)]/70 pb-3">
            <div className="hidden md:grid md:justify-items-stretch xl:justify-items-end">
              <div className="grid w-full max-w-none gap-2 xl:max-w-[372px]">
                <div
                  className="grid grid-cols-4 gap-2"
                  style={{
                    opacity: compactStart ? 0.42 : 1,
                    transition: 'opacity 230ms cubic-bezier(0.22,1,0.36,1)',
                  }}
                >
                  <UtilityBtn label="Save" onClick={saveProject} shortcut="⌘S">
                    <Save className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn disabled={!canUndo} label="Undo" onClick={undo} shortcut="⌘Z">
                    <Undo2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn disabled={!canRedo} label="Redo" onClick={redo} shortcut="⇧⌘Z">
                    <Redo2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn
                    armed={isRestartArmed}
                    armedLabel="Confirm"
                    disarming={isRestartDisarming}
                    label="Restart"
                    onClick={handleRestartSession}
                    shortcut="Double click"
                    uiSound="danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                </div>

                {/* Below a roomy desktop the CompactTransportBar owns the
                    transport, so the header skips it to avoid two play rows. */}
                {!isCompactHeader && (
                  <>
                  <div className="flex items-center justify-between gap-2 px-1 pb-1 text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    <span>Transport</span>
                    <span className="flex items-center gap-2">
                      <TransportElapsedTag />
                      <KeyTag />
                      <AudioHealthDot />
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <TransportBtn
                      active={isPlaying}
                      className="w-full min-w-0 justify-center"
                      data-tour-target="play"
                      emphasize={showPlayPulse}
                      label={isPlaying ? 'Pause' : 'Play'}
                      onClick={togglePlay}
                      onPointerDown={() => {
                        if (!isInitialized) {
                          void initAudio();
                        }
                      }}
                      shortcut="Space"
                      supersonicMode={superSonicMode}
                      tone="play"
                    >
                      {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                    </TransportBtn>
                    <TransportBtn className="w-full min-w-0 justify-center" label="Stop" onClick={stop} tone="neutral">
                      <Square className="h-4 w-4 fill-current" />
                    </TransportBtn>
                    <TransportBtn
                      active={isRecording}
                      className="w-full min-w-0 justify-center"
                      label={isRecording ? 'Armed' : 'Record'}
                      onClick={toggleRecording}
                      onPointerDown={() => {
                        if (!isInitialized) {
                          void initAudio();
                        }
                      }}
                      style={{
                        opacity: compactStart ? 0.42 : 1,
                        transition: 'opacity 230ms cubic-bezier(0.22,1,0.36,1)',
                      }}
                      tone="record"
                    >
                      <Circle className="h-4 w-4 fill-current" />
                    </TransportBtn>
                  </div>
                  {compactStart && (
                    <div
                      className="px-1 pt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--accent-strong)] opacity-90"
                      aria-live="polite"
                      role="note"
                    >
                      Tap play to hear it
                    </div>
                  )}
                  </>
                )}

                <div className="grid gap-2">
                  {onOpenCapture && (
                    <button
                      className="control-chip capture-action flex h-9 w-full items-center justify-center gap-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      data-active={isCaptureOpen ? 'true' : 'false'}
                      data-capture="true"
                      data-tour-target="record"
                      data-ui-sound="record"
                      onClick={onOpenCapture}
                      type="button"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      {isCaptureOpen ? 'Capture open' : 'Capture sound'}
                    </button>
                  )}
                  <button
                    className="control-chip supersonic-toggle flex h-9 w-full items-center justify-center gap-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={superSonicMode}
                    data-preview={showSupersonicOffPreview ? 'off' : 'on'}
                    data-super="true"
                    data-tour-target="supersonic"
                    onClick={(event) => toggleSupersonicMode(event.currentTarget)}
                    onPointerEnter={() => setIsSupersonicHovered(true)}
                    onPointerLeave={() => {
                      setIsSupersonicHovered(false);
                      setShowSupersonicOffPreview(false);
                    }}
                    type="button"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{supersonicLabel}</span>
                  </button>
                </div>

                <div className="surface-panel-muted grid gap-2 p-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="section-label">Tempo dock</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label="Tempo BPM"
                        className="control-field h-8 w-20 px-2 text-center font-mono text-[11px]"
                        max={MAX_TEMPO_BPM}
                        min={MIN_TEMPO_BPM}
                        onChange={(event) => setTempoValue(Number(event.target.value))}
                        step={1}
                        type="number"
                        value={bpm}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">BPM</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-ui-sound="tab"
                      onClick={() => nudgeTempo(-5)}
                      type="button"
                    >
                      -5
                    </button>
                    <button
                      className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-ui-sound="tab"
                      onClick={() => nudgeTempo(-1)}
                      type="button"
                    >
                      -1
                    </button>
                    <button
                      className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-ui-sound="tab"
                      onClick={() => nudgeTempo(1)}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-ui-sound="tab"
                      onClick={() => nudgeTempo(5)}
                      type="button"
                    >
                      +5
                    </button>
                    {superSonicMode ? (
                      <>
                        <button
                          className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          data-ui-sound="tab"
                          onClick={() => applyTempoMultiplier(0.5)}
                          type="button"
                        >
                          Half-time
                        </button>
                        <button
                          className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          data-ui-sound="tab"
                          onClick={() => applyTempoMultiplier(2)}
                          type="button"
                        >
                          Double-time
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          data-ui-sound="tab"
                          onClick={tapTempo}
                          type="button"
                        >
                          Tap tempo
                        </button>
                        <button
                          className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          data-ui-sound="tab"
                          onClick={() => setTempoValue(120)}
                          type="button"
                        >
                          Reset 120
                        </button>
                      </>
                    )}
                  </div>
                  <input
                    aria-label="Tempo quick slider"
                    className="w-full accent-[var(--accent)]"
                    max={MAX_TEMPO_BPM}
                    min={MIN_TEMPO_BPM}
                    onChange={(event) => setTempoValue(Number(event.target.value))}
                    step={1}
                    type="range"
                    value={bpm}
                  />
                  {tapTempoLabel ? (
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                      {tapTempoLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {showSessionDetail && (
            <div className="grid gap-2 md:hidden">
              <div
                className="surface-panel-muted flex items-center justify-between gap-1 p-1"
                style={{
                  opacity: compactStart ? 0.42 : 1,
                  transition: 'opacity 230ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <div className="flex items-center gap-1">
                  <UtilityBtn label="Save" onClick={saveProject} shortcut="⌘S">
                    <Save className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn disabled={!canUndo} label="Undo" onClick={undo} shortcut="⌘Z">
                    <Undo2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn disabled={!canRedo} label="Redo" onClick={redo} shortcut="⇧⌘Z">
                    <Redo2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                  <UtilityBtn
                    armed={isRestartArmed}
                    armedLabel="Confirm"
                    disarming={isRestartDisarming}
                    label="Restart"
                    onClick={handleRestartSession}
                    shortcut="Double click"
                    uiSound="danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </UtilityBtn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {onOpenCapture && (
                  <button
                    className="control-chip capture-action flex h-9 items-center gap-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={isCaptureOpen ? 'true' : 'false'}
                    data-capture="true"
                    data-tour-target="record"
                    data-ui-sound="record"
                    onClick={onOpenCapture}
                    type="button"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    {isCaptureOpen ? 'Capture open' : 'Capture sound'}
                  </button>
                )}
                <button
                  className="control-chip supersonic-toggle flex h-9 items-center gap-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active={superSonicMode}
                  data-preview={showSupersonicOffPreview ? 'off' : 'on'}
                  data-super="true"
                  data-tour-target="supersonic"
                  onClick={(event) => toggleSupersonicMode(event.currentTarget)}
                  onPointerEnter={() => setIsSupersonicHovered(true)}
                  onPointerLeave={() => {
                    setIsSupersonicHovered(false);
                    setShowSupersonicOffPreview(false);
                  }}
                  type="button"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{supersonicLabel}</span>
                </button>
              </div>

              <div className="surface-panel-muted grid gap-2 p-2">
                <div className="flex flex-wrap items-end gap-3">
                  <span className="section-label">Tempo dock</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      aria-label="Tempo BPM"
                      className="control-field h-8 w-20 px-2 text-center font-mono text-[11px]"
                      max={MAX_TEMPO_BPM}
                      min={MIN_TEMPO_BPM}
                      onChange={(event) => setTempoValue(Number(event.target.value))}
                      step={1}
                      type="number"
                      value={bpm}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">BPM</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    data-ui-sound="tab"
                    onClick={() => nudgeTempo(-5)}
                    type="button"
                  >
                    -5
                  </button>
                  <button
                    className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    data-ui-sound="tab"
                    onClick={() => nudgeTempo(-1)}
                    type="button"
                  >
                    -1
                  </button>
                  <button
                    className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    data-ui-sound="tab"
                    onClick={() => nudgeTempo(1)}
                    type="button"
                  >
                    +1
                  </button>
                  <button
                    className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    data-ui-sound="tab"
                    onClick={() => nudgeTempo(5)}
                    type="button"
                  >
                    +5
                  </button>
                  {superSonicMode ? (
                    <>
                      <button
                        className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        data-ui-sound="tab"
                        onClick={() => applyTempoMultiplier(0.5)}
                        type="button"
                      >
                        Half-time
                      </button>
                      <button
                        className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        data-ui-sound="tab"
                        onClick={() => applyTempoMultiplier(2)}
                        type="button"
                      >
                        Double-time
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        data-ui-sound="tab"
                        onClick={tapTempo}
                        type="button"
                      >
                        Tap tempo
                      </button>
                      <button
                        className="control-chip inline-flex h-8 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        data-ui-sound="tab"
                        onClick={() => setTempoValue(120)}
                        type="button"
                      >
                        Reset 120
                      </button>
                    </>
                  )}
                </div>
                <input
                  aria-label="Tempo quick slider"
                  className="w-full accent-[var(--accent)]"
                  max={MAX_TEMPO_BPM}
                  min={MIN_TEMPO_BPM}
                  onChange={(event) => setTempoValue(Number(event.target.value))}
                  step={1}
                  type="range"
                  value={bpm}
                />
                {tapTempoLabel ? (
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                    {tapTempoLabel}
                  </div>
                ) : null}
              </div>
            </div>
            )}
          </div>

          {!compactStart && (
            <button
              aria-expanded={showSessionDetail}
              className="control-chip flex h-8 w-full items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="tab"
              onClick={() => setShowSessionDetail((current) => !current)}
              type="button"
            >
              {showSessionDetail ? 'Hide session controls' : 'Session controls'}
            </button>
          )}

          {!compactStart && showSessionDetail && (
            <div className="grid gap-3 border-t border-[var(--border-soft)] pt-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <ModeButton
                  active={transportMode === 'PATTERN'}
                  label="Pattern"
                  onClick={() => setTransportMode('PATTERN')}
                />
                <ModeButton
                  active={transportMode === 'SONG'}
                  label="Song"
                  onClick={() => setTransportMode('SONG')}
                />
                <ModeButton
                  active={metronomeEnabled}
                  label={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
                  onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                />
              </div>
              <label className="grid gap-2 text-xs text-[var(--text-secondary)]">
                <span className="section-label">Count in</span>
                <select
                  className="control-field h-10 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onChange={(event) => setCountInBars(Number(event.target.value))}
                  value={countInBars}
                >
                  <option value={0}>No count</option>
                  <option value={1}>1 bar</option>
                  <option value={2}>2 bars</option>
                </select>
              </label>
            </div>
          )}

          {!compactStart && showSessionDetail && (
          <div className="grid gap-3 border-t border-[var(--border-soft)] pt-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <div className="section-label mb-1">Tempo</div>
              <div className="flex items-center gap-2">
                <input
                  className="w-16 bg-transparent font-mono text-sm text-[var(--text-primary)] focus:outline-none"
                  max="240"
                  min="40"
                  onChange={(event) => setBpm(Number(event.target.value))}
                  type="number"
                  value={bpm}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">BPM</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="section-label mb-1">Song span</div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{songLengthInBeats} steps</div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{Math.max(1, Math.ceil(songLengthInBeats / 16))} bars</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="section-label">Pattern length</span>
                <button
                  className="control-chip inline-flex h-7 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  data-ui-sound="tab"
                  onClick={() => applyPatternLength(stepsPerPattern - 16)}
                  type="button"
                >
                  -1 bar
                </button>
                <button
                  className="control-chip inline-flex h-7 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  data-ui-sound="tab"
                  onClick={() => applyPatternLength(stepsPerPattern + 16)}
                  type="button"
                >
                  +1 bar
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">{stepsPerPattern} steps</span>
              </div>
              {isLoopWindowActive ? (
                <button
                  className="control-chip mt-2 inline-flex h-7 items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  data-ui-sound="tab"
                  onClick={() => setLoopRange(null, null)}
                  type="button"
                >
                  Use full pattern loop
                </button>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="section-label mb-1">Session</div>
              <div className={`flex items-center gap-2 text-sm font-medium ${saveStatus === 'error' ? 'text-[var(--danger)]' : saveStatus === 'saving' ? 'text-[var(--warning)]' : 'text-[var(--accent-strong)]'}`}>
                <span
                  aria-hidden="true"
                  className="status-dot"
                  data-tone={saveStatusTone(saveStatus, lastSavedAt)}
                />
                <span className="truncate">{formatSaveLabel(saveStatus, lastSavedAt)}</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-col gap-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    aria-label={`Audio status: ${audioHealth.label}`}
                    className="status-chip inline-flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-tone={audioHealth.tone}
                    onClick={() => setShowAudioNerdStats((current) => !current)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="status-dot"
                      data-tone={audioHealth.tone}
                    />
                    {audioHealth.label}
                  </button>
                  <button
                    className="control-chip inline-flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-ui-sound="tab"
                    onClick={() => setShowAudioNerdStats((current) => !current)}
                    type="button"
                  >
                    {showAudioNerdStats ? 'Hide stats' : 'Stats for nerds'}
                  </button>
                </div>
                <span>{isInitialized ? audioHealth.detail : 'Tap Enable audio if browser autoplay has not unlocked yet.'}</span>
                {!isInitialized ? (
                  <button
                    aria-label="Enable audio engine"
                    className="control-chip inline-flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-needs-attention="true"
                    data-ui-sound="settings"
                    onClick={() => void initAudio()}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="status-dot"
                      data-tone="attention"
                    />
                    Enable audio
                  </button>
                ) : null}
                {showAudioNerdStats ? (
                  <div className="surface-panel-muted grid gap-2 border border-[var(--border-soft)] p-2.5">
                    {audioNerdStats.map((stat) => (
                      <div className="flex items-center justify-between gap-3" key={stat.label}>
                        <span className="section-label">{stat.label}</span>
                        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                          <span aria-hidden="true" className="status-dot" data-tone={stat.tone} />
                          {stat.value}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-[var(--border-soft)] pt-2 text-[10px] leading-5 text-[var(--text-secondary)]">
                      {countInActive
                        ? `Count in active: ${countInBeatsRemaining} beat${countInBeatsRemaining === 1 ? '' : 's'} remaining.`
                        : metronomeEnabled
                          ? `Metronome is on${countInBars > 0 ? ` with ${countInBars} bar count in` : ''}.`
                          : `Metronome is off. ${loopSummary}.`}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </header>
  );
};

const UtilityBtn = ({
  armed = false,
  armedLabel,
  children,
  disabled = false,
  disarming = false,
  label,
  onClick,
  shortcut,
  uiSound = 'action',
}: {
  armed?: boolean;
  armedLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  disarming?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
  uiSound?: 'action' | 'danger';
}) => (
  <button
    aria-label={label}
    className={`ghost-icon-button relative flex h-9 min-w-0 items-center justify-center gap-1.5 overflow-hidden px-2.5 ${armed ? 'border-[rgba(248,113,113,0.34)] text-[var(--danger)] shadow-[inset_0_0_0_1px_rgba(248,113,113,0.14)]' : ''}`}
    data-armed={armed ? 'true' : 'false'}
    data-armed-phase={armed ? 'armed' : disarming ? 'disarming' : 'idle'}
    data-ui-sound={uiSound}
    disabled={disabled}
    onClick={onClick}
    title={armed ? 'Click again to restart the session' : shortcut ? `${label} (${shortcut})` : label}
    type="button"
  >
    <span
      aria-hidden="true"
      className="utility-btn-fill absolute inset-0"
    />
    <span className="relative z-[1] shrink-0">{children}</span>
    <span className="relative z-[1] truncate text-[9px] font-semibold uppercase tracking-[0.14em]">{armed ? armedLabel ?? label : label}</span>
  </button>
);

const PatternButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    className="pattern-toggle-chip h-11 min-w-11 px-3 font-mono text-xs font-medium uppercase tracking-[0.16em] sm:h-9 sm:min-w-9"
    data-active={active ? 'true' : 'false'}
    data-ui-sound="tab"
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const ModeButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="mode-toggle-chip px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
    data-active={active ? 'true' : 'false'}
    data-ui-sound="tab"
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

const WorkflowButton = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="flex items-center gap-2 border-b border-transparent px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    data-active={active}
    data-ui-sound="nav"
    onClick={onClick}
    style={active
      ? {
          borderBottomColor: 'color-mix(in srgb, var(--accent) 56%, transparent)',
          color: 'var(--accent-strong)',
        }
      : undefined}
  >
    {icon}
    {label}
  </button>
);

const MiniStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
    <span className="section-label">{label}</span>
    <span className="truncate font-medium text-[var(--text-primary)]">{value}</span>
  </div>
);

const TransportBtn = ({
  active = false,
  className,
  children,
  emphasize = false,
  label,
  onClick,
  onPointerDown,
  shortcut,
  style,
  supersonicMode = false,
  tone,
  ...rest
}: {
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  emphasize?: boolean;
  label: string;
  onClick: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  shortcut?: string;
  style?: React.CSSProperties;
  supersonicMode?: boolean;
  tone: 'neutral' | 'play' | 'record';
  [key: `data-${string}`]: string | undefined;
}) => {
  const activeStyles = tone === 'record'
    ? 'bg-[rgba(240,143,134,0.16)] border-[rgba(240,143,134,0.28)] text-[var(--danger)]'
    : tone === 'play' && supersonicMode
      ? 'bg-[rgba(12,109,112,0.16)] border-[rgba(12,109,112,0.38)] text-[var(--text-primary)]'
    : tone === 'play'
      ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent-strong)]'
      : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-soft)] text-[var(--text-primary)]';
  const restingStyles = emphasize && tone === 'play'
    ? supersonicMode
      ? 'border-[rgba(12,109,112,0.42)] text-[var(--text-primary)] bg-[rgba(12,109,112,0.16)]'
      : 'border-[var(--accent)] text-[var(--bg-app)] bg-[var(--accent)]'
    : tone === 'play'
      ? supersonicMode
        ? 'border-[rgba(12,109,112,0.26)] text-[var(--text-secondary)] hover:bg-[rgba(12,109,112,0.12)] hover:border-[rgba(12,109,112,0.42)] hover:text-[var(--text-primary)]'
        : 'border-[color-mix(in_srgb,var(--accent)_28%,transparent)] text-[var(--accent-strong)] hover:bg-[var(--accent-muted)] hover:border-[var(--accent)]'
      : 'border-transparent text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:border-[var(--border-soft)] hover:text-[var(--text-primary)]';

  const playStyle: React.CSSProperties | undefined = emphasize && tone === 'play'
    ? {
        background: supersonicMode
          ? 'linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.04) 32%, rgba(8,82,88,0.2) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.16) 28%, color-mix(in srgb, var(--accent) 92%, transparent) 100%)',
        boxShadow: supersonicMode
          ? '0 0 0 1px rgba(12,109,112,0.42), 0 10px 26px rgba(8,82,88,0.2), inset 0 1px 0 rgba(255,255,255,0.26)'
          : '0 0 0 1px color-mix(in srgb, var(--accent) 58%, transparent), 0 10px 32px color-mix(in srgb, var(--accent) 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.5)',
        transform: supersonicMode ? 'translateY(-1px) scale(1.02)' : 'translateY(-1px) scale(1.03)',
        transition: 'all 230ms cubic-bezier(0.22,1,0.36,1)',
      }
    : { transition: 'all 230ms cubic-bezier(0.22,1,0.36,1)' };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        aria-label={label}
        className={`group flex h-9 min-w-[82px] items-center gap-1.5 rounded-[3px] border px-3 text-left transition-colors ${active ? activeStyles : restingStyles} ${className ?? ''}`}
        data-ui-sound={tone === 'record' ? 'record' : 'transport'}
        onClick={onClick}
        onPointerDown={onPointerDown}
        style={{ ...playStyle, ...style }}
        title={shortcut ? `${label} (${shortcut})` : label}
        {...rest}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-current/12 bg-black/10 transition-colors group-hover:bg-black/15">
          {children}
        </span>
        <span className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </button>
      {emphasize && tone === 'play' && !active && (
        <span
          aria-hidden="true"
          className="studio-play-pulse"
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 4,
            border: '1px solid color-mix(in srgb, var(--accent) 46%, transparent)',
            animation: 'ss-pulse 1.6s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
};

const formatSaveLabel = (saveStatus: 'idle' | 'saving' | 'saved' | 'error', lastSavedAt: string | null) => {
  if (saveStatus === 'error') {
    return 'Save failed';
  }

  if (saveStatus === 'saving') {
    return 'Saving…';
  }

  if (!lastSavedAt) {
    return 'Unsaved';
  }

  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const saveStatusTone = (
  saveStatus: 'idle' | 'saving' | 'saved' | 'error',
  lastSavedAt: string | null,
): 'ready' | 'saving' | 'saved' | 'error' => {
  if (saveStatus === 'error') return 'error';
  if (saveStatus === 'saving') return 'saving';
  if (lastSavedAt) return 'saved';
  return 'ready';
};

const getAudioHealthSummary = ({
  activeTrackCount,
  allTracksMuted,
  audioContextState,
  baseLatencyMs,
  isInitialized,
  isPlaying,
  likelyDeviceMuted,
  masterDb,
  masterMuted,
}: {
  activeTrackCount: number;
  allTracksMuted: boolean;
  audioContextState: AudioContextState;
  baseLatencyMs: number | null;
  isInitialized: boolean;
  isPlaying: boolean;
  likelyDeviceMuted: boolean;
  masterDb: number;
  masterMuted: boolean;
}): AudioHealthSummary => {
  if (!isInitialized) {
    return {
      detail: 'Audio context is currently idle.',
      label: 'Audio off',
      tone: 'error',
    };
  }

  if (audioContextState !== 'running') {
    return {
      detail: 'Browser audio context is suspended. Tap Play or Enable audio to resume output.',
      label: 'Audio suspended',
      tone: 'error',
    };
  }

  if (masterMuted) {
    return {
      detail: 'Master output is heavily attenuated. Raise master gain to hear playback.',
      label: 'Master muted',
      tone: 'attention',
    };
  }

  if (allTracksMuted) {
    return {
      detail: 'All active lanes are muted or solo-isolated. Unmute a lane to restore sound.',
      label: 'Tracks muted',
      tone: 'attention',
    };
  }

  if (likelyDeviceMuted) {
    return {
      detail: 'Playback is running but output is nearly silent. Your device, system, or browser tab volume may be muted.',
      label: 'Output silent',
      tone: 'attention',
    };
  }

  if (isPlaying && masterDb > -1.2) {
    return {
      detail: `Output peak is hot (${masterDb.toFixed(1)} dB). Lower lane or master gain to avoid clipping.`,
      label: 'Output hot',
      tone: 'attention',
    };
  }

  if (baseLatencyMs !== null && baseLatencyMs >= 120) {
    return {
      detail: `Device latency is elevated (${Math.round(baseLatencyMs)} ms). Close background audio apps for tighter timing.`,
      label: 'High latency',
      tone: 'attention',
    };
  }

  if (isPlaying && activeTrackCount >= 8 && baseLatencyMs !== null && baseLatencyMs >= 90) {
    return {
      detail: `Dense playback load detected with ${activeTrackCount} active lanes. Consider freezing or muting unused lanes.`,
      label: 'Heavy load',
      tone: 'attention',
    };
  }

  const latencyLabel = baseLatencyMs === null ? 'unknown latency' : `${Math.round(baseLatencyMs)} ms latency`;
  const levelLabel = !Number.isFinite(masterDb) ? 'stable output' : masterDb <= -60 ? 'idle output' : `${masterDb.toFixed(1)} dB`;
  return {
    detail: `Engine running with ${latencyLabel} and current output around ${levelLabel}.`,
    label: 'Audio healthy',
    tone: 'ready',
  };
};
