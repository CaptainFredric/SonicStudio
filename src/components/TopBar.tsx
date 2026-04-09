import React, { useEffect, useState } from 'react';
import {
  Activity,
  Circle,
  Play,
  Redo2,
  Save,
  Square,
  Undo2,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';

export const TopBar = () => {
  const {
    bpm,
    canRedo,
    canUndo,
    currentPattern,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    lastSavedAt,
    patternCount,
    projectName,
    redo,
    renameProject,
    saveProject,
    saveStatus,
    setBpm,
    setCurrentPattern,
    stop,
    togglePlay,
    toggleRecording,
    undo,
  } = useAudio();
  const [draftProjectName, setDraftProjectName] = useState(projectName);

  useEffect(() => {
    setDraftProjectName(projectName);
  }, [projectName]);

  const commitProjectName = () => {
    renameProject(draftProjectName);
  };

  return (
    <header className="surface-panel px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:gap-5 xl:flex-1 xl:items-center">
          <div className="flex min-w-0 items-center gap-3 lg:min-w-[170px]">
            <div className="surface-panel-strong h-11 w-11 flex items-center justify-center" style={{borderRadius: '2px'}}>
              <Activity className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">SonicStudio</h1>
              <p className="mt-1 hidden text-xs text-[var(--text-secondary)] lg:block">Loop sketching, arrangement, and sound design in one browser desk</p>
            </div>
          </div>

          <div className="min-w-0 flex-1 xl:max-w-[340px]">
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

          <div className="hidden lg:block max-w-[280px]">
            <div className="section-label mb-2">Pattern bank</div>
            <div className="flex items-center overflow-x-auto gap-1 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-1 [scroll-behavior:smooth] [-webkit-overflow-scrolling:touch] scroll-snap-x-mandatory">
              {Array.from({ length: patternCount }, (_, patternIndex) => patternIndex).map((patternIndex) => (
                <React.Fragment key={patternIndex}>
                  <div className="scroll-snap-align-start">
                    <PatternButton
                      active={currentPattern === patternIndex}
                      onClick={() => setCurrentPattern(patternIndex)}
                    >
                      {String.fromCharCode(65 + patternIndex)}
                    </PatternButton>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {!isInitialized ? (
          <button
            className="h-11 self-start border border-[rgba(130,201,187,0.24)] bg-[var(--accent-muted)] px-5 text-sm font-semibold text-[var(--accent-strong)] transition-colors hover:border-[rgba(130,201,187,0.36)] hover:text-[var(--text-primary)] xl:self-auto"
            onClick={initAudio}
          >
            Initialize audio
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="surface-panel-muted flex items-center gap-1 p-1">
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

            <div className="surface-panel-muted flex items-center gap-1 p-1">
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

            <div className="surface-panel-muted min-w-[88px] px-4 py-3">
              <div className="section-label mb-1">Tempo</div>
              <div className="flex items-center gap-2">
                <input
                  className="w-14 bg-transparent font-mono text-sm text-[var(--text-primary)] focus:outline-none"
                  max="240"
                  min="40"
                  onChange={(event) => setBpm(Number(event.target.value))}
                  type="number"
                  value={bpm}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">BPM</span>
              </div>
            </div>

            <div className="surface-panel-muted min-w-[132px] px-4 py-3">
              <div className="section-label mb-1">Session</div>
              <div className={`text-sm font-medium ${saveStatus === 'error' ? 'text-[var(--danger)]' : saveStatus === 'saving' ? 'text-[var(--warning)]' : 'text-[var(--accent-strong)]'}`}>
                {formatSaveLabel(saveStatus, lastSavedAt)}
              </div>
            </div>
          </div>
        )}
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
    className="h-9 min-w-9 px-3 font-mono text-xs font-medium uppercase tracking-[0.16em] transition-colors"
    onClick={onClick}
    style={active
      ? {
          background: 'var(--accent-muted)',
          border: '1px solid rgba(130, 201, 187, 0.26)',
          color: 'var(--accent-strong)',
        }
      : {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-secondary)',
        }}
  >
    {children}
  </button>
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
