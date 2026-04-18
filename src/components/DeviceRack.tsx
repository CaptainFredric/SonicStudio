import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Waves, Zap } from 'lucide-react';

import { getSamplePresetMeta, getSamplePresetOptions } from '../audio/sampleLibrary';
import { useAudio } from '../context/AudioContext';
import { getTrackVoicePresetDefinitions } from '../project/schema';
import { DeviceRackShapePanel } from './device-rack/DeviceRackShapePanel';
import { DeviceRackSidebar } from './device-rack/DeviceRackSidebar';
import { DeviceRackSourcePanel } from './device-rack/DeviceRackSourcePanel';
import { DeviceRackSpacePanel } from './device-rack/DeviceRackSpacePanel';
import {
  type RackView,
  type SourceSubView,
  RackTab,
  filterLabel,
  waveformLabel,
} from './device-rack/rackPrimitives';

export const DeviceRack = () => {
  const {
    applyTrackSnapshot,
    applyTrackVoicePreset,
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
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const sampleOptions = track ? getSamplePresetOptions(track.type) : [];
  const trackVoicePresets = track ? getTrackVoicePresetDefinitions(track.type) : [];
  const activeSampleMeta = track ? getSamplePresetMeta(track.source.samplePreset) : null;
  const sampleWindowWidth = Math.max(0.05, track ? track.source.sampleEnd - track.source.sampleStart : 1);
  const selectedSampleSlice = track && typeof track.source.activeSampleSlice === 'number'
    ? track.source.sampleSlices[track.source.activeSampleSlice] ?? null
    : null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sampleStatus, setSampleStatus] = useState<string | null>(null);
  const [activeRackView, setActiveRackView] = useState<RackView>('SOURCE');
  const [activeSourceSubView, setActiveSourceSubView] = useState<SourceSubView>('CORE');
  const [isSoundRecallOpen, setIsSoundRecallOpen] = useState(false);

  useEffect(() => {
    setSampleStatus(null);
    setActiveRackView('SOURCE');
    setActiveSourceSubView('CORE');
    setIsSoundRecallOpen(false);
  }, [track?.id]);

  if (!track) {
    return (
      <section className="surface-panel flex min-h-[240px] max-h-[42vh] items-center justify-center overflow-hidden p-4">
        <div className="text-center">
          <div className="section-label">Device rack</div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Select a track to load its source, tone, and output chain.</p>
        </div>
      </section>
    );
  }

  const isSampleTrack = track.source.engine === 'sample';
  const matchingTrackSnapshots = trackSnapshots.filter((snapshot) => snapshot.trackType === track.type);
  const activeTrackSnapshot = matchingTrackSnapshots.find((snapshot) => (
    snapshot.volume === track.volume
    && snapshot.pan === track.pan
    && JSON.stringify(snapshot.params) === JSON.stringify(track.params)
    && JSON.stringify(snapshot.source) === JSON.stringify(track.source)
  )) ?? null;

  const patternNoteCount = useMemo(
    () => track.patterns[currentPattern]?.reduce((sum, step) => sum + step.length, 0) ?? 0,
    [currentPattern, track.patterns],
  );
  const voiceLabel = track.source.engine === 'sample'
    ? track.source.customSampleName ?? activeSampleMeta?.label ?? 'Preset'
    : waveformLabel(track.source.waveform);
  const motionSummary = track.source.engine === 'sample'
    ? `${track.source.samplePlayback === 'oneshot' ? 'One-shot' : 'Pitched'} · ${Math.round(sampleWindowWidth * 100)}%`
    : `${track.params.vibratoDepth.toFixed(2)} depth`;

  const applyCurrentWindowAsSlice = () => {
    if (typeof track.source.activeSampleSlice === 'number' && selectedSampleSlice) {
      updateSampleSlice(track.id, track.source.activeSampleSlice, {
        end: track.source.sampleEnd,
        gain: track.source.sampleGain,
        reverse: track.source.sampleReverse,
        start: track.source.sampleStart,
      });
      return;
    }

    createSampleSlice(track.id, {
      end: track.source.sampleEnd,
      gain: track.source.sampleGain,
      reverse: track.source.sampleReverse,
      start: track.source.sampleStart,
    });
  };

  const applyEvenSplit = (parts: number) => {
    const nextSlices = Array.from({ length: Math.min(parts, 8) }, (_, index) => {
      const start = index / parts;
      const end = (index + 1) / parts;
      return {
        end,
        gain: 1,
        label: `Slice ${index + 1}`,
        reverse: false,
        start,
      };
    });

    setTrackSource(track.id, {
      activeSampleSlice: nextSlices[0] ? 0 : null,
      sampleSlices: nextSlices,
    });
  };

  const applyRegionTemplate = () => {
    setTrackSource(track.id, {
      activeSampleSlice: 0,
      sampleSlices: [
        { end: 0.22, gain: 1, label: 'Attack', reverse: false, start: 0 },
        { end: 0.7, gain: 1, label: 'Body', reverse: false, start: 0.18 },
        { end: 1, gain: 1, label: 'Tail', reverse: false, start: 0.62 },
      ],
    });
  };

  return (
    <section className="min-h-[320px] max-h-[46vh] overflow-auto border-t border-[var(--border-soft)] pt-3">
      <div className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]">
        <DeviceRackSidebar
          activeTrackSnapshot={activeTrackSnapshot}
          filterValue={filterLabel(track.params.filterMode)}
          isRecording={isRecording}
          isSoundRecallOpen={isSoundRecallOpen}
          matchingTrackSnapshots={matchingTrackSnapshots}
          motionSummary={motionSummary}
          onApplyTrackSnapshot={(snapshotId) => applyTrackSnapshot(track.id, snapshotId)}
          onDeleteTrackSnapshot={deleteTrackSnapshot}
          onPreviewTrack={(note, sampleSliceIndex) => previewTrack(track.id, note, sampleSliceIndex)}
          onSaveTrackSnapshot={(snapshotId) => saveTrackSnapshot(track.id, snapshotId)}
          onToggleRecording={toggleRecording}
          onToggleSoundRecall={() => setIsSoundRecallOpen((current) => !current)}
          onUpdateTrackPan={(pan) => updateTrackPan(track.id, pan)}
          onUpdateTrackVolume={(volume) => updateTrackVolume(track.id, volume)}
          patternNoteCount={patternNoteCount}
          track={track}
          voiceLabel={voiceLabel}
        />

        <div className="min-h-[280px] min-w-0 p-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
            <div>
              <div className="section-label">Sound desk</div>
              <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                Source, shape, and space in one dock.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RackTab
                active={activeRackView === 'SOURCE'}
                icon={<Waves className="h-3.5 w-3.5" />}
                label="Source"
                onClick={() => setActiveRackView('SOURCE')}
              />
              <RackTab
                active={activeRackView === 'SHAPE'}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Shape"
                onClick={() => setActiveRackView('SHAPE')}
              />
              <RackTab
                active={activeRackView === 'SPACE'}
                icon={<Zap className="h-3.5 w-3.5" />}
                label="Space"
                onClick={() => setActiveRackView('SPACE')}
              />
            </div>
          </div>

          <div className="mt-4">
            {activeRackView === 'SOURCE' && (
              <DeviceRackSourcePanel
                activeSampleMeta={activeSampleMeta}
                activeSourceSubView={activeSourceSubView}
                fileInputRef={fileInputRef}
                isSampleTrack={isSampleTrack}
                onApplyCurrentWindowAsSlice={applyCurrentWindowAsSlice}
                onApplyEvenSplit={applyEvenSplit}
                onApplyRegionTemplate={applyRegionTemplate}
                onApplyTrackVoicePreset={(presetId) => applyTrackVoicePreset(track.id, presetId)}
                onCreateSampleSlice={(slice) => createSampleSlice(track.id, slice)}
                onDeleteSampleSlice={(sliceIndex) => deleteSampleSlice(track.id, sliceIndex)}
                onPreviewTrack={(note, sampleSliceIndex) => previewTrack(track.id, note, sampleSliceIndex)}
                onSelectSampleSlice={(sliceIndex) => selectSampleSlice(track.id, sliceIndex)}
                onSetActiveSourceSubView={setActiveSourceSubView}
                onSetSampleStatus={setSampleStatus}
                onSetTrackSource={(source) => setTrackSource(track.id, source)}
                onUpdateSampleSlice={(sliceIndex, updates) => updateSampleSlice(track.id, sliceIndex, updates)}
                sampleOptions={sampleOptions}
                sampleStatus={sampleStatus}
                sampleWindowWidth={sampleWindowWidth}
                selectedSampleSlice={selectedSampleSlice}
                track={track}
                trackVoicePresets={trackVoicePresets}
              />
            )}

            {activeRackView === 'SHAPE' && (
              <DeviceRackShapePanel
                onSetTrackParams={(params) => setTrackParams(track.id, params)}
                track={track}
              />
            )}

            {activeRackView === 'SPACE' && (
              <DeviceRackSpacePanel
                onSetTrackParams={(params) => setTrackParams(track.id, params)}
                track={track}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
