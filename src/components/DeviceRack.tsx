import React, { startTransition, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Disc3,
  FolderUp,
  Gauge,
  Play,
  Save,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  X,
  Waves,
  Zap,
} from 'lucide-react';

import { MAX_CUSTOM_SAMPLE_BYTES, getDefaultSamplePreset, getSamplePresetMeta, getSamplePresetOptions } from '../audio/sampleLibrary';
import { useAudio } from '../context/AudioContext';
import { defaultNoteForTrack, getTrackVoicePresetDefinitions } from '../project/schema';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';

const WAVEFORM_OPTIONS = ['sine', 'triangle', 'sawtooth', 'square'] as const;
const FILTER_OPTIONS = ['lowpass', 'bandpass', 'highpass'] as const;
type RackView = 'SOURCE' | 'SHAPE' | 'SPACE';
type SourceSubView = 'CORE' | 'SLICES';

const SAMPLE_WINDOW_PRESETS = [
  { end: 0.25, key: 'attack', label: 'Attack', start: 0 },
  { end: 0.65, key: 'body', label: 'Body', start: 0.2 },
  { end: 1, key: 'tail', label: 'Tail', start: 0.55 },
  { end: 0.25, key: 'q1', label: 'Q1', start: 0 },
  { end: 0.5, key: 'q2', label: 'Q2', start: 0.25 },
  { end: 0.75, key: 'q3', label: 'Q3', start: 0.5 },
  { end: 1, key: 'q4', label: 'Q4', start: 0.75 },
] as const;
const SAMPLE_TRIGGER_MODE_OPTIONS = [
  { description: 'Use the selected slice for all sample playback on this track.', label: 'Active slice', value: 'active-slice' },
  { description: 'Ignore slices and play the current full source window.', label: 'Full source', value: 'full-source' },
  { description: 'Let each step choose its own slice for beat making.', label: 'Step mapped', value: 'step-mapped' },
] as const;

export const DeviceRack = () => {
  const {
    createSampleSlice,
    currentPattern,
    deleteSampleSlice,
    applyTrackVoicePreset,
    applyTrackSnapshot,
    isRecording,
    previewTrack,
    saveTrackSnapshot,
    selectSampleSlice,
    selectedTrackId,
    setTrackParams,
    setTrackSource,
    trackSnapshots,
    toggleRecording,
    tracks,
    updateSampleSlice,
    updateTrackPan,
    updateTrackVolume,
    deleteTrackSnapshot,
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
  const matchingTrackSnapshots = trackSnapshots.filter((snapshot) => snapshot.trackType === track.type);
  const activeTrackSnapshot = matchingTrackSnapshots.find((snapshot) => (
    snapshot.volume === track.volume
    && snapshot.pan === track.pan
    && JSON.stringify(snapshot.params) === JSON.stringify(track.params)
    && JSON.stringify(snapshot.source) === JSON.stringify(track.source)
  )) ?? null;

  useEffect(() => {
    setSampleStatus(null);
    setActiveRackView('SOURCE');
    setActiveSourceSubView('CORE');
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

  const applyCurrentWindowAsSlice = () => {
    if (!track) {
      return;
    }

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
    if (!track) {
      return;
    }

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
    if (!track) {
      return;
    }

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
    <section className="surface-panel min-h-[320px] max-h-[46vh] overflow-auto p-3">
      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="surface-panel-strong flex min-h-[280px] flex-col justify-between p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="section-label">Selected track</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">Keep one lane in focus while you write and shape it.</div>
              </div>
              <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                {track.type}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border" style={{ background: `${track.color}12`, borderColor: `${track.color}44`, borderRadius: '4px', color: track.color }}>
                <Disc3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {track.source.engine}
                  </span>
                  <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {track.source.engine === 'sample'
                      ? track.source.customSampleName ?? activeSampleMeta?.label ?? 'preset'
                      : waveformLabel(track.source.waveform)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <Visualizer />
          </div>

          <div className="mt-4 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-label">Sound recall</div>
                <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Save a lane sound you trust, then reapply it to the same instrument class without rebuilding it.
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                {matchingTrackSnapshots.length}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <button
                className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => saveTrackSnapshot(track.id, activeTrackSnapshot?.id ?? null)}
              >
                <Save className="h-3.5 w-3.5" />
                {activeTrackSnapshot ? 'Update current sound' : 'Store current sound'}
              </button>
              {activeTrackSnapshot && (
                <div className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(114,217,255,0.08)] px-3 py-2 text-[11px] text-[var(--accent-strong)]">
                  Active recall: {activeTrackSnapshot.name}
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2">
              {matchingTrackSnapshots.length > 0 ? matchingTrackSnapshots.slice(-4).reverse().map((snapshot) => (
                <div key={snapshot.id} className="rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
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
                        onClick={() => applyTrackSnapshot(track.id, snapshot.id)}
                        title="Apply sound recall"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ghost-icon-button flex h-8 w-8 items-center justify-center text-[var(--danger)]"
                        onClick={() => deleteTrackSnapshot(snapshot.id)}
                        title="Delete sound recall"
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

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <button
                className="control-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] hover:text-[var(--text-primary)]"
                onClick={() => void previewTrack(
                  track.id,
                  defaultNoteForTrack(track),
                  typeof track.source.activeSampleSlice === 'number' ? track.source.activeSampleSlice : undefined,
                )}
              >
                <Play className="h-3.5 w-3.5" />
                Audition
              </button>
              <button
                className={`control-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${isRecording ? 'text-[var(--danger)]' : 'hover:text-[var(--text-primary)]'}`}
                onClick={toggleRecording}
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
                onChange={(value) => updateTrackVolume(track.id, value)}
                step={1}
                unit="dB"
                value={track.volume}
              />
              <InlineSlider
                label="Pan"
                max={1}
                min={-1}
                onChange={(value) => updateTrackPan(track.id, value)}
                step={0.1}
                value={track.pan}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <StatusCell label="Voice" value={track.source.engine === 'sample' ? track.source.customSampleName ?? activeSampleMeta?.label ?? 'Preset' : waveformLabel(track.source.waveform)} />
              <StatusCell label="Filter" value={filterLabel(track.params.filterMode)} />
              <StatusCell label="Pattern notes" value={`${track.patterns[currentPattern]?.reduce((sum, step) => sum + step.length, 0) ?? 0}`} />
              <StatusCell
                label={track.source.engine === 'sample' ? 'Sample mode' : 'Motion'}
                value={track.source.engine === 'sample'
                  ? `${track.source.samplePlayback === 'oneshot' ? 'One-shot' : 'Pitched'} · ${Math.round(sampleWindowWidth * 100)}%`
                  : `${track.params.vibratoDepth.toFixed(2)} depth`}
              />
            </div>
          </div>
        </div>

        <div className="surface-panel-strong min-h-[280px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
            <div>
              <div className="section-label">Sound desk</div>
              <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                One focused control family at a time keeps the rack usable.
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
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <RackSection icon={<Waves className="h-4 w-4 text-[var(--accent)]" />} title="Source routing">
                  <div className="grid gap-4">
                    {isSampleTrack && (
                      <div className="flex flex-wrap gap-2">
                        <RackTab
                          active={activeSourceSubView === 'CORE'}
                          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                          label="Core"
                          onClick={() => setActiveSourceSubView('CORE')}
                        />
                        <RackTab
                          active={activeSourceSubView === 'SLICES'}
                          icon={<Sparkles className="h-3.5 w-3.5" />}
                          label="Slices"
                          onClick={() => setActiveSourceSubView('SLICES')}
                        />
                      </div>
                    )}

                    <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
                      <div className="section-label">Voice starts</div>
                      <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                        Apply a full sound starting point for this lane, then fine tune from there.
                      </div>
                      <div className="mt-3 grid gap-2">
                        {trackVoicePresets.map((preset) => (
                          <button
                            key={preset.id}
                            className="rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.26)] hover:bg-[rgba(114,217,255,0.05)]"
                            onClick={() => applyTrackVoicePreset(track.id, preset.id)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.label}</span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                                {preset.focus}
                              </span>
                            </div>
                            <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{preset.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="text-xs text-[var(--text-secondary)]">
                      <span className="section-label mb-2 block">Engine</span>
                      <select
                        className="control-field h-11 w-full px-3 text-sm"
                        onChange={(event) => {
                          const engine = event.target.value as typeof track.source.engine;
                          setTrackSource(track.id, {
                            engine,
                            samplePreset: engine === 'sample' ? getDefaultSamplePreset(track.type) : track.source.samplePreset,
                          });
                        }}
                        value={track.source.engine}
                      >
                        <option value="synth">Synth</option>
                        <option value="sample">Sample</option>
                      </select>
                    </label>

                    {track.source.engine === 'sample' && activeSourceSubView === 'CORE' ? (
                      <div className="grid gap-3">
                        <label className="text-xs text-[var(--text-secondary)]">
                          <span className="section-label mb-2 block">Sample preset</span>
                          <select
                            className="control-field h-11 w-full px-3 text-sm"
                            onChange={(event) => setTrackSource(track.id, {
                              customSampleDataUrl: undefined,
                              customSampleName: undefined,
                              samplePreset: event.target.value as typeof track.source.samplePreset,
                            })}
                            value={track.source.samplePreset}
                          >
                            {sampleOptions.map((option) => (
                              <option key={option.preset} value={option.preset}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <span className="mt-2 block text-[11px] leading-5 text-[var(--text-secondary)]">
                            {activeSampleMeta?.description ?? 'Built-in sample source.'}
                          </span>
                        </label>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-xs text-[var(--text-secondary)]">
                            <span className="section-label mb-2 block">Playback mode</span>
                            <select
                              className="control-field h-11 w-full px-3 text-sm"
                              onChange={(event) => setTrackSource(track.id, {
                                samplePlayback: event.target.value as typeof track.source.samplePlayback,
                              })}
                              value={track.source.samplePlayback}
                            >
                              <option value="pitched">Pitched</option>
                              <option value="oneshot">One-shot</option>
                            </select>
                          </label>
                          <label className="text-xs text-[var(--text-secondary)]">
                            <span className="section-label mb-2 block">Trigger mode</span>
                            <select
                              className="control-field h-11 w-full px-3 text-sm"
                              onChange={(event) => setTrackSource(track.id, {
                                sampleTriggerMode: event.target.value as typeof track.source.sampleTriggerMode,
                              })}
                              value={track.source.sampleTriggerMode}
                            >
                              {SAMPLE_TRIGGER_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
                          {SAMPLE_TRIGGER_MODE_OPTIONS.find((option) => option.value === track.source.sampleTriggerMode)?.description}
                        </div>

                        <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
                          <div className="section-label">Custom sample</div>
                          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                            {track.source.customSampleName
                              ? `Loaded: ${track.source.customSampleName}`
                              : `Import a short audio file up to ${(MAX_CUSTOM_SAMPLE_BYTES / 1_000_000).toFixed(1)} MB. It will save inside the project.`}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] hover:text-[var(--text-primary)]"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FolderUp className="h-3.5 w-3.5" />
                              {track.source.customSampleName ? 'Replace' : 'Import'}
                            </button>
                            {track.source.customSampleName && (
                              <button
                                className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                                onClick={() => {
                                  setTrackSource(track.id, { customSampleDataUrl: undefined, customSampleName: undefined });
                                  setSampleStatus('Reverted to built-in preset');
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                                Clear custom
                              </button>
                            )}
                          </div>
                          {sampleStatus && (
                            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">{sampleStatus}</div>
                          )}
                          <input
                            accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';

                              if (!file) {
                                return;
                              }

                              if (file.size > MAX_CUSTOM_SAMPLE_BYTES) {
                                setSampleStatus(`Sample is too large. Keep it under ${(MAX_CUSTOM_SAMPLE_BYTES / 1_000_000).toFixed(1)} MB.`);
                                return;
                              }

                              const reader = new FileReader();
                              reader.onload = () => {
                                const result = typeof reader.result === 'string' ? reader.result : null;
                                if (!result || !result.startsWith('data:audio/')) {
                                  setSampleStatus('Could not read that file as audio.');
                                  return;
                                }

                                startTransition(() => {
                                  setTrackSource(track.id, {
                                    customSampleDataUrl: result,
                                    customSampleName: file.name,
                                  });
                                  setSampleStatus(`Loaded ${file.name}`);
                                });
                              };
                              reader.onerror = () => {
                                setSampleStatus('Could not import that file.');
                              };
                              reader.readAsDataURL(file);
                            }}
                            ref={fileInputRef}
                            type="file"
                          />
                        </div>

                        <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
                          <div className="section-label">Source window</div>
                          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                            Full-source playback uses this window. Slices can override gain and reverse when selected.
                          </div>
                          <div className="mt-4 rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                            <div className="flex items-center justify-between">
                              <span className="section-label">Region strip</span>
                              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                                {Math.round(track.source.sampleStart * 100)}% to {Math.round(track.source.sampleEnd * 100)}%
                              </span>
                            </div>
                            <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                              <div
                                className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#7dd3fc,#67e8f9)]"
                                style={{
                                  left: `${track.source.sampleStart * 100}%`,
                                  width: `${sampleWindowWidth * 100}%`,
                                }}
                              />
                              <div className="relative h-full">
                                {track.source.sampleSlices.map((slice, index) => (
                                  <div
                                    className={`absolute inset-y-0 border ${track.source.activeSampleSlice === index ? 'bg-[rgba(125,211,252,0.28)] border-[rgba(125,211,252,0.7)]' : 'bg-[rgba(255,255,255,0.14)] border-[rgba(255,255,255,0.28)]'}`}
                                    key={`${slice.label}-${index}`}
                                    style={{
                                      left: `${slice.start * 100}%`,
                                      width: `${Math.max(4, (slice.end - slice.start) * 100)}%`,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <InlineSlider
                              label="Start"
                              max={0.95}
                              min={0}
                              onChange={(value) => setTrackSource(track.id, {
                                sampleEnd: Math.max(value + 0.05, track.source.sampleEnd),
                                sampleStart: value,
                              })}
                              step={0.01}
                              unit="%"
                              value={track.source.sampleStart}
                            />
                            <InlineSlider
                              label="End"
                              max={1}
                              min={0.05}
                              onChange={(value) => setTrackSource(track.id, {
                                sampleEnd: value,
                                sampleStart: Math.min(track.source.sampleStart, value - 0.05),
                              })}
                              step={0.01}
                              unit="%"
                              value={track.source.sampleEnd}
                            />
                            <InlineSlider
                              label="Source gain"
                              max={2}
                              min={0.25}
                              onChange={(value) => setTrackSource(track.id, { sampleGain: value })}
                              step={0.01}
                              value={track.source.sampleGain}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {SAMPLE_WINDOW_PRESETS.map((preset) => (
                              <button
                                key={preset.key}
                                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                onClick={() => setTrackSource(track.id, {
                                  sampleEnd: preset.end,
                                  sampleStart: preset.start,
                                })}
                              >
                                {preset.label}
                              </button>
                            ))}
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              onClick={() => setTrackSource(track.id, { sampleReverse: !track.source.sampleReverse })}
                            >
                              {track.source.sampleReverse ? 'Reverse on' : 'Reverse off'}
                            </button>
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              onClick={() => setTrackSource(track.id, {
                                sampleEnd: 1,
                                sampleGain: 1,
                                sampleReverse: false,
                                sampleStart: 0,
                              })}
                            >
                              Reset window
                            </button>
                          </div>
                        </div>

                      </div>
                    ) : null}

                    {track.source.engine === 'sample' && activeSourceSubView === 'SLICES' ? (
                      <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="section-label">Slices</div>
                              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                                Author real slice regions here, then use step mapping in the arranger for beat work.
                              </div>
                            </div>
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              disabled={track.source.sampleSlices.length >= 8}
                              onClick={applyCurrentWindowAsSlice}
                            >
                              {selectedSampleSlice ? 'Replace from window' : 'Save current'}
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => applyEvenSplit(2)}>Split 2</button>
                            <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => applyEvenSplit(4)}>Split 4</button>
                            <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => applyEvenSplit(8)}>Split 8</button>
                            <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={applyRegionTemplate}>Attack Body Tail</button>
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              disabled={track.source.sampleSlices.length >= 8}
                              onClick={() => createSampleSlice(track.id, {
                                end: track.source.sampleEnd,
                                gain: track.source.sampleGain,
                                reverse: track.source.sampleReverse,
                                start: track.source.sampleStart,
                              })}
                            >
                              New slice
                            </button>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {track.source.sampleSlices.length > 0 ? track.source.sampleSlices.map((slice, index) => (
                              <div
                                className={`rounded-[12px] border p-3 ${track.source.activeSampleSlice === index ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]'}`}
                                key={`slice-${index}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <button
                                    className="min-w-0 text-left"
                                    onClick={() => selectSampleSlice(track.id, index)}
                                  >
                                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">{slice.label}</div>
                                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                                      {Math.round(slice.start * 100)}% to {Math.round(slice.end * 100)}%
                                    </div>
                                  </button>
                                  <div className="flex gap-2">
                                    <button
                                      className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                      onClick={() => void previewTrack(track.id, defaultNoteForTrack(track), index)}
                                    >
                                      <Play className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      className="ghost-icon-button flex h-8 w-8 items-center justify-center text-[var(--danger)]"
                                      onClick={() => deleteSampleSlice(track.id, index)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
                                No slices yet. Save the current window or use one of the split actions above.
                              </div>
                            )}
                          </div>

                          {selectedSampleSlice && typeof track.source.activeSampleSlice === 'number' && (
                            <div className="mt-4 rounded-[12px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] p-3">
                              <div className="section-label">Selected slice</div>
                              <div className="mt-3 grid gap-3">
                                <label className="text-xs text-[var(--text-secondary)]">
                                  <span className="section-label mb-2 block">Label</span>
                                  <input
                                    className="control-field h-11 w-full px-3 text-sm"
                                    maxLength={16}
                                    onChange={(event) => updateSampleSlice(track.id, track.source.activeSampleSlice!, { label: event.target.value })}
                                    value={selectedSampleSlice.label}
                                  />
                                </label>
                                <InlineSlider
                                  label="Slice gain"
                                  max={2}
                                  min={0.25}
                                  onChange={(value) => updateSampleSlice(track.id, track.source.activeSampleSlice!, { gain: value })}
                                  step={0.01}
                                  value={selectedSampleSlice.gain}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                    data-active={selectedSampleSlice.reverse}
                                    onClick={() => updateSampleSlice(track.id, track.source.activeSampleSlice!, { reverse: !selectedSampleSlice.reverse })}
                                  >
                                    {selectedSampleSlice.reverse ? 'Slice reverse on' : 'Slice reverse off'}
                                  </button>
                                  <button
                                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                    onClick={applyCurrentWindowAsSlice}
                                  >
                                    Replace from current window
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    ) : null}

                    {track.source.engine !== 'sample' ? (
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="section-label mb-2 block">Waveform</span>
                        <select
                          className="control-field h-11 w-full px-3 text-sm"
                          onChange={(event) => setTrackSource(track.id, { waveform: event.target.value as typeof track.source.waveform })}
                          value={track.source.waveform}
                        >
                          {WAVEFORM_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {waveformLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </RackSection>

                <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Pitch and response">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Knob
                      color="#7dd3fc"
                      label="Octave"
                      max={3}
                      min={-3}
                      onChange={(value) => setTrackSource(track.id, { octaveShift: Math.round(value) })}
                      step={1}
                      value={track.source.octaveShift}
                    />
                    <Knob
                      color="#7dd3fc"
                      label="Detune"
                      disabled={track.source.engine === 'sample'}
                      max={1200}
                      min={-1200}
                      onChange={(value) => setTrackSource(track.id, { detune: value })}
                      unit="ct"
                      value={track.source.detune}
                    />
                    <Knob
                      color="#7dd3fc"
                      disabled={track.source.engine === 'sample'}
                      label="Glide"
                      max={0.2}
                      min={0}
                      onChange={(value) => setTrackSource(track.id, { portamento: value })}
                      unit="s"
                      value={track.source.portamento}
                    />
                  </div>
                  {track.source.engine === 'sample' && (
                    <div className="mt-4 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Sample mode keeps octave transpose active for musical playback. Fine detune and glide stay synth-only so playback stays reliable.
                    </div>
                  )}
                </RackSection>
              </div>
            )}

            {activeRackView === 'SHAPE' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Envelope">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    <Knob label="Attack" max={1} min={0.001} onChange={(value) => setTrackParams(track.id, { attack: value })} unit="s" value={track.params.attack} />
                    <Knob label="Decay" max={2} min={0.01} onChange={(value) => setTrackParams(track.id, { decay: value })} unit="s" value={track.params.decay} />
                    <Knob label="Sustain" max={1} min={0} onChange={(value) => setTrackParams(track.id, { sustain: value })} value={track.params.sustain} />
                    <Knob label="Release" max={4} min={0.01} onChange={(value) => setTrackParams(track.id, { release: value })} unit="s" value={track.params.release} />
                  </div>
                </RackSection>

                <RackSection icon={<Activity className="h-4 w-4 text-[var(--accent)]" />} title="Filter">
                  <div className="grid gap-4">
                    <label className="text-xs text-[var(--text-secondary)]">
                      <span className="section-label mb-2 block">Mode</span>
                      <select
                        className="control-field h-11 w-full px-3 text-sm"
                        onChange={(event) => setTrackParams(track.id, { filterMode: event.target.value as typeof track.params.filterMode })}
                        value={track.params.filterMode}
                      >
                        {FILTER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {filterLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Knob color="#e7a65f" label="Cutoff" max={15000} min={20} onChange={(value) => setTrackParams(track.id, { cutoff: value })} unit="Hz" value={track.params.cutoff} />
                      <Knob color="#e7a65f" label="Res" max={20} min={0.1} onChange={(value) => setTrackParams(track.id, { resonance: value })} value={track.params.resonance} />
                    </div>
                  </div>
                </RackSection>
              </div>
            )}

            {activeRackView === 'SPACE' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Motion">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Knob color="#8ab4ff" label="Vib rate" max={12} min={0.1} onChange={(value) => setTrackParams(track.id, { vibratoRate: value })} unit="Hz" value={track.params.vibratoRate} />
                    <Knob color="#8ab4ff" label="Vib depth" max={1} min={0} onChange={(value) => setTrackParams(track.id, { vibratoDepth: value })} value={track.params.vibratoDepth} />
                  </div>
                </RackSection>

                <RackSection icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="Drive and space">
                  <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
                    <Knob color="#96b9f3" label="Chorus" max={1} min={0} onChange={(value) => setTrackParams(track.id, { chorusSend: value })} value={track.params.chorusSend} />
                    <Knob color="#d79cff" label="Crush" max={1} min={0} onChange={(value) => setTrackParams(track.id, { bitCrush: value })} value={track.params.bitCrush} />
                    <Knob color="#f08f86" label="Drive" max={1} min={0} onChange={(value) => setTrackParams(track.id, { distortion: value })} value={track.params.distortion} />
                    <Knob color="#96b9f3" label="Delay" max={1} min={0} onChange={(value) => setTrackParams(track.id, { delaySend: value })} value={track.params.delaySend} />
                    <Knob color="#96b9f3" label="Reverb" max={1} min={0} onChange={(value) => setTrackParams(track.id, { reverbSend: value })} value={track.params.reverbSend} />
                  </div>
                </RackSection>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const RackSection = ({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="surface-panel-strong flex flex-col p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="section-label">{title}</span>
    </div>
    <div className="mt-5 flex-1">{children}</div>
  </div>
);

const waveformLabel = (waveform: typeof WAVEFORM_OPTIONS[number]) => {
  switch (waveform) {
    case 'sawtooth':
      return 'Saw';
    case 'triangle':
      return 'Triangle';
    default:
      return waveform.charAt(0).toUpperCase() + waveform.slice(1);
  }
};

const filterLabel = (mode: typeof FILTER_OPTIONS[number]) => {
  switch (mode) {
    case 'highpass':
      return 'High-pass';
    case 'bandpass':
      return 'Band-pass';
    default:
      return 'Low-pass';
  }
};

const StatusCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <div className="section-label">{label}</div>
    <div className="mt-1 text-xs font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

const RackTab = ({
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
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const InlineSlider = ({
  label,
  max,
  min,
  onChange,
  step,
  unit = '',
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) => (
  <div>
    <div className="flex items-center justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
        {unit === 'dB'
          ? `${value.toFixed(1)} ${unit}`
          : unit === '%'
            ? `${Math.round(value * 100)}%`
            : unit
              ? `${value.toFixed(1)} ${unit}`
              : value.toFixed(1)}
      </span>
    </div>
    <input
      className="mt-3"
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      step={step}
      type="range"
      value={value}
    />
  </div>
);
