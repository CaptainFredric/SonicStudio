import React from 'react';

import type { ArrangementClip, SongMarker } from '../../../project/schema';
import type { LaneSection, LaneSectionKey, SectionRange } from '../types';

interface SongToolsPanelProps {
  collapsedGroups: Record<LaneSectionKey, boolean>;
  createSongMarker: (beat: number, name: string) => void;
  currentStep: number;
  duplicateSongRange: (startBeat: number, endBeat: number, label: string) => void;
  laneSections: LaneSection[];
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  markerCount: number;
  onJumpToBoundary: (step: number) => void;
  onRemoveSongMarker: (markerId: string) => void;
  onSetLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  onToggleCollapsedGroup: (key: LaneSectionKey) => void;
  onUpdateSongMarker: (markerId: string, updates: Partial<SongMarker>) => void;
  sectionRanges: SectionRange[];
  selectedClip: ArrangementClip | null;
  songMarkers: SongMarker[];
}

export const SongToolsPanel = ({
  collapsedGroups,
  createSongMarker,
  currentStep,
  duplicateSongRange,
  laneSections,
  loopRangeEndBeat,
  loopRangeStartBeat,
  markerCount,
  onJumpToBoundary,
  onRemoveSongMarker,
  onSetLoopRange,
  onToggleCollapsedGroup,
  onUpdateSongMarker,
  sectionRanges,
  selectedClip,
  songMarkers,
}: SongToolsPanelProps) => (
  <div className="space-y-4 pt-4">
    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Lane groups</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Collapse or reopen lane families.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {laneSections.length} groups
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {laneSections.map(({ key, label, lanes }) => (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            key={key}
            onClick={() => onToggleCollapsedGroup(key)}
          >
            {collapsedGroups[key] ? `Show ${label}` : `Hide ${label}`} · {lanes.length}
          </button>
        ))}
      </div>
    </div>

    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Marker actions</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Edit marker names and jump points.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {markerCount} total
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => createSongMarker(currentStep, `Step ${currentStep + 1}`)}
        >
          Mark playhead
        </button>
        {selectedClip && (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => createSongMarker(selectedClip.startBeat, `Clip ${selectedClip.patternIndex + 1}`)}
          >
            Mark clip start
          </button>
        )}
      </div>
      <div className="mt-4 space-y-2">
        {songMarkers.length === 0 ? (
          <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
            Add markers from the playhead or selected clip.
          </div>
        ) : songMarkers.map((marker) => (
          <div key={marker.id} className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                className="control-field h-9 flex-1 px-3 text-xs font-medium"
                onChange={(event) => onUpdateSongMarker(marker.id, { name: event.target.value })}
                value={marker.name}
              />
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => onJumpToBoundary(marker.beat)}
              >
                Jump
              </button>
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                onClick={() => onRemoveSongMarker(marker.id)}
              >
                Drop
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
              <span>Step {marker.beat + 1}</span>
              <input
                className="control-field h-8 w-24 px-2 text-right font-mono text-xs"
                min={0}
                onChange={(event) => onUpdateSongMarker(marker.id, { beat: Number(event.target.value) })}
                type="number"
                value={marker.beat}
              />
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">Sections</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            Jump, loop, and duplicate song sections.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {sectionRanges.length} total
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {sectionRanges.map((section) => (
          <div key={section.id} className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{section.label}</div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Steps {section.startBeat + 1} to {section.endBeat} · {section.clipCount} clip{section.clipCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => onJumpToBoundary(section.startBeat)}
                >
                  Jump
                </button>
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-active={loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat}
                  onClick={() => {
                    if (loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat) {
                      onSetLoopRange(null, null);
                      return;
                    }

                    onSetLoopRange(section.startBeat, section.endBeat);
                  }}
                >
                  {loopRangeStartBeat === section.startBeat && loopRangeEndBeat === section.endBeat ? 'Looping' : 'Loop'}
                </button>
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => duplicateSongRange(section.startBeat, section.endBeat, section.label)}
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
