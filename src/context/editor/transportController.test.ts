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
      awaitAssetLoad: vi.fn(),
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
      awaitAssetLoad: vi.fn(),
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
      awaitAssetLoad: vi.fn(),
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
    expect(engine.awaitAssetLoad).toHaveBeenCalledTimes(1);
    expect(engine.previewTrack).toHaveBeenCalledWith(
      previewTrackTarget,
      defaultNoteForTrack(previewTrackTarget),
      undefined,
      undefined,
    );
  });

  it('re-arms audio before playback even after initialization so suspended contexts resume', async () => {
    const project = createProjectFromTemplate('blank-grid');
    const engine = {
      awaitAssetLoad: vi.fn(),
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
    const setIsPlaying = vi.fn();

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef: { current: 0 },
      currentProject: project,
      engine,
      initAudio,
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive: vi.fn(),
      setCountInBeatsRemaining: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsPlaying,
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.togglePlay();

    expect(initAudio).toHaveBeenCalledTimes(1);
    expect(engine.syncProject).toHaveBeenCalledWith(project);
    expect(engine.awaitAssetLoad).toHaveBeenCalledTimes(1);
    expect(engine.togglePlayback).toHaveBeenCalledTimes(1);
    expect(setIsPlaying).toHaveBeenCalledWith(true);
  });

  it('continues playback when sample asset loading fails', async () => {
    const project = createProjectFromTemplate('blank-grid');
    const loadError = new Error('decode failed');
    const engine = {
      awaitAssetLoad: vi.fn(() => Promise.reject(loadError)),
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
    const setIsPlaying = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef: { current: 0 },
      currentProject: project,
      engine,
      initAudio,
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive: vi.fn(),
      setCountInBeatsRemaining: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsPlaying,
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.togglePlay();

    expect(initAudio).toHaveBeenCalledTimes(1);
    expect(engine.syncProject).toHaveBeenCalledWith(project);
    expect(engine.awaitAssetLoad).toHaveBeenCalledTimes(1);
    expect(engine.togglePlayback).toHaveBeenCalledTimes(1);
    expect(setIsPlaying).toHaveBeenCalledWith(true);
    expect(warnSpy).toHaveBeenCalledWith(
      'SonicStudio: sample asset load failed; continuing playback with available sources.',
      loadError,
    );

    warnSpy.mockRestore();
  });

  it('passes preview velocity through to the engine', async () => {
    const project = createProjectFromTemplate('blank-grid');
    const previewTrackTarget = project.tracks.find((track) => track.type === 'hihat') ?? project.tracks[0];
    if (!previewTrackTarget) {
      throw new Error('Expected preview target');
    }

    const engine = {
      awaitAssetLoad: vi.fn(),
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
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive: vi.fn(),
      setCountInBeatsRemaining: vi.fn(),
      setCurrentStep: vi.fn(),
      setIsPlaying: vi.fn(),
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.previewTrack(previewTrackTarget.id, undefined, undefined, 0.55);

    expect(engine.awaitAssetLoad).toHaveBeenCalledTimes(1);
    expect(engine.previewTrack).toHaveBeenCalledWith(
      previewTrackTarget,
      defaultNoteForTrack(previewTrackTarget),
      undefined,
      0.55,
    );
  });

  it('cancels active count-in when play is pressed again rapidly', async () => {
    const project = createProjectFromTemplate('blank-grid');

    const engine = {
      awaitAssetLoad: vi.fn(),
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
    const setIsPlaying = vi.fn();
    const countInTokenRef = { current: 3 };

    const controller = createTransportController({
      countInActive: true,
      countInTokenRef,
      currentProject: project,
      engine,
      initAudio: vi.fn(),
      isInitialized: true,
      isPlaying: false,
      isRecording: false,
      setCountInActive,
      setCountInBeatsRemaining,
      setCurrentStep: vi.fn(),
      setIsPlaying,
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.togglePlay();

    expect(setCountInActive).toHaveBeenCalledWith(false);
    expect(setCountInBeatsRemaining).toHaveBeenCalledWith(0);
    expect(engine.togglePlayback).not.toHaveBeenCalled();
    expect(setIsPlaying).not.toHaveBeenCalled();
    expect(countInTokenRef.current).toBe(4);
  });

  it('toggles playback off immediately when already playing', async () => {
    const project = createProjectFromTemplate('blank-grid');

    const engine = {
      awaitAssetLoad: vi.fn(),
      init: vi.fn(),
      previewMetronomeTick: vi.fn(),
      previewTrack: vi.fn(),
      startRecording: vi.fn(),
      stop: vi.fn(),
      stopRecording: vi.fn(),
      syncProject: vi.fn(),
      togglePlayback: vi.fn(() => false),
    };

    const setCountInActive = vi.fn();
    const setCountInBeatsRemaining = vi.fn();
    const setIsPlaying = vi.fn();
    const countInTokenRef = { current: 8 };

    const controller = createTransportController({
      countInActive: false,
      countInTokenRef,
      currentProject: project,
      engine,
      initAudio: vi.fn(),
      isInitialized: true,
      isPlaying: true,
      isRecording: false,
      setCountInActive,
      setCountInBeatsRemaining,
      setCurrentStep: vi.fn(),
      setIsPlaying,
      setIsRecording: vi.fn(),
      tracks: project.tracks,
    });

    await controller.togglePlay();

    expect(setCountInActive).toHaveBeenCalledWith(false);
    expect(setCountInBeatsRemaining).toHaveBeenCalledWith(0);
    expect(engine.togglePlayback).toHaveBeenCalledTimes(1);
    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(countInTokenRef.current).toBe(9);
  });
});
