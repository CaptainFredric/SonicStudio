import React from 'react';
import { SlidersHorizontal, Sparkles, Waves } from 'lucide-react';

import { type SampleSliceMemory, type Track, type TrackSource, type TrackVoicePresetDefinition } from '../../project/schema';
import { DeviceRackPitchResponsePanel } from './source/DeviceRackPitchResponsePanel';
import { DeviceRackSampleCorePanel } from './source/DeviceRackSampleCorePanel';
import { DeviceRackSampleSlicesPanel } from './source/DeviceRackSampleSlicesPanel';
import { DeviceRackSampleWindowPanel } from './source/DeviceRackSampleWindowPanel';
import { DeviceRackVoiceStartsPanel } from './source/DeviceRackVoiceStartsPanel';
import { type SourceSubView, RackSection, RackTab } from './rackPrimitives';

interface DeviceRackSourcePanelProps {
  activeSampleMeta: {
    description: string;
    label: string;
  } | null;
  activeSourceSubView: SourceSubView;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSampleTrack: boolean;
  onApplyCurrentWindowAsSlice: () => void;
  onApplyEvenSplit: (parts: number) => void;
  onApplyRegionTemplate: () => void;
  onApplyTrackVoicePreset: (presetId: string) => void;
  onCreateSampleSlice: (slice?: Partial<SampleSliceMemory>) => void;
  onDeleteSampleSlice: (sliceIndex: number) => void;
  onPreviewTrack: (note?: string, sampleSliceIndex?: number) => Promise<void>;
  onSelectSampleSlice: (sliceIndex: number | null) => void;
  onSetActiveSourceSubView: (view: SourceSubView) => void;
  onSetSampleStatus: (status: string | null) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  onUpdateSampleSlice: (sliceIndex: number, updates: Partial<SampleSliceMemory>) => void;
  sampleOptions: Array<{ label: string; preset: TrackSource['samplePreset'] }>;
  sampleStatus: string | null;
  sampleWindowWidth: number;
  selectedSampleSlice: SampleSliceMemory | null;
  track: Track;
  trackVoicePresets: TrackVoicePresetDefinition[];
}

export const DeviceRackSourcePanel = ({
  activeSampleMeta,
  activeSourceSubView,
  fileInputRef,
  isSampleTrack,
  onApplyCurrentWindowAsSlice,
  onApplyEvenSplit,
  onApplyRegionTemplate,
  onApplyTrackVoicePreset,
  onCreateSampleSlice,
  onDeleteSampleSlice,
  onPreviewTrack,
  onSelectSampleSlice,
  onSetActiveSourceSubView,
  onSetSampleStatus,
  onSetTrackSource,
  onUpdateSampleSlice,
  sampleOptions,
  sampleStatus,
  sampleWindowWidth,
  selectedSampleSlice,
  track,
  trackVoicePresets,
}: DeviceRackSourcePanelProps) => (
  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <RackSection icon={<Waves className="h-4 w-4 text-[var(--accent)]" />} title="Source routing">
      <div className="grid gap-4">
        {isSampleTrack ? (
          <div className="flex flex-wrap gap-2">
            <RackTab
              active={activeSourceSubView === 'CORE'}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label="Core"
              onClick={() => onSetActiveSourceSubView('CORE')}
            />
            <RackTab
              active={activeSourceSubView === 'SLICES'}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Slices"
              onClick={() => onSetActiveSourceSubView('SLICES')}
            />
          </div>
        ) : null}

        <DeviceRackVoiceStartsPanel
          onApplyTrackVoicePreset={onApplyTrackVoicePreset}
          trackVoicePresets={trackVoicePresets}
        />

        <DeviceRackSampleCorePanel
          activeSampleMeta={activeSampleMeta}
          fileInputRef={fileInputRef}
          onSetSampleStatus={onSetSampleStatus}
          onSetTrackSource={onSetTrackSource}
          sampleOptions={sampleOptions}
          sampleStatus={sampleStatus}
          track={track}
        />

        {track.source.engine === 'sample' && activeSourceSubView === 'CORE' ? (
          <DeviceRackSampleWindowPanel
            onSetTrackSource={onSetTrackSource}
            sampleWindowWidth={sampleWindowWidth}
            track={track}
          />
        ) : null}

        {track.source.engine === 'sample' && activeSourceSubView === 'SLICES' ? (
          <DeviceRackSampleSlicesPanel
            onApplyCurrentWindowAsSlice={onApplyCurrentWindowAsSlice}
            onApplyEvenSplit={onApplyEvenSplit}
            onApplyRegionTemplate={onApplyRegionTemplate}
            onCreateSampleSlice={onCreateSampleSlice}
            onDeleteSampleSlice={onDeleteSampleSlice}
            onPreviewTrack={onPreviewTrack}
            onSelectSampleSlice={onSelectSampleSlice}
            onUpdateSampleSlice={onUpdateSampleSlice}
            selectedSampleSlice={selectedSampleSlice}
            track={track}
          />
        ) : null}
      </div>
    </RackSection>

    <DeviceRackPitchResponsePanel
      onSetTrackSource={onSetTrackSource}
      track={track}
    />
  </div>
);
