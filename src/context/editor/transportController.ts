import type { MutableRefObject, Dispatch, SetStateAction } from 'react';

import { defaultNoteForTrack, type Project, type Track } from '../../project/schema';

interface TransportEngine {
  init: () => Promise<void>;
  previewMetronomeTick: (isAccent: boolean) => void;
  previewTrack: (track: Track, note: string, sampleSliceIndex?: number) => void;
  startRecording: () => Promise<void>;
  stop: () => void;
  stopRecording: () => Promise<unknown>;
  syncProject: (project: Project) => void;
  togglePlayback: () => boolean;
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
    if (isInitialized) {
      return;
    }

    await initAudio();
    engine.syncProject(currentProject);
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

  const previewTrack = async (trackId: string, note?: string, sampleSliceIndex?: number) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      return;
    }

    await ensureAudioReady();
    engine.previewTrack(track, note ?? defaultNoteForTrack(track), sampleSliceIndex);
  };

  return {
    previewTrack,
    resetTransportState,
    stop,
    togglePlay,
    toggleRecording,
  };
};
