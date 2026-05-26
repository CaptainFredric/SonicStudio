import type { MutableRefObject, Dispatch, SetStateAction } from 'react';

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
  countInTokenRef: MutableRefObject<number>;
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

export const createTransportController = ({
  countInActive,
  countInTokenRef,
  currentProject,
  engine,
  initAudio,
  isInitialized,
  isPlaying,
  isRecording,
  setCountInActive,
  setCountInBeatsRemaining,
  setCurrentStep,
  setIsPlaying,
  setIsRecording,
  tracks,
}: CreateTransportControllerOptions) => {
  const ensureAudioReady = async () => {
    // Resume Tone's context synchronously inside the user gesture before
    // any await — uiSounds use a separate context that auto-resumes, so
    // without this kick Tone could stay suspended and music goes silent
    // while UI clicks still play.
    engine.wakeContext();
    await initAudio();
    engine.syncProject(currentProject);

    if (currentProject.tracks.some((track) => track.source.engine === 'sample')) {
      try {
        await engine.awaitAssetLoad();
      } catch (error) {
        // Keep transport usable even if one sample source fails to decode.
        console.warn('SonicStudio: sample asset load failed; continuing playback with available sources.', error);
      }
    }
  };

  const cancelCountIn = () => {
    countInTokenRef.current += 1;
    setCountInActive(false);
    setCountInBeatsRemaining(0);
  };

  const resetTransportState = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const startPlaybackWithCountIn = async () => {
    const bars = currentProject.transport.countInBars;
    if (bars <= 0) {
      setIsPlaying(engine.togglePlayback());
      return;
    }

    const beatDurationMs = (60 / currentProject.transport.bpm) * 1000;
    const totalBeats = bars * 4;
    const token = countInTokenRef.current + 1;
    countInTokenRef.current = token;
    setCountInActive(true);
    setCountInBeatsRemaining(totalBeats);

    for (let beatIndex = 0; beatIndex < totalBeats; beatIndex += 1) {
      if (countInTokenRef.current !== token) {
        return;
      }

      engine.previewMetronomeTick(beatIndex % 4 === 0);
      setCountInBeatsRemaining(totalBeats - beatIndex);

      await new Promise((resolve) => {
        window.setTimeout(resolve, beatDurationMs);
      });
    }

    if (countInTokenRef.current !== token) {
      return;
    }

    setCountInActive(false);
    setCountInBeatsRemaining(0);
    setIsPlaying(engine.togglePlayback());
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

    await engine.startRecording();
    setIsRecording(true);

    if (!isPlaying) {
      await togglePlay();
    }
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
