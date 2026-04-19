import type { RefObject } from 'react';

import { type Track, type TrackSource } from '../../../project/schema';
import { DeviceRackCustomSamplePanel } from './DeviceRackCustomSamplePanel';
import { DeviceRackEnginePanel } from './DeviceRackEnginePanel';
import { DeviceRackSampleModePanel } from './DeviceRackSampleModePanel';
import { DeviceRackSynthCorePanel } from './DeviceRackSynthCorePanel';

interface DeviceRackSampleCorePanelProps {
  activeSampleMeta: {
    description: string;
    label: string;
  } | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSetSampleStatus: (status: string | null) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  sampleOptions: Array<{ label: string; preset: TrackSource['samplePreset'] }>;
  sampleStatus: string | null;
  track: Track;
}

export const DeviceRackSampleCorePanel = ({
  activeSampleMeta,
  fileInputRef,
  onSetSampleStatus,
  onSetTrackSource,
  sampleOptions,
  sampleStatus,
  track,
}: DeviceRackSampleCorePanelProps) => (
  <>
    <DeviceRackEnginePanel
      onSetTrackSource={onSetTrackSource}
      track={track}
    />

    {track.source.engine === 'sample' ? (
      <div className="grid gap-3">
        <DeviceRackSampleModePanel
          activeSampleMeta={activeSampleMeta}
          onSetTrackSource={onSetTrackSource}
          sampleOptions={sampleOptions}
          track={track}
        />
        <DeviceRackCustomSamplePanel
          fileInputRef={fileInputRef}
          onSetSampleStatus={onSetSampleStatus}
          onSetTrackSource={onSetTrackSource}
          sampleStatus={sampleStatus}
          track={track}
        />
      </div>
    ) : (
      <DeviceRackSynthCorePanel
        onSetTrackSource={onSetTrackSource}
        track={track}
      />
    )}
  </>
);
