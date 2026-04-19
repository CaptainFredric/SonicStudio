import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectFromTemplate, defaultNoteForTrack } from '../../project/schema';
import { createTransportController } from './transportController';

describe('transportController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs the count in before starting playback', async () => {
    const project = createProjectFromTemplate('blank-grid');
    project.transport.countInBars = 1;
    project.transport.bpm = 120;

    const engine = {
      init: vi.fn(),
      previewMetronomeTick: vi.fn(),
      previewTrack: vi.fn(),
      startRecording: vi.fn(),
      stop: vi.fn(),
      stopRecording: vi.fn(),
      syncProject: vi.fn(),
      togglePlayback: vi.fn(() => true),
    };

    const setCountInActive = vi.fn();
    const setCountInBeatsRemaining = vi.fn();
    const setCurrentStep = vi.fn();
    const setIsPlaying = vi.fn();
    const setIsRecording = vi.fn();

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef: { current: 0 },
      currentProject: project,
      engine,
      initAudio: vi.fn(),
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive,
      setCountInBeatsRemaining,
      setCurrentStep,
      setIsPlaying,
      setIsRecording,
      tracks: project.tracks,
    });

    const playbackPromise = controller.togglePlay();
    await vi.advanceTimersByTimeAsync(2_000);
    await playbackPromise;

    expect(engine.previewMetronomeTick.mock.calls.map(([isAccent]) => isAccent)).toEqual([true, false, false, false]);
    expect(setCountInActive).toHaveBeenNthCalledWith(1, true);
    expect(setCountInActive).toHaveBeenLastCalledWith(false);
    expect(setCountInBeatsRemaining.mock.calls.map(([beats]) => beats)).toEqual([4, 4, 3, 2, 1, 0]);
    expect(setIsPlaying).toHaveBeenLastCalledWith(true);
    expect(engine.togglePlayback).toHaveBeenCalledTimes(1);
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it('starts recording and transport together when recording begins from idle', async () => {
    const project = createProjectFromTemplate('blank-grid');
    project.transport.countInBars = 0;

    const engine = {
      init: vi.fn(),
      previewMetronomeTick: vi.fn(),
      previewTrack: vi.fn(),
      startRecording: vi.fn(),
      stop: vi.fn(),
      stopRecording: vi.fn(),
      syncProject: vi.fn(),
      togglePlayback: vi.fn(() => true),
    };

    const setIsPlaying = vi.fn();
    const setIsRecording = vi.fn();

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef: { current: 0 },
      currentProject: project,
      engine,
      initAudio: vi.fn(),
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive: vi.fn(),
      setCountInBeatsRemaining: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsPlaying,
      setIsRecording,
      tracks: project.tracks,
    });

    await controller.toggleRecording();

    expect(engine.startRecording).toHaveBeenCalledTimes(1);
    expect(setIsRecording).toHaveBeenCalledWith(true);
    expect(engine.togglePlayback).toHaveBeenCalledTimes(1);
    expect(setIsPlaying).toHaveBeenCalledWith(true);
  });

  it('initializes audio before previewing a track with its default note', async () => {
    const project = createProjectFromTemplate('blank-grid');
    const previewTrackTarget = project.tracks.find((track) => track.type === 'lead') ?? project.tracks[0];
    if (!previewTrackTarget) {
      throw new Error('Expected preview track');
    }

    const engine = {
      init: vi.fn(),
      previewMetronomeTick: vi.fn(),
      previewTrack: vi.fn(),
      startRecording: vi.fn(),
      stop: vi.fn(),
      stopRecording: vi.fn(),
      syncProject: vi.fn(),
      togglePlayback: vi.fn(() => true),
    };
    const initAudio = vi.fn();

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef: { current: 0 },
      currentProject: project,
      engine,
      initAudio,
      isInitialized: false,
      isPlaying: false,
      isRecording: false,
      setCountInActive: vi.fn(),
      setCountInBeatsRemaining: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsPlaying: vi.fn(),
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.previewTrack(previewTrackTarget.id);

    expect(initAudio).toHaveBeenCalledTimes(1);
    expect(engine.syncProject).toHaveBeenCalledWith(project);
    expect(engine.previewTrack).toHaveBeenCalledWith(
      previewTrackTarget,
      defaultNoteForTrack(previewTrackTarget),
      undefined,
    );
  });
});
