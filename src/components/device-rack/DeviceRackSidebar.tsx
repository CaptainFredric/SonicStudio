import React from 'react';
import { ChevronDown, ChevronUp, Disc3, Gauge, Play, Save, Trash2 } from 'lucide-react';

import { defaultNoteForTrack, type Track, type TrackSnapshot } from '../../project/schema';
import { Visualizer } from '../Visualizer';
import { InlineSlider, StatusCell } from './rackPrimitives';

interface DeviceRackSidebarProps {
  activeTrackSnapshot: TrackSnapshot | null;
  filterValue: string;
  isRecording: boolean;
  isSoundRecallOpen: boolean;
  matchingTrackSnapshots: TrackSnapshot[];
  motionSummary: string;
  onApplyTrackSnapshot: (snapshotId: string) => void;
  onDeleteTrackSnapshot: (snapshotId: string) => void;
  onPreviewTrack: (note?: string, sampleSliceIndex?: number) => Promise<void>;
  onSaveTrackSnapshot: (snapshotId?: string | null) => void;
  onToggleRecording: () => Promise<void>;
  onToggleSoundRecall: () => void;
  onUpdateTrackPan: (pan: number) => void;
  onUpdateTrackVolume: (volume: number) => void;
  patternNoteCount: number;
  track: Track;
  voiceLabel: string;
}

export const DeviceRackSidebar = ({
  activeTrackSnapshot,
  filterValue,
  isRecording,
  isSoundRecallOpen,
  matchingTrackSnapshots,
  motionSummary,
  onApplyTrackSnapshot,
  onDeleteTrackSnapshot,
  onPreviewTrack,
  onSaveTrackSnapshot,
  onToggleRecording,
  onToggleSoundRecall,
  onUpdateTrackPan,
  onUpdateTrackVolume,
  patternNoteCount,
  track,
  voiceLabel,
}: DeviceRackSidebarProps) => (
  <div className="flex min-h-[280px] flex-col justify-between border-b border-[var(--border-soft)] p-4 2xl:border-b-0 2xl:border-r 2xl:pr-4">
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-label">Selected track</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">Focus one lane and shape it here.</div>
        </div>
        <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          {track.type}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center border"
          style={{ background: `${track.color}12`, borderColor: `${track.color}44`, borderRadius: '4px', color: track.color }}
        >
          <Disc3 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {track.source.engine}
            </span>
            <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {voiceLabel}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
      <Visualizer />
    </div>

    <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onToggleSoundRecall}
        type="button"
      >
        <div>
          <div className="section-label">Sound recall</div>
          <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
            Store and reuse lane sounds.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {matchingTrackSnapshots.length}
          </span>
          {isSoundRecallOpen ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          )}
        </div>
      </button>

      {isSoundRecallOpen && (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              onClick={() => onSaveTrackSnapshot(activeTrackSnapshot?.id ?? null)}
              type="button"
            >
              <Save className="h-3.5 w-3.5" />
              {activeTrackSnapshot ? 'Update current sound' : 'Store current sound'}
            </button>
            {activeTrackSnapshot && (
              <div className="rounded-[8px] bg-[rgba(114,217,255,0.08)] px-3 py-2 text-[11px] text-[var(--accent-strong)]">
                Active recall: {activeTrackSnapshot.name}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            {matchingTrackSnapshots.length > 0 ? matchingTrackSnapshots.slice(-4).reverse().map((snapshot) => (
              <div key={snapshot.id} className="rounded-[8px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">{snapshot.name}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {new Date(snapshot.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                      onClick={() => onApplyTrackSnapshot(snapshot.id)}
                      title="Apply sound recall"
                      type="button"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="ghost-icon-button flex h-8 w-8 items-center justify-center text-[var(--danger)]"
                      onClick={() => onDeleteTrackSnapshot(snapshot.id)}
                      title="Delete sound recall"
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
                No saved sounds for this lane type yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <button
          className="control-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] hover:text-[var(--text-primary)]"
          onClick={() => void onPreviewTrack(
            defaultNoteForTrack(track),
            typeof track.source.activeSampleSlice === 'number' ? track.source.activeSampleSlice : undefined,
          )}
          type="button"
        >
          <Play className="h-3.5 w-3.5" />
          Audition
        </button>
        <button
          className={`control-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${isRecording ? 'text-[var(--danger)]' : 'hover:text-[var(--text-primary)]'}`}
          onClick={() => void onToggleRecording()}
          type="button"
        >
          <Gauge className="h-3.5 w-3.5" />
          {isRecording ? 'Stop print' : 'Print'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <InlineSlider
          label="Channel level"
          max={6}
          min={-60}
          onChange={onUpdateTrackVolume}
          step={1}
          unit="dB"
          value={track.volume}
        />
        <InlineSlider
          label="Pan"
          max={1}
          min={-1}
          onChange={onUpdateTrackPan}
          step={0.1}
          value={track.pan}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <StatusCell label="Voice" value={voiceLabel} />
        <StatusCell label="Filter" value={filterValue} />
        <StatusCell label="Pattern notes" value={`${patternNoteCount}`} />
        <StatusCell label={track.source.engine === 'sample' ? 'Sample mode' : 'Motion'} value={motionSummary} />
      </div>
    </div>
  </div>
);
