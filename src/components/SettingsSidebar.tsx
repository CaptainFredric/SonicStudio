import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Gauge,
  Layers3,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { getStudioReadinessAssessment } from '../utils/readiness';

const PATTERN_OPTIONS = [2, 4, 6, 8];
const STEP_OPTIONS = [8, 16, 32, 64];

export const SettingsSidebar = () => {
  const {
    arrangerClips,
    bpm,
    exportAudioMix,
    exportTrackStems,
    exportSession,
    importSession,
    isSettingsOpen,
    lastSavedAt,
    newSession,
    patternCount,
    renameTrack,
    saveProject,
    saveStatus,
    selectedTrackId,
    setBpm,
    setPatternCount,
    setStepsPerPattern,
    setTransportMode,
    songLengthInBeats,
    stepsPerPattern,
    toggleMute,
    toggleSettings,
    toggleSolo,
    tracks,
    transportMode,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const [draftTrackName, setDraftTrackName] = useState(selectedTrack?.name ?? '');
  const readiness = getStudioReadinessAssessment();

  useEffect(() => {
    setDraftTrackName(selectedTrack?.name ?? '');
  }, [selectedTrack?.id, selectedTrack?.name]);

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <aside className="surface-panel h-full w-full overflow-auto p-4">
      <input
        ref={fileInputRef}
        accept=".json,.sonicstudio.json,application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          await importSession(file);
          event.target.value = '';
        }}
        type="file"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-label">Workspace</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Studio Setup</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Session actions, transport shape, and selected track settings live here.</p>
        </div>
        <button
          aria-label="Close settings"
          className="ghost-icon-button flex h-10 w-10 items-center justify-center"
          onClick={toggleSettings}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <section className="surface-panel-strong p-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Session</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-[var(--text-secondary)]">
            <MetricCell label="Tracks" value={String(tracks.length)} />
            <MetricCell label="Clips" value={String(arrangerClips.length)} />
            <MetricCell label="Status" value={formatSaveLabel(saveStatus, lastSavedAt)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ActionButton icon={<Sparkles className="h-3.5 w-3.5" />} label="New session" onClick={newSession} />
            <ActionButton icon={<Layers3 className="h-3.5 w-3.5" />} label="Save now" onClick={saveProject} />
            <ActionButton icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load JSON" onClick={() => fileInputRef.current?.click()} />
            <ActionButton icon={<Download className="h-3.5 w-3.5" />} label="Bounce WAV" onClick={() => void exportAudioMix()} />
            <ActionButton icon={<Download className="h-3.5 w-3.5" />} label="Export stems" onClick={() => void exportTrackStems()} />
            <ActionButton icon={<Layers3 className="h-3.5 w-3.5" />} label="Export JSON" onClick={exportSession} />
          </div>
        </section>

        <section className="surface-panel-strong p-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Layers3 className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Transport</span>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="section-label">Playback mode</div>
              <div className="mt-2 flex gap-2">
                <SegmentButton active={transportMode === 'PATTERN'} label="Pattern" onClick={() => setTransportMode('PATTERN')} />
                <SegmentButton active={transportMode === 'SONG'} label="Song" onClick={() => setTransportMode('SONG')} />
              </div>
            </div>

            <div>
              <div className="section-label">Tempo</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="control-field h-11 w-24 px-3 text-center font-mono text-sm"
                  max="240"
                  min="40"
                  onChange={(event) => setBpm(Number(event.target.value))}
                  type="number"
                  value={bpm}
                />
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">BPM</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCell label="Song span" value={`${songLengthInBeats} steps`} />
              <MetricCell label="Pattern size" value={`${stepsPerPattern} steps`} />
            </div>

            <div>
              <div className="section-label">Pattern banks</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PATTERN_OPTIONS.map((option) => (
                  <React.Fragment key={option}>
                    <SegmentButton
                      active={patternCount === option}
                      label={String(option)}
                      onClick={() => setPatternCount(option)}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label">Steps per pattern</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {STEP_OPTIONS.map((option) => (
                  <React.Fragment key={option}>
                    <SegmentButton
                      active={stepsPerPattern === option}
                      label={String(option)}
                      onClick={() => setStepsPerPattern(option)}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel-strong p-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Selected Track</span>
          </div>

          {selectedTrack ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="section-label">Name</div>
                <input
                  className="control-field mt-2 h-11 w-full px-3 text-sm"
                  onBlur={() => renameTrack(selectedTrack.id, draftTrackName)}
                  onChange={(event) => setDraftTrackName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      renameTrack(selectedTrack.id, draftTrackName);
                      event.currentTarget.blur();
                    }
                  }}
                  value={draftTrackName}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="section-label">Instrument</div>
                  <div className="mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]" style={{ borderColor: `${selectedTrack.color}55`, color: selectedTrack.color }}>
                    {selectedTrack.type}
                  </div>
                </div>
                <div className="flex gap-2">
                  <StateButton active={selectedTrack.muted} label="Mute" onClick={() => toggleMute(selectedTrack.id)} />
                  <StateButton active={selectedTrack.solo} label="Solo" onClick={() => toggleSolo(selectedTrack.id)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCell label="Waveform" value={selectedTrack.source.waveform} />
                <MetricCell label="Octave" value={String(selectedTrack.source.octaveShift)} />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Volume</span>
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{selectedTrack.volume.toFixed(1)} dB</span>
                </div>
                <input
                  className="mt-3"
                  max="6"
                  min="-60"
                  onChange={(event) => updateTrackVolume(selectedTrack.id, Number(event.target.value))}
                  step="1"
                  type="range"
                  value={selectedTrack.volume}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Pan</span>
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{selectedTrack.pan.toFixed(1)}</span>
                </div>
                <input
                  className="mt-3"
                  max="1"
                  min="-1"
                  onChange={(event) => updateTrackPan(selectedTrack.id, Number(event.target.value))}
                  step="0.1"
                  type="range"
                  value={selectedTrack.pan}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-6 text-sm text-[var(--text-secondary)]">
              Select a track from the sequencer, piano roll, mixer, or arranger to edit its identity and channel settings.
            </div>
          )}
        </section>

        <section className="surface-panel-strong p-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Gauge className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Shortcuts</span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
            <ShortcutRow command="Space" description="Play or pause" />
            <ShortcutRow command="Cmd/Ctrl+S" description="Save session" />
            <ShortcutRow command="Cmd/Ctrl+Z" description="Undo" />
            <ShortcutRow command="Shift+Cmd/Ctrl+Z" description="Redo" />
            <ShortcutRow command="1-8" description="Switch pattern bank" />
          </div>
        </section>

        <section className="surface-panel-strong p-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Gauge className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Readiness</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-[var(--text-secondary)]">
            <MetricCell label="Overall" value={`${readiness.overallScore}%`} />
            <MetricCell label="GarageBand fit" value={`${readiness.competitorScore}%`} />
            <MetricCell label="Monetization" value={`${readiness.monetizationScore}%`} />
          </div>
          <div className="mt-4 space-y-3">
            {readiness.slices.map((slice) => (
              <div key={slice.label} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-label">{slice.label}</span>
                  <span className="font-mono text-xs text-[var(--accent-strong)]">{slice.score}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(114,217,255,0.55),rgba(223,246,255,0.92))]"
                    style={{ width: `${slice.score}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{slice.rationale}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};

const ActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-field flex h-10 items-center gap-2 px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    onClick={onClick}
  >
    <span className="text-[var(--accent)]">{icon}</span>
    {label}
  </button>
);

const MetricCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="section-label">{label}</div>
    <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

const SegmentButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);

const StateButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);

const ShortcutRow = ({ command, description }: { command: string; description: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <span className="font-mono text-xs text-[var(--accent-strong)]">{command}</span>
    <span className="text-right text-xs text-[var(--text-secondary)]">{description}</span>
  </div>
);

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
