import React, { type ReactNode } from 'react';
import { Download } from 'lucide-react';

import type { BounceNormalizationMode, BounceTailMode } from '../../context/AudioContext';
import { type ExportScope } from '../../services/workflowTypes';
import { RENDER_TARGET_PROFILES, type RenderTargetProfileId } from '../../utils/export';
import { ActionButton, MetricCell, SegmentButton } from './SettingsPrimitives';

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

interface BounceHistoryEntryView {
  crestDb?: number;
  durationSeconds?: number;
  estimatedLufs?: number;
  exportedAt: string;
  id: string;
  label: string;
  masterSnapshotName?: string | null;
  mode: 'mix' | 'stems';
  normalization: BounceNormalizationMode;
  peakDb?: number;
  quality?: 'clean' | 'hot' | 'quiet';
  recommendation?: string;
  rmsDb?: number;
  sampleRate?: number;
  scope: ExportScope;
  tailMode: BounceTailMode;
  targetDeltaDb?: number;
  targetLabel?: string;
  targetLufsDelta?: number;
  targetVerdict?: 'aligned' | 'loud' | 'soft' | 'flat' | 'spiky';
}

interface WorkspaceBouncePanelProps {
  bounceHistory: BounceHistoryEntryView[];
  bounceNormalization: BounceNormalizationMode;
  bounceScope: ExportScope;
  bounceTailMode: BounceTailMode;
  canUseClipWindow: boolean;
  canUseLoopWindow: boolean;
  exportAudioMix: () => void;
  exportMidi: () => void;
  exportSession: () => void;
  exportTrackStems: () => void;
  hasLoopWindow: boolean;
  onBounceNormalizationChange: (value: BounceNormalizationMode) => void;
  onBounceScopeChange: (value: ExportScope) => void;
  onBounceTailModeChange: (value: BounceTailMode) => void;
  onRepeatPrint: (entryId: string) => void;
  onTargetProfileChange: (value: RenderTargetProfileId) => void;
  renderPhase: string;
  renderProgress: number;
  renderTrackName: string | null;
  renderMode: 'mix' | 'stems' | null;
  targetProfileId: RenderTargetProfileId;
}

const qualityChip = (entry: BounceHistoryEntryView): ReactNode => (
  <span
    className="rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
    style={{
      borderColor: entry.quality === 'hot' ? 'rgba(248,113,113,0.32)' : entry.quality === 'quiet' ? 'rgba(251,191,36,0.32)' : 'rgba(114,217,255,0.26)',
      color: entry.quality === 'hot' ? '#fca5a5' : entry.quality === 'quiet' ? '#fde68a' : '#b6f1ff',
    }}
  >
    {entry.quality === 'hot' ? 'Hot print' : entry.quality === 'quiet' ? 'Quiet print' : 'Clean print'}
  </span>
);

export const WorkspaceBouncePanel = ({
  bounceHistory,
  bounceNormalization,
  bounceScope,
  bounceTailMode,
  canUseClipWindow,
  canUseLoopWindow,
  exportAudioMix,
  exportMidi,
  exportSession,
  exportTrackStems,
  hasLoopWindow,
  onBounceNormalizationChange,
  onBounceScopeChange,
  onBounceTailModeChange,
  onRepeatPrint,
  onTargetProfileChange,
  renderMode,
  renderPhase,
  renderProgress,
  renderTrackName,
  targetProfileId,
}: WorkspaceBouncePanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Download className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Bounce and Export</span>
    </div>
    {renderMode ? (
      <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">{renderMode === 'stems' ? 'Stem bounce' : 'Mix bounce'}</span>
          <span className="font-mono text-xs text-[var(--accent-strong)]">{Math.round(renderProgress * 100)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(114,217,255,0.55),rgba(223,246,255,0.92))]"
            style={{ width: `${Math.round(renderProgress * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          {renderTrackName ? `${renderPhase} · ${renderTrackName}` : renderPhase}
        </div>
      </div>
    ) : null}

    <div className="mt-4">
      <div className="section-label">Bounce range</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <SegmentButton active={bounceScope === 'pattern'} label="Pattern" onClick={() => onBounceScopeChange('pattern')} />
        <SegmentButton active={bounceScope === 'song'} label="Song" onClick={() => onBounceScopeChange('song')} />
        <SegmentButton active={bounceScope === 'loop-window'} label="Loop window" onClick={() => { if (hasLoopWindow) onBounceScopeChange('loop-window'); }} />
        <SegmentButton active={bounceScope === 'clip-window'} label="Clip window" onClick={() => { if (canUseClipWindow) onBounceScopeChange('clip-window'); }} />
      </div>
      <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
        {bounceScope === 'clip-window'
          ? canUseClipWindow
            ? 'Bounce the currently selected song clip range across the full session mix.'
            : 'Select a song clip first if you want to print a focused range.'
          : bounceScope === 'loop-window'
            ? canUseLoopWindow
              ? 'Bounce the active loop span so section revisions print quickly.'
              : 'Set a loop span first if you want a section print.'
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
                onClick={() => onBounceNormalizationChange(option.value)}
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
                onClick={() => onBounceTailModeChange(option.value)}
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
                  onClick={() => onTargetProfileChange(profile.id)}
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
      <ActionButton disabled={renderMode !== null || (bounceScope === 'clip-window' && !canUseClipWindow) || (bounceScope === 'loop-window' && !canUseLoopWindow)} icon={<Download className="h-3.5 w-3.5" />} label={renderMode === 'mix' ? 'Printing mix' : 'Bounce WAV'} onClick={exportAudioMix} />
      <ActionButton disabled={renderMode !== null || (bounceScope === 'clip-window' && !canUseClipWindow) || (bounceScope === 'loop-window' && !canUseLoopWindow)} icon={<Download className="h-3.5 w-3.5" />} label={renderMode === 'stems' ? 'Printing stems' : 'Export stems'} onClick={exportTrackStems} />
      <ActionButton disabled={renderMode !== null || (bounceScope === 'clip-window' && !canUseClipWindow) || (bounceScope === 'loop-window' && !canUseLoopWindow)} icon={<Download className="h-3.5 w-3.5" />} label="Export MIDI" onClick={exportMidi} />
      <ActionButton disabled={renderMode !== null} icon={<Download className="h-3.5 w-3.5" />} label="Export JSON" onClick={exportSession} />
    </div>

    <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
      Mixes and stems render offline before encoding, so timing and analysis come from the full audio buffer.
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
                  {qualityChip(entry)}
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
              <ActionButton disabled={renderMode !== null} icon={<Download className="h-3.5 w-3.5" />} label="Repeat print" onClick={() => onRepeatPrint(entry.id)} />
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
);
