import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';

import { useAudio } from '../../context/AudioContext';
import { ActionButton, MetricCell, StateButton } from './SettingsPrimitives';

export const TrackSettingsPanel = () => {
  const {
    moveTrack,
    renameTrack,
    selectedTrackId,
    toggleMute,
    toggleSolo,
    tracks,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const [draftTrackName, setDraftTrackName] = useState(selectedTrack?.name ?? '');

  useEffect(() => {
    setDraftTrackName(selectedTrack?.name ?? '');
  }, [selectedTrack?.id, selectedTrack?.name]);

  return (
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
            <div className="section-label">Lane order</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ActionButton icon={<ArrowUp className="h-3.5 w-3.5" />} label="Move up" onClick={() => moveTrack(selectedTrack.id, 'up')} />
              <ActionButton icon={<ArrowDown className="h-3.5 w-3.5" />} label="Move down" onClick={() => moveTrack(selectedTrack.id, 'down')} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
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
            <div className="flex items-center justify-between gap-3">
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
  );
};
