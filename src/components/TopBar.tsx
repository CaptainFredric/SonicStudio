import React, { useEffect, useState } from 'react';
import {
  Circle,
  Compass,
  Layers3,
  Play,
  Radio,
  Redo2,
  Save,
  Settings2,
  SlidersHorizontal,
  Square,
  Undo2,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { MASTER_PRESET_DEFINITIONS, type MasterSettings } from '../project/schema';
import { BrandMark } from './BrandMark';

const MASTER_MATCH_EPSILON = 0.015;

const isMasterPresetMatch = (current: MasterSettings, target: MasterSettings) => (
  Math.abs(current.glueCompression - target.glueCompression) <= MASTER_MATCH_EPSILON
  && Math.abs(current.highCutHz - target.highCutHz) <= 120
  && Math.abs(current.tone - target.tone) <= MASTER_MATCH_EPSILON
  && Math.abs(current.lowCutHz - target.lowCutHz) <= 4
  && Math.abs(current.outputGain - target.outputGain) <= 0.11
  && Math.abs(current.stereoWidth - target.stereoWidth) <= MASTER_MATCH_EPSILON
  && Math.abs(current.limiterCeiling - target.limiterCeiling) <= 0.06
);

export const TopBar = () => {
  const {
    activeView,
    bpm,
    canRedo,
    canUndo,
    countInActive,
    countInBars,
    countInBeatsRemaining,
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
    setSettingsOpen,
    setMetronomeEnabled,
    setTransportMode,
    songLengthInBeats,
    stop,
    togglePlay,
    toggleRecording,
    transportMode,
    tracks,
    undo,
  } = useAudio();
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const activeMasterPreset = MASTER_PRESET_DEFINITIONS.find((preset) => (
    isMasterPresetMatch(master, preset.settings)
  )) ?? null;

  useEffect(() => {
    setDraftProjectName(projectName);
  }, [projectName]);

  const commitProjectName = () => {
    renameProject(draftProjectName);
  };

  const isFirstImpression = !isInitialized && !isPlaying;
  const focusTitle = isFirstImpression
    ? `Press play to hear ${projectName}`
    : selectedTrack
      ? `${selectedTrack.name} · ${selectedTrack.type}${selectedArrangerClipId ? ' · clip focused' : ''}`
      : 'No track selected';
  const focusMeta = isFirstImpression
    ? 'Press ▶ or hit space to start playback.'
    : selectedTrack
      ? `${selectedTrack.source.engine === 'sample' ? 'Sample lane' : 'Synth lane'} · Pattern ${String.fromCharCode(65 + currentPattern)}${selectedArrangerClipId ? ' · selected clip' : ''} · ${transportMode === 'SONG' ? 'Song transport' : 'Pattern transport'}`
      : 'Choose a lane to inspect its pattern, sound, and song role.';
  const loopSummary = loopRangeStartBeat !== null && loopRangeEndBeat !== null
    ? `Looping steps ${loopRangeStartBeat + 1}-${loopRangeEndBeat}`
    : transportMode === 'SONG'
      ? 'Arranger timeline is active'
      : 'Pattern loop is active';
  const transportSummary = countInActive
    ? `Count in ${countInBeatsRemaining} beat${countInBeatsRemaining === 1 ? '' : 's'}`
    : isInitialized
      ? loopSummary
      : 'Audio is idle until first interaction';

  return (
    <header className="surface-panel px-3 py-3 sm:px-5 sm:py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start" data-first-impression={isFirstImpression}>
        <div className="grid min-w-0 content-start gap-4">
          <div className="flex min-w-0 items-center gap-3 border-b border-[var(--border-soft)] pb-3">
            <div className="surface-panel-strong flex h-11 w-11 items-center justify-center" style={{ borderRadius: '2px' }}>
              <BrandMark className="h-5 w-5 text-[var(--accent)]" speed={isPlaying ? 1.4 : 1} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">SonicStudio</h1>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Browser-native song writing, arrangement, and sound design.</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
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

          <div className="grid gap-3 border-t border-[var(--border-soft)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-label">Current focus</span>
                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{focusTitle}</span>
              </div>
              {!isFirstImpression && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <MiniStat label="Track" value={selectedTrack ? selectedTrack.name : 'None'} />
                  <MiniStat label="Pattern" value={String.fromCharCode(65 + currentPattern)} />
                  <MiniStat label="Clip" value={selectedArrangerClipId ? 'Selected' : 'None'} />
                  <MiniStat label="Profile" value={activeMasterPreset ? activeMasterPreset.label : 'Custom'} />
                  <MiniStat label="Master" value={`${master.outputGain.toFixed(1)} dB`} />
                </div>
              )}
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{focusMeta}</div>
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

        <div className="grid gap-3 border-t border-[var(--border-soft)] pt-3 xl:self-stretch xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex items-center gap-1 transition-opacity"
              style={{ opacity: isFirstImpression ? 0.42 : 1 }}
            >
              <IconBtn disabled={!canUndo} label="Undo" onClick={undo} shortcut="⌘Z">
                <Undo2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn disabled={!canRedo} label="Redo" onClick={redo} shortcut="⇧⌘Z">
                <Redo2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Save" onClick={saveProject} shortcut="⌘S">
                <Save className="h-4 w-4" />
              </IconBtn>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`control-chip flex h-9 items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${isSettingsOpen ? 'text-[var(--text-primary)]' : ''}`}
                data-active={isSettingsOpen}
                data-ui-sound="settings"
                onClick={() => setSettingsOpen(!isSettingsOpen)}
                type="button"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Options
              </button>
              <TransportBtn active={isRecording} label="Record" onClick={toggleRecording} tone="record">
                <Circle className="h-4 w-4 fill-current" />
              </TransportBtn>
              <TransportBtn
                active={isPlaying}
                emphasize={!isInitialized && !isPlaying}
                label={isPlaying ? 'Pause' : 'Play'}
                onClick={togglePlay}
                shortcut="Space"
                tone="play"
              >
                <Play className="h-4 w-4 fill-current" />
              </TransportBtn>
              <TransportBtn label="Stop" onClick={stop} tone="neutral">
                <Square className="h-4 w-4 fill-current" />
              </TransportBtn>
            </div>
          </div>

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
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{Math.max(1, Math.ceil(songLengthInBeats / 16))} bars ready</div>
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
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <Radio className="h-3 w-3 text-[var(--accent)]" />
                {transportSummary}
              </div>
            </div>

            <div className="min-w-0">
              <div className="section-label mb-1">Audio</div>
              <div className="flex flex-col gap-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {metronomeEnabled
                  ? `Metronome armed${countInBars > 0 ? ` with ${countInBars} bar count in` : ''}.`
                  : isInitialized
                    ? 'Audio armed. Re-arm if the browser suspended sound.'
                    : 'Press play above to wake audio.'}
                {isInitialized && (
                  <button
                    aria-label="Re-arm audio engine"
                    className="control-chip mt-1 inline-flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active="true"
                    data-ui-sound="settings"
                    onClick={() => void initAudio()}
                  >
                    <span aria-hidden="true" className="status-dot" data-tone="ready" />
                    Audio armed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const IconBtn = ({
  children,
  disabled = false,
  label,
  onClick,
  shortcut,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center"
    data-ui-sound="action"
    disabled={disabled}
    onClick={onClick}
    title={shortcut ? `${label} (${shortcut})` : label}
  >
    {children}
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
    className="h-11 min-w-11 sm:h-9 sm:min-w-9 border px-3 font-mono text-xs font-medium uppercase tracking-[0.16em] transition-colors"
    data-ui-sound="tab"
    onClick={onClick}
    style={active
      ? {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(130, 201, 187, 0.18)',
          color: 'var(--text-primary)',
        }
      : {
          background: 'transparent',
          border: '1px solid var(--border-soft)',
          color: 'var(--text-secondary)',
        }}
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
    className="border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors"
    data-ui-sound="tab"
    onClick={onClick}
    style={active
      ? {
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(124, 211, 252, 0.18)',
          color: 'var(--text-primary)',
        }
      : {
          background: 'transparent',
          borderColor: 'var(--border-soft)',
          color: 'var(--text-secondary)',
        }}
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
          borderBottomColor: 'rgba(124, 211, 252, 0.4)',
          color: 'var(--text-primary)',
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
  children,
  emphasize = false,
  label,
  onClick,
  shortcut,
  tone,
}: {
  active?: boolean;
  children: React.ReactNode;
  emphasize?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
  tone: 'neutral' | 'play' | 'record';
}) => {
  const activeStyles = tone === 'record'
    ? 'bg-[rgba(240,143,134,0.16)] border-[rgba(240,143,134,0.28)] text-[var(--danger)]'
    : tone === 'play'
      ? 'bg-[var(--accent-muted)] border-[rgba(130,201,187,0.26)] text-[var(--accent-strong)]'
      : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-soft)] text-[var(--text-primary)]';
  const restingStyles = emphasize && tone === 'play'
    ? 'border-[rgba(114,217,255,0.32)] text-[var(--accent-strong)] bg-[rgba(114,217,255,0.06)] hover:bg-[rgba(114,217,255,0.12)]'
    : tone === 'play'
      ? 'border-[rgba(114,217,255,0.18)] text-[var(--accent-strong)] hover:bg-[rgba(114,217,255,0.08)] hover:border-[rgba(114,217,255,0.32)]'
      : 'border-transparent text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:border-[var(--border-soft)] hover:text-[var(--text-primary)]';

  return (
    <button
      aria-label={label}
      className={`flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center border transition-colors ${active ? activeStyles : restingStyles}`}
      data-ui-sound={tone === 'record' ? 'record' : 'transport'}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
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
    return 'Ready';
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
