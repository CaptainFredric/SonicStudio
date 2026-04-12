import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Gauge,
  Layers3,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { useAudio, type BounceNormalizationMode, type BounceTailMode } from '../context/AudioContext';
import { MASTER_PRESET_DEFINITIONS, SESSION_TEMPLATE_DEFINITIONS, type MasterSettings } from '../project/schema';
import { getStudioReadinessAssessment } from '../utils/readiness';

const PATTERN_OPTIONS = [2, 4, 6, 8];
const STEP_OPTIONS = [8, 16, 32, 64];
type BounceScope = 'pattern' | 'song' | 'clip-window' | 'loop-window';

const MASTER_MATCH_EPSILON = 0.015;
const BOUNCE_NORMALIZATION_OPTIONS: Array<{ description: string; label: string; value: BounceNormalizationMode }> = [
  { description: 'Keep the raw bounce level exactly as the current master path produced it.', label: 'Raw', value: 'none' },
  { description: 'Lift the bounce safely toward a cleaner peak reference without clipping.', label: 'Peak safe', value: 'peak' },
];
const BOUNCE_TAIL_OPTIONS: Array<{ description: string; label: string; value: BounceTailMode }> = [
  { description: 'Fast print for dry or tightly gated phrases.', label: 'Short', value: 'short' },
  { description: 'General purpose tail for most references and revisions.', label: 'Standard', value: 'standard' },
  { description: 'Longer print for pad wash, delay, and reverb decay.', label: 'Long', value: 'long' },
];

const isMasterPresetMatch = (current: MasterSettings, target: MasterSettings) => (
  Math.abs(current.glueCompression - target.glueCompression) <= MASTER_MATCH_EPSILON
  && Math.abs(current.tone - target.tone) <= MASTER_MATCH_EPSILON
  && Math.abs(current.outputGain - target.outputGain) <= 0.11
  && Math.abs(current.limiterCeiling - target.limiterCeiling) <= 0.06
);

export const SettingsSidebar = () => {
  const {
    arrangerClips,
    bpm,
    bounceHistory,
    exportAudioMix,
    exportTrackStems,
    exportSession,
    importSession,
    isSettingsOpen,
    lastSavedAt,
    loadSessionTemplate,
    loopRangeEndBeat,
    loopRangeStartBeat,
    master,
    masterSnapshots,
    newSession,
    patternCount,
    renderState,
    renameTrack,
    rerunBounceHistory,
    saveProject,
    saveMasterSnapshot,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    setBpm,
    setMasterSettings,
    setPatternCount,
    setStepsPerPattern,
    setTransportMode,
    songLengthInBeats,
    songMarkers,
    stepsPerPattern,
    toggleMute,
    toggleSettings,
    toggleSolo,
    tracks,
    transportMode,
    updateTrackPan,
    updateTrackVolume,
    applyMasterSnapshot,
    deleteMasterSnapshot,
  } = useAudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const [draftTrackName, setDraftTrackName] = useState(selectedTrack?.name ?? '');
  const [bounceScope, setBounceScope] = useState<BounceScope>(transportMode === 'SONG' ? 'song' : 'pattern');
  const [bounceNormalization, setBounceNormalization] = useState<BounceNormalizationMode>('peak');
  const [bounceTailMode, setBounceTailMode] = useState<BounceTailMode>('standard');
  const readiness = getStudioReadinessAssessment();
  const activeMasterPreset = MASTER_PRESET_DEFINITIONS.find((preset) => (
    isMasterPresetMatch(master, preset.settings)
  )) ?? null;
  const activeMasterSnapshot = masterSnapshots.find((snapshot) => (
    isMasterPresetMatch(master, snapshot.settings)
  )) ?? null;
  const hasLoopWindow = loopRangeStartBeat !== null && loopRangeEndBeat !== null;

  useEffect(() => {
    setDraftTrackName(selectedTrack?.name ?? '');
  }, [selectedTrack?.id, selectedTrack?.name]);

  useEffect(() => {
    setBounceScope((current) => (
      current === 'clip-window' || (current === 'loop-window' && hasLoopWindow)
        ? current
        : transportMode === 'SONG' ? 'song' : 'pattern'
    ));
  }, [hasLoopWindow, transportMode]);

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
            <MetricCell label="Status" value={renderState.active ? renderState.phase : formatSaveLabel(saveStatus, lastSavedAt)} />
          </div>
          <div className="mt-4">
            <div className="section-label">Starter scenes</div>
            <div className="mt-3 grid gap-3">
              {SESSION_TEMPLATE_DEFINITIONS.map((template) => (
                <button
                  key={template.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.28)] hover:bg-[rgba(114,217,255,0.05)]"
                  disabled={renderState.active}
                  onClick={() => loadSessionTemplate(template.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">{template.focus}</span>
                  </div>
                  <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{template.description}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              These scenes replace the current session immediately, so they are meant for fast starts, not as presets layered onto an existing song.
            </div>
          </div>
          {renderState.active && (
            <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="section-label">{renderState.mode === 'stems' ? 'Stem bounce' : 'Mix bounce'}</span>
                <span className="font-mono text-xs text-[var(--accent-strong)]">{Math.round(renderState.progress * 100)}%</span>
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
          <div className="mt-4">
            <div className="section-label">Bounce range</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <SegmentButton active={bounceScope === 'pattern'} label="Pattern" onClick={() => setBounceScope('pattern')} />
              <SegmentButton active={bounceScope === 'song'} label="Song" onClick={() => setBounceScope('song')} />
              <SegmentButton
                active={bounceScope === 'loop-window'}
                label="Loop window"
                onClick={() => {
                  if (transportMode === 'SONG' && hasLoopWindow) {
                    setBounceScope('loop-window');
                  }
                }}
              />
              <SegmentButton
                active={bounceScope === 'clip-window'}
                label="Clip window"
                onClick={() => {
                  if (selectedArrangerClipId) {
                    setBounceScope('clip-window');
                  }
                }}
              />
            </div>
            <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
              {bounceScope === 'clip-window'
                ? selectedArrangerClipId
                  ? 'Bounce the currently selected song clip range across the full session mix.'
                  : 'Select a song clip first if you want to print a focused range.'
                : bounceScope === 'loop-window'
                  ? hasLoopWindow
                    ? 'Bounce the active loop span. This is the fastest way to print a section pass while you are refining it.'
                    : 'Switch to song transport and set a loop span first if you want a section-focused render.'
                : bounceScope === 'song'
                  ? 'Bounce the full arranger timeline as it currently stands.'
                  : 'Bounce the current pattern bank for rapid iteration.'}
            </div>
            {bounceScope === 'loop-window' && (
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {songMarkers.length > 0
                  ? 'Markers and loop buttons in song view work together here, so you can audition and print the same section without rebuilding a clip window.'
                  : 'Add a few markers in song view if you want section work to stay easier to navigate as the arrangement grows.'}
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="section-label">Normalization</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {BOUNCE_NORMALIZATION_OPTIONS.map((option) => (
                  <React.Fragment key={option.value}>
                    <SegmentButton
                      active={bounceNormalization === option.value}
                      label={option.label}
                      onClick={() => setBounceNormalization(option.value)}
                    />
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {BOUNCE_NORMALIZATION_OPTIONS.find((option) => option.value === bounceNormalization)?.description}
              </div>
            </div>
            <div>
              <div className="section-label">Tail</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {BOUNCE_TAIL_OPTIONS.map((option) => (
                  <React.Fragment key={option.value}>
                    <SegmentButton
                      active={bounceTailMode === option.value}
                      label={option.label}
                      onClick={() => setBounceTailMode(option.value)}
                    />
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {BOUNCE_TAIL_OPTIONS.find((option) => option.value === bounceTailMode)?.description}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ActionButton disabled={renderState.active} icon={<Sparkles className="h-3.5 w-3.5" />} label="New session" onClick={newSession} />
            <ActionButton disabled={renderState.active} icon={<Layers3 className="h-3.5 w-3.5" />} label="Save now" onClick={saveProject} />
            <ActionButton disabled={renderState.active} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load JSON" onClick={() => fileInputRef.current?.click()} />
            <ActionButton
              disabled={
                renderState.active
                || (bounceScope === 'clip-window' && !selectedArrangerClipId)
                || (bounceScope === 'loop-window' && !hasLoopWindow)
              }
              icon={<Download className="h-3.5 w-3.5" />}
              label={renderState.mode === 'mix' ? 'Printing mix' : 'Bounce WAV'}
              onClick={() => void exportAudioMix(bounceScope, {
                normalization: bounceNormalization,
                tailMode: bounceTailMode,
              })}
            />
            <ActionButton
              disabled={
                renderState.active
                || (bounceScope === 'clip-window' && !selectedArrangerClipId)
                || (bounceScope === 'loop-window' && !hasLoopWindow)
              }
              icon={<Download className="h-3.5 w-3.5" />}
              label={renderState.mode === 'stems' ? 'Printing stems' : 'Export stems'}
              onClick={() => void exportTrackStems(bounceScope, {
                normalization: bounceNormalization,
                tailMode: bounceTailMode,
              })}
            />
            <ActionButton disabled={renderState.active} icon={<Layers3 className="h-3.5 w-3.5" />} label="Export JSON" onClick={exportSession} />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="section-label">Recent prints</span>
              <span className="font-mono text-xs text-[var(--accent-strong)]">{bounceHistory.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {bounceHistory.length > 0 ? bounceHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{entry.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                        {entry.mode === 'stems' ? 'Stems' : 'Mix'} · {entry.scope} · {entry.normalization === 'peak' ? 'Peak safe' : 'Raw'} · {entry.tailMode}
                        {entry.masterSnapshotName ? ` · ${entry.masterSnapshotName}` : ''}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {new Date(entry.exportedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ActionButton
                      disabled={renderState.active}
                      icon={<Download className="h-3.5 w-3.5" />}
                      label="Repeat print"
                      onClick={() => void rerunBounceHistory(entry.id)}
                    />
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Print history will show the scope, output treatment, and mix state you trusted most recently, so repeating a known-good export becomes one action.
                </div>
              )}
            </div>
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
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Master Output</span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="section-label">Mix recall</span>
              <span className="font-mono text-xs text-[var(--accent-strong)]">
                {activeMasterSnapshot ? activeMasterSnapshot.name : 'Unsaved'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ActionButton
                disabled={renderState.active}
                icon={<Save className="h-3.5 w-3.5" />}
                label={activeMasterSnapshot ? 'Update current' : 'Save current'}
                onClick={() => saveMasterSnapshot(activeMasterSnapshot?.id ?? null)}
              />
              <ActionButton
                disabled={renderState.active || masterSnapshots.length === 0}
                icon={<Layers3 className="h-3.5 w-3.5" />}
                label="Store new"
                onClick={() => saveMasterSnapshot()}
              />
            </div>
            <div className="mt-3 grid gap-2">
              {masterSnapshots.length > 0 ? masterSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{snapshot.name}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                        Glue {Math.round(snapshot.settings.glueCompression * 100)} · Tone {Math.round(snapshot.settings.tone * 100)} · Gain {snapshot.settings.outputGain.toFixed(1)} dB
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {activeMasterSnapshot?.id === snapshot.id ? 'Live' : 'Stored'}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <ActionButton
                      disabled={renderState.active}
                      icon={<Gauge className="h-3.5 w-3.5" />}
                      label="Apply"
                      onClick={() => applyMasterSnapshot(snapshot.id)}
                    />
                    <ActionButton
                      disabled={renderState.active}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      label="Delete"
                      onClick={() => deleteMasterSnapshot(snapshot.id)}
                    />
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Save master states you trust, then flip between them while checking a section print. That is much safer than rebuilding a mix from memory.
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="section-label">Master profile</span>
              <span className="font-mono text-xs text-[var(--accent-strong)]">
                {activeMasterPreset ? activeMasterPreset.label : 'Custom'}
              </span>
            </div>
            <div className="mt-3 grid gap-3">
              {MASTER_PRESET_DEFINITIONS.map((preset) => (
                <button
                  key={preset.id}
                  className="rounded-2xl border px-4 py-3 text-left transition-colors"
                  data-active={activeMasterPreset?.id === preset.id}
                  onClick={() => setMasterSettings(preset.settings)}
                  style={{
                    background: activeMasterPreset?.id === preset.id ? 'rgba(114,217,255,0.08)' : 'rgba(255,255,255,0.02)',
                    borderColor: activeMasterPreset?.id === preset.id ? 'rgba(114,217,255,0.22)' : 'var(--border-soft)',
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                      {Math.round(preset.settings.glueCompression * 100)} glue
                    </span>
                  </div>
                  <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCell label="Output" value={`${master.outputGain.toFixed(1)} dB`} />
            <MetricCell label="Ceiling" value={`${master.limiterCeiling.toFixed(1)} dB`} />
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Glue compression</span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.glueCompression * 100)}</span>
              </div>
              <input
                className="mt-3"
                max="1"
                min="0"
                onChange={(event) => setMasterSettings({ glueCompression: Number(event.target.value) })}
                step="0.01"
                type="range"
                value={master.glueCompression}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Tone</span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.tone * 100)}</span>
              </div>
              <input
                className="mt-3"
                max="1"
                min="0"
                onChange={(event) => setMasterSettings({ tone: Number(event.target.value) })}
                step="0.01"
                type="range"
                value={master.tone}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Output gain</span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{master.outputGain.toFixed(1)} dB</span>
              </div>
              <input
                className="mt-3"
                max="12"
                min="-12"
                onChange={(event) => setMasterSettings({ outputGain: Number(event.target.value) })}
                step="0.5"
                type="range"
                value={master.outputGain}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Limiter ceiling</span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{master.limiterCeiling.toFixed(1)} dB</span>
              </div>
              <input
                className="mt-3"
                max="0"
                min="-1.2"
                onChange={(event) => setMasterSettings({ limiterCeiling: Number(event.target.value) })}
                step="0.05"
                type="range"
                value={master.limiterCeiling}
              />
            </div>
          </div>
          <div className="mt-4 text-[11px] leading-5 text-[var(--text-secondary)]">
            Bounce uses these master settings, so the output path is visible before you print a mix or stems.
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
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-field flex h-10 items-center gap-2 px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
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
