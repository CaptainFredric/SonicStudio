import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Gauge,
  Layers3,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { useAudio, type BounceNormalizationMode, type BounceTailMode } from '../../context/AudioContext';
import { SESSION_TEMPLATE_DEFINITIONS } from '../../project/schema';
import { type ExportScope } from '../../services/workflowTypes';
import { RENDER_TARGET_PROFILES, type RenderTargetProfileId } from '../../utils/export';
import { ActionButton, MetricCell, SegmentButton, ShortcutRow } from './SettingsPrimitives';

const PATTERN_OPTIONS = [2, 4, 6, 8];
const STEP_OPTIONS = [8, 16, 32, 64];

const BOUNCE_NORMALIZATION_OPTIONS: Array<{ description: string; label: string; value: BounceNormalizationMode }> = [
  { description: 'Keep the raw bounce level exactly as the current master path produced it.', label: 'Raw', value: 'none' },
  { description: 'Lift the bounce safely toward a cleaner peak reference without clipping.', label: 'Peak safe', value: 'peak' },
  { description: 'Aim the print toward a chosen loudness profile and grade how close it landed.', label: 'Target', value: 'target' },
];

const BOUNCE_TAIL_OPTIONS: Array<{ description: string; label: string; value: BounceTailMode }> = [
  { description: 'Fast print for dry or tightly gated phrases.', label: 'Short', value: 'short' },
  { description: 'General purpose tail for most references and revisions.', label: 'Standard', value: 'standard' },
  { description: 'Longer print for pad wash, delay, and reverb decay.', label: 'Long', value: 'long' },
];

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

export const WorkspaceSettingsPanel = () => {
  const {
    arrangerClips,
    bpm,
    bounceHistory,
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    exportSession,
    importMidiSession,
    importSession,
    lastSavedAt,
    loadSessionTemplate,
    loopRangeEndBeat,
    loopRangeStartBeat,
    newSession,
    patternCount,
    projectCheckpoints,
    renderState,
    rerunBounceHistory,
    restoreCheckpoint,
    saveProject,
    saveCheckpoint,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    setSelectedTrackId,
    setBpm,
    setPatternCount,
    setStepsPerPattern,
    setTransportMode,
    songLengthInBeats,
    songMarkers,
    stepsPerPattern,
    tracks,
    transportMode,
    deleteCheckpoint,
  } = useAudio();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiFileInputRef = useRef<HTMLInputElement>(null);
  const [bounceScope, setBounceScope] = useState<ExportScope>(transportMode === 'SONG' ? 'song' : 'pattern');
  const [bounceNormalization, setBounceNormalization] = useState<BounceNormalizationMode>('peak');
  const [bounceTailMode, setBounceTailMode] = useState<BounceTailMode>('standard');
  const [targetProfileId, setTargetProfileId] = useState<RenderTargetProfileId>('streaming');
  const [trackQuery, setTrackQuery] = useState('');
  const hasLoopWindow = loopRangeStartBeat !== null && loopRangeEndBeat !== null;
  const filteredTracks = tracks.filter((track) => {
    const normalizedQuery = trackQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    return track.name.toLowerCase().includes(normalizedQuery) || track.type.toLowerCase().includes(normalizedQuery);
  }).slice(0, 8);

  useEffect(() => {
    setBounceScope((current) => (
      current === 'clip-window' || (current === 'loop-window' && hasLoopWindow)
        ? current
        : transportMode === 'SONG' ? 'song' : 'pattern'
    ));
  }, [hasLoopWindow, transportMode]);

  return (
    <>
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
      <input
        ref={midiFileInputRef}
        accept=".mid,.midi,audio/midi,audio/x-midi"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          await importMidiSession(file);
          event.target.value = '';
        }}
        type="file"
      />

      <section className="surface-panel-strong p-4">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <span className="section-label">Session</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
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
            These scenes replace the current session immediately. Save a checkpoint first if you want a way back.
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
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
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
          {bounceNormalization === 'target' ? (
            <div>
              <div className="section-label">Print target</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {RENDER_TARGET_PROFILES.map((profile) => (
                  <React.Fragment key={profile.id}>
                    <SegmentButton
                      active={targetProfileId === profile.id}
                      label={profile.label}
                      onClick={() => setTargetProfileId(profile.id)}
                    />
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {(() => {
                  const profile = RENDER_TARGET_PROFILES.find((candidate) => candidate.id === targetProfileId);
                  if (!profile) {
                    return '';
                  }

                  return `${profile.description} Aim for about ${profile.targetLufs.toFixed(1)} LUFS and ${profile.peakTargetDb.toFixed(1)} dBFS peak.`;
                })()}
              </div>
              {(() => {
                const profile = RENDER_TARGET_PROFILES.find((candidate) => candidate.id === targetProfileId);
                if (!profile) {
                  return null;
                }

                return (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <MetricCell label="Loudness" value={`${profile.targetLufs.toFixed(1)} LUFS`} />
                    <MetricCell label="Peak ceiling" value={`${profile.peakTargetDb.toFixed(1)} dBFS`} />
                    <MetricCell label="Crest window" value={`${profile.crestRangeDb[0].toFixed(0)} to ${profile.crestRangeDb[1].toFixed(0)} dB`} />
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton disabled={renderState.active} icon={<Sparkles className="h-3.5 w-3.5" />} label="New session" onClick={newSession} />
          <ActionButton disabled={renderState.active} icon={<Layers3 className="h-3.5 w-3.5" />} label="Save now" onClick={saveProject} />
          <ActionButton disabled={renderState.active} icon={<Save className="h-3.5 w-3.5" />} label="Checkpoint" onClick={() => saveCheckpoint()} />
          <ActionButton disabled={renderState.active} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load JSON" onClick={() => fileInputRef.current?.click()} />
          <ActionButton disabled={renderState.active} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Import MIDI" onClick={() => midiFileInputRef.current?.click()} />
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
              targetProfileId,
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
              targetProfileId,
            })}
          />
          <ActionButton
            disabled={
              renderState.active
              || (bounceScope === 'clip-window' && !selectedArrangerClipId)
              || (bounceScope === 'loop-window' && !hasLoopWindow)
            }
            icon={<Download className="h-3.5 w-3.5" />}
            label="Export MIDI"
            onClick={() => void exportMidi(bounceScope)}
          />
          <ActionButton disabled={renderState.active} icon={<Layers3 className="h-3.5 w-3.5" />} label="Export JSON" onClick={exportSession} />
        </div>
        <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
          Mixes and stems render offline before encoding, so timing and analysis come from the full audio buffer.
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="section-label">Recovery points</span>
            <span className="font-mono text-xs text-[var(--accent-strong)]">{projectCheckpoints.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {projectCheckpoints.length > 0 ? projectCheckpoints.map((checkpoint) => (
              <div key={checkpoint.id} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{checkpoint.label}</div>
                    <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                      {checkpoint.projectName} · {new Date(checkpoint.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {new Date(checkpoint.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ActionButton disabled={renderState.active} icon={<Save className="h-3.5 w-3.5" />} label="Restore" onClick={() => { restoreCheckpoint(checkpoint.id); }} />
                  <ActionButton disabled={renderState.active} icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" onClick={() => deleteCheckpoint(checkpoint.id)} />
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
                Save a checkpoint before big edits, imports, or arrangement surgery.
              </div>
            )}
          </div>
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
                      {entry.mode === 'stems' ? 'Stems' : 'Mix'} · {entry.scope} · {entry.normalization === 'peak' ? 'Peak safe' : entry.normalization === 'target' ? `Target ${entry.targetLabel ?? 'Streaming'}` : 'Raw'} · {entry.tailMode}
                      {entry.masterSnapshotName ? ` · ${entry.masterSnapshotName}` : ''}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {new Date(entry.exportedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {entry.quality && entry.peakDb !== undefined && entry.rmsDb !== undefined && entry.sampleRate ? (
                  <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
                        style={{
                          borderColor: entry.quality === 'hot' ? 'rgba(248,113,113,0.32)' : entry.quality === 'quiet' ? 'rgba(251,191,36,0.32)' : 'rgba(114,217,255,0.26)',
                          color: entry.quality === 'hot' ? '#fca5a5' : entry.quality === 'quiet' ? '#fde68a' : '#b6f1ff',
                        }}
                      >
                        {entry.quality === 'hot' ? 'Hot print' : entry.quality === 'quiet' ? 'Quiet print' : 'Clean print'}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Peak {entry.peakDb.toFixed(1)} dBFS · RMS {entry.rmsDb.toFixed(1)} dBFS
                      </span>
                      {entry.estimatedLufs !== undefined ? (
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Loudness {entry.estimatedLufs.toFixed(1)} LUFS
                        </span>
                      ) : null}
                      {entry.crestDb !== undefined ? (
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Crest {entry.crestDb.toFixed(1)} dB
                        </span>
                      ) : null}
                    </div>
                    {entry.targetVerdict ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
                          style={{
                            borderColor: entry.targetVerdict === 'aligned'
                              ? 'rgba(114,217,255,0.26)'
                              : entry.targetVerdict === 'loud'
                                ? 'rgba(248,113,113,0.32)'
                                : entry.targetVerdict === 'soft'
                                  ? 'rgba(251,191,36,0.32)'
                                  : 'rgba(167,139,250,0.32)',
                            color: entry.targetVerdict === 'aligned'
                              ? '#b6f1ff'
                              : entry.targetVerdict === 'loud'
                                ? '#fca5a5'
                                : entry.targetVerdict === 'soft'
                                  ? '#fde68a'
                                  : '#ddd6fe',
                          }}
                        >
                          {entry.targetVerdict === 'aligned'
                            ? 'On target'
                            : entry.targetVerdict === 'loud'
                              ? 'Too loud'
                              : entry.targetVerdict === 'soft'
                                ? 'Too soft'
                                : entry.targetVerdict === 'flat'
                                  ? 'Too flat'
                                  : 'Too spiky'}
                        </span>
                        {entry.targetDeltaDb !== undefined ? (
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {entry.targetLufsDelta !== undefined
                              ? `${entry.targetLufsDelta > 0 ? '+' : ''}${entry.targetLufsDelta.toFixed(1)} LUFS vs target`
                              : `${entry.targetDeltaDb > 0 ? '+' : ''}${entry.targetDeltaDb.toFixed(1)} dB vs target`}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      {entry.durationSeconds ? `${entry.durationSeconds.toFixed(1)}s` : 'Unknown length'} · {Math.round(entry.sampleRate / 100) / 10} kHz
                      {entry.recommendation
                        ? ` · ${entry.recommendation}`
                        : entry.quality === 'hot'
                          ? ' · reduce output gain or widen headroom before reprinting'
                          : entry.quality === 'quiet'
                            ? ' · consider more output gain or stronger glue before sharing this print'
                            : ' · headroom and loudness look usable for a reference print'}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3">
                  <ActionButton disabled={renderState.active} icon={<Download className="h-3.5 w-3.5" />} label="Repeat print" onClick={() => void rerunBounceHistory(entry.id)} />
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
                Repeat a previous print with the same scope, treatment, and mix state in one action.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="surface-panel-strong p-4">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Search className="h-4 w-4 text-[var(--accent)]" />
          <span className="section-label">Track jump</span>
        </div>
        <input
          aria-label="Track jump"
          className="control-field mt-4 h-11 w-full px-3 text-sm"
          onChange={(event) => setTrackQuery(event.target.value)}
          placeholder="Find a track by name or type"
          value={trackQuery}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredTracks.length > 0 ? filteredTracks.map((track) => (
            <button
              className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-active={selectedTrackId === track.id}
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              type="button"
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
    </>
  );
};
