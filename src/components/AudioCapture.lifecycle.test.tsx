// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_STUDIO_PREFERENCES } from '../project/preferences';
import { AudioCapture } from './AudioCapture';

const recorderSpies = vi.hoisted(() => ({
  cancel: vi.fn(),
  onLiveUpdate: vi.fn(),
  setPitchThreshold: vi.fn(),
  start: vi.fn(async () => undefined),
}));

vi.mock('../context/AudioContext', () => ({
  useAudio: () => ({
    applyTrackVoicePreset: vi.fn(),
    capturePreferences: DEFAULT_STUDIO_PREFERENCES.capture,
    createTrack: vi.fn(),
    initAudio: vi.fn(async () => undefined),
    selectedTrackId: null,
    setSelectedTrackId: vi.fn(),
    setTrackParams: vi.fn(),
    setTrackSource: vi.fn(),
    stampChord: vi.fn(),
    tracks: [],
  }),
}));

vi.mock('../services/audioRecording', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/audioRecording')>();
  return {
    ...actual,
    AudioRecorder: class {
      cancel = recorderSpies.cancel;
      isSupported = () => true;
      onLiveUpdate = recorderSpies.onLiveUpdate;
      setPitchThreshold = recorderSpies.setPitchThreshold;
      start = recorderSpies.start;
    },
  };
});

vi.mock('../services/recordedNoteLibrary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/recordedNoteLibrary')>();
  return {
    ...actual,
    loadRecordedNotePresets: () => [],
    subscribeRecordedNotePresets: () => () => undefined,
  };
});

vi.mock('../services/vocalTakeLibrary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/vocalTakeLibrary')>();
  return {
    ...actual,
    listVocalTakeSummaries: async () => [],
    subscribeVocalTakeSummaries: () => () => undefined,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AudioCapture lifecycle', () => {
  it('mounts content only while open and cancels an active recorder on close', async () => {
    const view = render(<AudioCapture open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy());

    view.rerender(<AudioCapture open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(recorderSpies.cancel).toHaveBeenCalledOnce();
  });

  it('cancels a recorder whose microphone startup finishes after close', async () => {
    let finishStarting: (() => void) | null = null;
    recorderSpies.start.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishStarting = resolve;
    }));
    const view = render(<AudioCapture open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Waiting for microphone…' }).hasAttribute('disabled')).toBe(true);
    view.rerender(<AudioCapture open={false} onClose={vi.fn()} />);
    finishStarting?.();

    await waitFor(() => expect(recorderSpies.cancel).toHaveBeenCalledOnce());
  });
});
