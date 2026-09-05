import type { Dispatch, SetStateAction } from 'react';

import { createTrack, defaultNoteForTrack, getTrackVoicePresetDefinitions, type InstrumentType, type Project, type Track } from '../../project/schema';

interface TransportEngine {
  awaitAssetLoad: () => Promise<void>;
  init: () => Promise<void>;
  previewMetronomeTick: (isAccent: boolean) => void;
  previewTrack: (track: Track, note: string, sampleSliceIndex?: number, velocity?: number) => void;
  startRecording: () => Promise<void>;
  stop: () => void;
  stopRecording: () => Promise<unknown>;
  syncProject: (project: Project) => void;
  togglePlayback: () => boolean;
  wakeContext: () => void;
}

interface CreateTransportControllerOptions {
  countInActive: boolean;
  countInToken: CountInTokenController;
  currentProject: Project;
  engine: TransportEngine;
  initAudio: () => Promise<void>;
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  setCountInActive: Dispatch<SetStateAction<boolean>>;
  setCountInBeatsRemaining: Dispatch<SetStateAction<number>>;
  setCurrentStep: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  tracks: Track[];
}

export interface CountInTokenController {
  cancel: () => void;
  isCurrent: (token: number) => boolean;
  start: () => number;
}

// Count-ins span asynchronous timer ticks, so they need a cancellation token
// whose current value is available without waiting for a React render. Keeping
// that mutable detail inside this tiny controller avoids passing React refs
// through render-time factories and makes the lifecycle independently testable.
export const createCountInTokenController = (initialValue = 0): CountInTokenController => {
  let value = initialValue;

  return {
    cancel: () => {
      value += 1;
    },
    isCurrent: (token) => value === token,
    start: () => {
      value += 1;
      return value;
    },
  };
};

export const createTransportController = ({
  countInActive,
  countInToken,
  currentProject,
  engine,
  initAudio,
  isPlaying,
  isRecording,
  setCountInActive,
  setCountInBeatsRemaining,
  setCurrentStep,
  setIsPlaying,
  setIsRecording,
  tracks,
}: CreateTransportControllerOptions) => {
  const warmSampleAssets = () => {
    if (!currentProject.tracks.some((track) => track.source.engine === 'sample')) {
      return;
    }

    // Sample downloads are useful preparation, but they must never gate the
    // transport. ToneAudioBuffer.loaded() is global, so it can include a slow
    // preview-only buffer created while editing a note. Let synth lanes and the
    // playhead start immediately; sample lanes safely join as their buffers
    // become ready (ToneEngine skips an unloaded sample hit).
    void Promise.resolve()
      .then(() => engine.awaitAssetLoad())
      .catch((error) => {
        console.warn('SonicStudio: sample asset load failed; continuing playback with available sources.', error);
      });
  };

  const ensureAudioReady = async () => {
    // Resume Tone's context synchronously inside the user gesture before
    // any await — uiSounds use a separate context that auto-resumes, so
    // without this kick Tone could stay suspended and music goes silent
    // while UI clicks still play.
    engine.wakeContext();
    await initAudio();
    engine.syncProject(currentProject);
    warmSampleAssets();
  };

  const cancelCountIn = () => {
    countInToken.cancel();
    setCountInActive(false);
    setCountInBeatsRemaining(0);
  };

  const resetTransportState = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  // Plays the metronome lead-in, if one is configured. Resolves true when it
  // finished and false when it was cancelled mid-count. Leaves the transport
  // untouched so callers can start playback or recording on the downbeat.
  const runCountIn = async (): Promise<boolean> => {
    const bars = currentProject.transport.countInBars;
    if (bars <= 0) {
      return true;
    }

    const beatDurationMs = (60 / currentProject.transport.bpm) * 1000;
    const totalBeats = bars * 4;
    const token = countInToken.start();
    setCountInActive(true);
    setCountInBeatsRemaining(totalBeats);

    for (let beatIndex = 0; beatIndex < totalBeats; beatIndex += 1) {
      if (!countInToken.isCurrent(token)) {
        return false;
      }

      engine.previewMetronomeTick(beatIndex % 4 === 0);
      setCountInBeatsRemaining(totalBeats - beatIndex);

      await new Promise((resolve) => {
        window.setTimeout(resolve, beatDurationMs);
      });
    }

    if (!countInToken.isCurrent(token)) {
      return false;
    }

    setCountInActive(false);
    setCountInBeatsRemaining(0);
    return true;
  };

  const startPlaybackWithCountIn = async () => {
    if (await runCountIn()) {
      setIsPlaying(engine.togglePlayback());
    }
  };

  const togglePlay = async () => {
    await ensureAudioReady();

    if (countInActive) {
      cancelCountIn();
      return;
    }

    if (isPlaying) {
      cancelCountIn();
      setIsPlaying(engine.togglePlayback());
      return;
    }

    await startPlaybackWithCountIn();
  };

  const stop = () => {
    cancelCountIn();
    resetTransportState();
  };

  const toggleRecording = async () => {
    await ensureAudioReady();

    if (isRecording) {
      await engine.stopRecording();
      setIsRecording(false);
      return;
    }

    if (!isPlaying) {
      // Count the take in first, then arm recording and roll the transport
      // together on the downbeat so the first notes land on the grid.
      if (!(await runCountIn())) {
        return;
      }
      await engine.startRecording();
      setIsRecording(true);
      setIsPlaying(engine.togglePlayback());
      return;
    }

    await engine.startRecording();
    setIsRecording(true);
  };

  const previewTrack = async (trackId: string, note?: string, sampleSliceIndex?: number, velocity?: number) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      return;
    }

    await ensureAudioReady();
    engine.previewTrack(track, note ?? defaultNoteForTrack(track), sampleSliceIndex, velocity);
  };

  // Single-note audition through a default voice of the given type.
  // Used by the starter-scene cards so reviewers can hear what each
  // template sounds like without loading it.
  const auditionInstrumentNote = async (type: InstrumentType, note: string, velocity = 0.78) => {
    const auditionTrack = createTrack(type, { id: `audition-template-${type}`, name: `Audition ${type}` });
    await ensureAudioReady();
    engine.previewTrack(auditionTrack, note, undefined, velocity);
  };

  // Audition a voice preset against a lane without committing the
  // change. Builds an in-memory preview track that merges the preset's
  // params and source onto the lane, then runs it through engine
  // previewTrack so the user hears exactly what applying the preset
  // would sound like.
  const auditionTrackVoicePreset = async (trackId: string, presetId: string) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) return;
    const preset = getTrackVoicePresetDefinitions(track.type).find((entry) => entry.id === presetId);
    if (!preset) return;
    const auditionTrack: Track = {
      ...track,
      id: `audition-${track.id}-${preset.id}`,
      params: preset.params ? { ...track.params, ...preset.params } : track.params,
      source: preset.source ? { ...track.source, ...preset.source } : track.source,
    };
    await ensureAudioReady();
    engine.previewTrack(auditionTrack, defaultNoteForTrack(auditionTrack), undefined, 0.84);
  };

  return {
    auditionInstrumentNote,
    auditionTrackVoicePreset,
    previewTrack,
    resetTransportState,
    stop,
    togglePlay,
    toggleRecording,
  };
};
