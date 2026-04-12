import React, { useEffect, useMemo, useState } from 'react';
import {
  Circle,
  Compass,
  Layers3,
  Play,
  Radio,
  Redo2,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Undo2,
  Waves,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { MASTER_PRESET_DEFINITIONS, type MasterSettings } from '../project/schema';
import { getStudioReadinessAssessment } from '../utils/readiness';

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
    currentPattern,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    lastSavedAt,
    loopRangeEndBeat,
    loopRangeStartBeat,
    master,
    patternCount,
    pinnedTrackIds,
    projectName,
    redo,
    renderState,
    renameProject,
    saveProject,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    setActiveView,
    setBpm,
    setCurrentPattern,
    setSelectedTrackId,
    setTransportMode,
    songMarkers,
    songLengthInBeats,
    stop,
    togglePlay,
    toggleRecording,
    transportMode,
    tracks,
    undo,
  } = useAudio();
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [trackQuery, setTrackQuery] = useState('');
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const readiness = getStudioReadinessAssessment();
  const activeMasterPreset = MASTER_PRESET_DEFINITIONS.find((preset) => (
    isMasterPresetMatch(master, preset.settings)
  )) ?? null;
  const filteredTracks = useMemo(() => {
    const normalizedQuery = trackQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return tracks.slice(0, 6);
    }

    return tracks.filter((track) => (
      track.name.toLowerCase().includes(normalizedQuery)
      || track.type.toLowerCase().includes(normalizedQuery)
    )).slice(0, 6);
  }, [trackQuery, tracks]);

  useEffect(() => {
    setDraftProjectName(projectName);
  }, [projectName]);

  const commitProjectName = () => {
    renameProject(draftProjectName);
  };

  const focusTitle = selectedTrack
    ? `${selectedTrack.name} · ${selectedTrack.type}${selectedArrangerClipId ? ' · clip focused' : ''}`
    : 'No track selected';
  const focusMeta = selectedTrack
    ? `${selectedTrack.source.engine === 'sample' ? 'Sample lane' : 'Synth lane'} · Pattern ${String.fromCharCode(65 + currentPattern)}${selectedArrangerClipId ? ' · selected clip' : ''} · ${transportMode === 'SONG' ? 'Song transport' : 'Pattern transport'}`
    : 'Pick a track to keep editing and sound design tied together.';
  const loopSummary = loopRangeStartBeat !== null && loopRangeEndBeat !== null
    ? `Looping steps ${loopRangeStartBeat + 1}-${loopRangeEndBeat}`
    : transportMode === 'SONG'
      ? 'Arranger timeline is active'
      : 'Pattern loop is active';

  return (
    <header className="surface-panel px-3 py-3 sm:px-6 sm:py-4">
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3 xl:min-w-[220px]">
            <div className="surface-panel-strong flex h-12 w-12 items-center justify-center" style={{ borderRadius: '2px' }}>
              <Waves className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">SonicStudio</h1>
              <p className="mt-1 hidden text-xs text-[var(--text-secondary)] sm:block">Clip arrangement, expressive sequencing, and sound design in one instrument desk</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="surface-panel-muted px-4 py-3">
              <div className="section-label mb-2">Project</div>
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
            </div>

            <div className="surface-panel-muted px-4 py-3">
              <div className="section-label mb-2">Pattern bank</div>
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
          </div>
        </div>

        <div className="surface-panel-muted grid gap-3 px-4 py-3 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
            <div className="flex items-center gap-1 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-1">
              <IconBtn disabled={!canUndo} label="Undo" onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn disabled={!canRedo} label="Redo" onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Save" onClick={saveProject}>
                <Save className="h-4 w-4" />
              </IconBtn>
            </div>

            <div className="flex items-center gap-1 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-1">
              <TransportBtn active={isRecording} label="Record" onClick={toggleRecording} tone="record">
                <Circle className="h-4 w-4 fill-current" />
              </TransportBtn>
              <TransportBtn active={isPlaying} label="Play" onClick={togglePlay} tone="play">
                <Play className="h-4 w-4 fill-current" />
              </TransportBtn>
              <TransportBtn label="Stop" onClick={stop} tone="neutral">
                <Square className="h-4 w-4 fill-current" />
              </TransportBtn>
            </div>

            <div className="grid gap-3 md:grid-cols-[auto_auto_minmax(110px,auto)_minmax(120px,auto)_minmax(132px,auto)]">
              <div>
                <div className="section-label mb-2">Playback mode</div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>

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
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{Math.max(1, Math.ceil(songLengthInBeats / 16))} bars of arrangement runway</div>
              </div>

              <div className="min-w-0">
                <div className="section-label mb-1">Audio</div>
                <button
                  className="control-chip flex h-10 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active={isInitialized ? 'true' : 'false'}
                  onClick={() => void initAudio()}
                >
                  {isInitialized ? 'Re arm' : 'Wake audio'}
                </button>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {isInitialized ? 'Resume sound if the browser suspended audio.' : 'Play or audition can also start audio automatically.'}
                </div>
              </div>

              <div className="min-w-0">
                <div className="section-label mb-1">Session</div>
                <div className={`text-sm font-medium ${saveStatus === 'error' ? 'text-[var(--danger)]' : saveStatus === 'saving' ? 'text-[var(--warning)]' : 'text-[var(--accent-strong)]'}`}>
                  {formatSaveLabel(saveStatus, lastSavedAt)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <Radio className="h-3 w-3 text-[var(--accent)]" />
                  {isInitialized ? loopSummary : 'Audio is idle until first interaction'}
                </div>
              </div>
            </div>
          </div>
      </div>

      <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="surface-panel-strong px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="section-label">Current focus</div>
                <div className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">{focusTitle}</div>
                <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{focusMeta}</div>
              </div>
              <div className="flex flex-wrap gap-2">
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

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="Track"
                value={selectedTrack ? selectedTrack.name : 'None'}
              />
              <MiniStat
                label="Pattern"
                value={String.fromCharCode(65 + currentPattern)}
              />
              <MiniStat
                label="Clip"
                value={selectedArrangerClipId ? 'Selected' : 'None'}
              />
              <MiniStat
                label="Profile"
                value={activeMasterPreset ? activeMasterPreset.label : 'Custom'}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                The fastest loop should be choose track, place phrase, shape tone, then move back into song view.
              </div>
              <MiniStat label="Master" value={`${master.outputGain.toFixed(1)} dB`} />
              <MiniStat label="Pinned" value={String(pinnedTrackIds.length)} />
              <MiniStat label="Sections" value={String(songMarkers.length)} />
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="surface-panel-muted px-4 py-3">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="section-label">Track jump</span>
            </div>
            <input
              aria-label="Track jump"
              className="control-field mt-3 h-10 w-full px-3 text-sm"
              onChange={(event) => setTrackQuery(event.target.value)}
              placeholder="Find a track by name or type"
              value={trackQuery}
            />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {filteredTracks.length > 0 ? filteredTracks.map((track) => (
                <button
                  key={track.id}
                  className="control-chip flex shrink-0 items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active={selectedTrackId === track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
                  {track.name}
                </button>
              )) : (
                <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
                  No tracks match the current query.
                </div>
              )}
            </div>
          </div>

          <div className="surface-panel-muted px-4 py-3">
            <div className="section-label">Readiness</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniStat label="Overall" value={`${readiness.overallScore}%`} />
              <MiniStat label="GarageBand fit" value={`${readiness.competitorScore}%`} />
              <MiniStat label="Monetization" value={`${readiness.monetizationScore}%`} />
            </div>
          </div>

          {renderState.active && (
            <div className="surface-panel-muted px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="section-label">{renderState.mode === 'stems' ? 'Stem bounce' : 'Mix bounce'}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">{Math.round(renderState.progress * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(114,217,255,0.55),rgba(223,246,255,0.92))]"
                  style={{ width: `${Math.round(renderState.progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {renderState.currentTrackName ? `${renderState.phase} · ${renderState.currentTrackName}` : renderState.phase}
                {renderState.etaSeconds !== null ? ` · about ${renderState.etaSeconds}s left` : ''}
              </div>
            </div>
          )}
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
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-10 w-10 items-center justify-center"
    disabled={disabled}
    onClick={onClick}
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
    className="h-9 min-w-9 rounded-full border px-3 font-mono text-xs font-medium uppercase tracking-[0.16em] transition-colors"
    onClick={onClick}
    style={active
      ? {
          background: 'var(--accent-muted)',
          border: '1px solid rgba(130, 201, 187, 0.26)',
          color: 'var(--accent-strong)',
        }
      : {
          background: 'rgba(255,255,255,0.02)',
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
    className="rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors"
    onClick={onClick}
    style={active
      ? {
          background: 'rgba(124, 211, 252, 0.14)',
          borderColor: 'rgba(124, 211, 252, 0.28)',
          color: '#d9f2ff',
        }
      : {
          background: 'rgba(255,255,255,0.02)',
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
    className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    data-active={active}
    onClick={onClick}
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
  <div className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <div className="section-label">{label}</div>
    <div className="mt-1 truncate text-xs font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

const TransportBtn = ({
  active = false,
  children,
  label,
  onClick,
  tone,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: 'neutral' | 'play' | 'record';
}) => {
  const activeStyles = tone === 'record'
    ? 'bg-[rgba(240,143,134,0.16)] border-[rgba(240,143,134,0.28)] text-[var(--danger)]'
    : tone === 'play'
      ? 'bg-[var(--accent-muted)] border-[rgba(130,201,187,0.26)] text-[var(--accent-strong)]'
      : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-soft)] text-[var(--text-primary)]';

  return (
    <button
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center border transition-colors ${active ? activeStyles : 'border-transparent text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:border-[var(--border-soft)] hover:text-[var(--text-primary)]'}`}
      onClick={onClick}
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
