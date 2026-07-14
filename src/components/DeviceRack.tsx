import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Layers3,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from 'lucide-react';

import { getSamplePresetMeta, getSamplePresetOptions } from '../audio/sampleLibrary';
import { readString, writeString } from '../utils/safeStorage';
import { useAudio } from '../context/AudioContext';
import { defaultNoteForTrack, getTrackVoicePresetDefinitions, type SampleSliceMemory } from '../project/schema';
import { filterLabel, type RackView, waveformLabel } from './device-rack/rackPrimitives';
import { DeviceRackShapePanel } from './device-rack/DeviceRackShapePanel';
import { DeviceRackSidebar } from './device-rack/DeviceRackSidebar';
import { DeviceRackSourcePanel } from './device-rack/DeviceRackSourcePanel';
import { DeviceRackSpacePanel } from './device-rack/DeviceRackSpacePanel';
import { revealStudioEditor } from './studioViewport';

const RACK_COLLAPSED_KEY = 'sonicstudio:deviceRack:collapsed';
const RACK_HEIGHT_KEY = 'sonicstudio:deviceRack:height';
const RACK_VIEW_KEY = 'sonicstudio:deviceRack:view';
const RACK_SOURCE_VIEW_KEY = 'sonicstudio:deviceRack:sourceView';
const RACK_MIN_HEIGHT = 150;
const RACK_MAX_HEIGHT = 660;
// Kept modest so the view above keeps a usable height by default; the rack
// scrolls internally and stays drag-resizable up to RACK_MAX_HEIGHT.
const RACK_DEFAULT_HEIGHT = 210;

const isRackView = (value: unknown): value is RackView => (
  value === 'SOURCE' || value === 'SHAPE' || value === 'SPACE'
);

const readInitialCollapsed = () => {
  const raw = readString(RACK_COLLAPSED_KEY);
  return raw === null ? true : raw === '1';
};

const readInitialHeight = () => {
  const raw = readString(RACK_HEIGHT_KEY);
  if (!raw) return RACK_DEFAULT_HEIGHT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return RACK_DEFAULT_HEIGHT;
  return Math.min(RACK_MAX_HEIGHT, Math.max(RACK_MIN_HEIGHT, Math.round(parsed)));
};

const readRackView = (): RackView => {
  const raw = readString(RACK_VIEW_KEY);
  return isRackView(raw) ? raw : 'SOURCE';
};

const readSourceView = () => (
  readString(RACK_SOURCE_VIEW_KEY) === 'SLICES' ? 'SLICES' : 'CORE'
);

const makeEvenSlices = (parts: number): SampleSliceMemory[] => (
  Array.from({ length: parts }, (_, index) => {
    const start = index / parts;
    const end = (index + 1) / parts;
    return {
      end,
      gain: 1,
      label: `Slice ${index + 1}`,
      reverse: false,
      start,
    };
  })
);

const REGION_TEMPLATE: SampleSliceMemory[] = [
  { end: 0.25, gain: 1, label: 'Attack', reverse: false, start: 0 },
  { end: 0.64, gain: 1, label: 'Body', reverse: false, start: 0.22 },
  { end: 1, gain: 1, label: 'Tail', reverse: false, start: 0.58 },
];

export const DeviceRack = () => {
  const {
    applyTrackSnapshot,
    applyTrackVoicePreset,
    auditionTrackVoicePreset,
    createSampleSlice,
    currentPattern,
    deleteSampleSlice,
    deleteTrackSnapshot,
    isRecording,
    previewTrack,
    saveTrackSnapshot,
    selectSampleSlice,
    selectedTrackId,
    setTrackParams,
    setTrackSource,
    toggleRecording,
    trackSnapshots,
    tracks,
    updateSampleSlice,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();
  const [activeRackView, setActiveRackView] = useState<RackView>(readRackView);
  const [activeSourceSubView, setActiveSourceSubView] = useState<'CORE' | 'SLICES'>(readSourceView);
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);
  const [rackHeight, setRackHeight] = useState<number>(readInitialHeight);
  const [sampleStatus, setSampleStatus] = useState<string | null>(null);
  const [isSoundRecallOpen, setSoundRecallOpen] = useState(false);
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const expandedRackRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;

  useEffect(() => {
    writeString(RACK_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    writeString(RACK_HEIGHT_KEY, String(rackHeight));
  }, [rackHeight]);

  useEffect(() => {
    writeString(RACK_VIEW_KEY, activeRackView);
    writeString(RACK_SOURCE_VIEW_KEY, activeSourceSubView);
  }, [activeRackView, activeSourceSubView]);

  useEffect(() => {
    if (collapsed) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      expandedRackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [collapsed]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const clientY = 'touches' in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
      dragStateRef.current = { startY: clientY, startHeight: rackHeight };
      event.preventDefault();

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const moveClientY = 'touches' in moveEvent
          ? moveEvent.touches[0]?.clientY ?? state.startY
          : (moveEvent as MouseEvent).clientY;
        const delta = state.startY - moveClientY;
        const next = Math.min(RACK_MAX_HEIGHT, Math.max(RACK_MIN_HEIGHT, state.startHeight + delta));
        setRackHeight(next);
      };
      const onEnd = () => {
        dragStateRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    },
    [rackHeight],
  );

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setRackHeight((current) => Math.min(RACK_MAX_HEIGHT, current + (event.shiftKey ? 32 : 12)));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setRackHeight((current) => Math.max(RACK_MIN_HEIGHT, current - (event.shiftKey ? 32 : 12)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRackHeight(RACK_DEFAULT_HEIGHT);
    }
  }, []);

  const trackVoicePresets = useMemo(
    () => (track ? getTrackVoicePresetDefinitions(track.type) : []),
    [track],
  );

  const sampleOptions = useMemo(
    () => (track ? getSamplePresetOptions(track.type) : []),
    [track],
  );

  if (!track) {
    return (
      <section className="surface-panel flex items-center justify-center py-6 md:h-[68px] md:shrink-0 md:py-0">
        <div className="text-center">
          <div className="section-label">Sound desk</div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Select a lane to shape its instrument, samples, and effects.</p>
        </div>
      </section>
    );
  }

  const selectedSliceIndex = typeof track.source.activeSampleSlice === 'number'
    ? track.source.activeSampleSlice
    : null;
  const selectedSampleSlice = selectedSliceIndex !== null
    ? track.source.sampleSlices[selectedSliceIndex] ?? null
    : null;
  const activeSampleMeta = track.source.customSampleName
    ? {
        description: 'Custom audio source stored with this project.',
        label: track.source.customSampleName,
      }
    : getSamplePresetMeta(track.source.samplePreset);
  const sampleWindowWidth = Math.max(0.05, track.source.sampleEnd - track.source.sampleStart);
  const voiceLabel = track.source.engine === 'sample'
    ? track.source.customSampleName ?? activeSampleMeta.label
    : waveformLabel(track.source.waveform);
  const patternNoteCount = (track.patterns[currentPattern] ?? []).reduce((sum, step) => sum + step.length, 0);
  const triggerModeLabel = track.source.sampleTriggerMode === 'active-slice'
    ? 'Active slice'
    : track.source.sampleTriggerMode === 'step-mapped'
      ? 'Step mapped'
      : 'Full source';
  const motionSummary = track.source.engine === 'sample'
    ? triggerModeLabel
    : `${track.params.vibratoRate.toFixed(1)} Hz vibrato`;
  const matchingTrackSnapshots = trackSnapshots.filter((snapshot) => snapshot.trackType === track.type);

  const setView = (view: RackView) => {
    setActiveRackView(view);
    setCollapsed(false);
  };

  const applyCurrentWindowAsSlice = () => {
    const nextSlice: SampleSliceMemory = {
      end: track.source.sampleEnd,
      gain: track.source.sampleGain,
      label: selectedSampleSlice?.label ?? `Slice ${track.source.sampleSlices.length + 1}`,
      reverse: track.source.sampleReverse,
      start: track.source.sampleStart,
    };

    if (selectedSliceIndex !== null && selectedSampleSlice) {
      updateSampleSlice(track.id, selectedSliceIndex, nextSlice);
      setSampleStatus(`Updated ${nextSlice.label}`);
      return;
    }

    createSampleSlice(track.id, nextSlice);
    setSampleStatus(`Saved ${nextSlice.label}`);
  };

  const applyEvenSplit = (parts: number) => {
    setTrackSource(track.id, {
      activeSampleSlice: 0,
      sampleSlices: makeEvenSlices(parts),
      sampleTriggerMode: 'step-mapped',
    });
    setSampleStatus(`Created ${parts} slices`);
  };

  const applyRegionTemplate = () => {
    setTrackSource(track.id, {
      activeSampleSlice: 0,
      sampleSlices: REGION_TEMPLATE,
      sampleTriggerMode: 'step-mapped',
    });
    setSampleStatus('Created Attack, Body, and Tail slices');
  };

  if (collapsed) {
    return (
      <section className="surface-panel device-rack-panel px-4 py-2 md:shrink-0">
        <div className="flex flex-wrap items-start gap-3">
          <button
            aria-expanded="false"
            aria-label="Expand sound desk"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={() => setCollapsed(false)}
            title="Open sound desk"
            type="button"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            {/* Collapsed: a single compact line. The Voice/Filter/Mode chips
                live in the expanded desk so the minimised state stays slim. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="section-label">Sound desk</span>
              <span className="text-sm font-medium leading-5 text-[var(--text-primary)]">{track.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {voiceLabel} · Vol {track.volume.toFixed(0)}
              </span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <RackModeButton active={activeRackView === 'SOURCE'} icon={<Waves className="h-3.5 w-3.5" />} label="Source" onClick={() => setView('SOURCE')} />
            <RackModeButton active={activeRackView === 'SHAPE'} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Shape" onClick={() => setView('SHAPE')} />
            <RackModeButton active={activeRackView === 'SPACE'} icon={<Sparkles className="h-3.5 w-3.5" />} label="Space" onClick={() => setView('SPACE')} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={expandedRackRef}
      className="surface-panel device-rack-panel relative p-3 md:h-[var(--rack-height)] md:shrink-0 md:overflow-auto"
      data-expanded="true"
      style={{ '--rack-height': `${rackHeight}px` } as React.CSSProperties}
    >
      <div
        aria-label="Resize sound desk"
        aria-orientation="horizontal"
        aria-valuemax={RACK_MAX_HEIGHT}
        aria-valuemin={RACK_MIN_HEIGHT}
        aria-valuenow={rackHeight}
        className="group absolute inset-x-0 top-0 z-20 hidden h-3 cursor-ns-resize items-center justify-center md:flex"
        onKeyDown={handleResizeKeyDown}
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        role="separator"
        tabIndex={0}
        title="Resize sound desk"
      >
        <GripHorizontal className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />
      </div>

      <button
        aria-expanded="true"
        aria-label="Collapse sound desk"
        className="ghost-icon-button absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center"
        onClick={() => {
          setCollapsed(true);
          revealStudioEditor();
        }}
        title="Collapse sound desk"
        type="button"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <div className="grid gap-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <DeviceRackSidebar
          activeTrackSnapshot={null}
          filterValue={filterLabel(track.params.filterMode)}
          isRecording={isRecording}
          isSoundRecallOpen={isSoundRecallOpen}
          matchingTrackSnapshots={matchingTrackSnapshots}
          motionSummary={motionSummary}
          onApplyTrackSnapshot={(snapshotId) => applyTrackSnapshot(track.id, snapshotId)}
          onDeleteTrackSnapshot={deleteTrackSnapshot}
          onPreviewTrack={(note, sampleSliceIndex) => previewTrack(track.id, note ?? defaultNoteForTrack(track), sampleSliceIndex)}
          onSaveTrackSnapshot={(snapshotId) => saveTrackSnapshot(track.id, snapshotId ?? null)}
          onToggleRecording={toggleRecording}
          onToggleSoundRecall={() => setSoundRecallOpen((current) => !current)}
          onUpdateTrackPan={(pan) => updateTrackPan(track.id, pan)}
          onUpdateTrackVolume={(volume) => updateTrackVolume(track.id, volume)}
          patternNoteCount={patternNoteCount}
          track={track}
          voiceLabel={voiceLabel}
        />

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3 pr-10">
            <div>
              <div className="section-label">Sound workbench</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Source, tone, and space for the selected lane.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RackModeButton active={activeRackView === 'SOURCE'} icon={<Waves className="h-3.5 w-3.5" />} label="Source" onClick={() => setActiveRackView('SOURCE')} />
              <RackModeButton active={activeRackView === 'SHAPE'} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Shape" onClick={() => setActiveRackView('SHAPE')} />
              <RackModeButton active={activeRackView === 'SPACE'} icon={<Layers3 className="h-3.5 w-3.5" />} label="Space" onClick={() => setActiveRackView('SPACE')} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-visible 2xl:overflow-auto">
            {activeRackView === 'SOURCE' ? (
              <DeviceRackSourcePanel
                activeSampleMeta={activeSampleMeta}
                activeSourceSubView={activeSourceSubView}
                fileInputRef={fileInputRef}
                isSampleTrack={track.source.engine === 'sample'}
                onApplyCurrentWindowAsSlice={applyCurrentWindowAsSlice}
                onApplyEvenSplit={applyEvenSplit}
                onApplyRegionTemplate={applyRegionTemplate}
                onApplyTrackVoicePreset={(presetId) => applyTrackVoicePreset(track.id, presetId)}
                onAuditionTrackVoicePreset={(presetId) => { void auditionTrackVoicePreset(track.id, presetId); }}
                onCreateSampleSlice={(slice) => createSampleSlice(track.id, slice)}
                onDeleteSampleSlice={(sliceIndex) => deleteSampleSlice(track.id, sliceIndex)}
                onPreviewTrack={(note, sampleSliceIndex) => previewTrack(track.id, note ?? defaultNoteForTrack(track), sampleSliceIndex)}
                onSelectSampleSlice={(sliceIndex) => selectSampleSlice(track.id, sliceIndex)}
                onSetActiveSourceSubView={setActiveSourceSubView}
                onSetSampleStatus={setSampleStatus}
                onSetTrackParams={(params) => setTrackParams(track.id, params)}
                onSetTrackSource={(source) => setTrackSource(track.id, source)}
                onUpdateSampleSlice={(sliceIndex, updates) => updateSampleSlice(track.id, sliceIndex, updates)}
                sampleOptions={sampleOptions}
                sampleStatus={sampleStatus}
                sampleWindowWidth={sampleWindowWidth}
                selectedSampleSlice={selectedSampleSlice}
                track={track}
                trackVoicePresets={trackVoicePresets}
              />
            ) : null}
            {activeRackView === 'SHAPE' ? (
              <DeviceRackShapePanel
                onSetTrackParams={(params) => setTrackParams(track.id, params)}
                onSetTrackSource={(source) => setTrackSource(track.id, source)}
                track={track}
              />
            ) : null}
            {activeRackView === 'SPACE' ? (
              <DeviceRackSpacePanel
                onSetTrackParams={(params) => setTrackParams(track.id, params)}
                track={track}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

const RackModeButton = ({
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
    data-ui-sound="tab"
    onClick={onClick}
    type="button"
  >
    {icon}
    {label}
  </button>
);
