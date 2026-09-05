// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setNotesPanelOpen } from './notesPanelStore';
import { PianoRollView } from './PianoRollView';

const { useAudioMock } = vi.hoisted(() => ({ useAudioMock: vi.fn() }));

vi.mock('../context/AudioContext', () => ({
  useAudio: () => useAudioMock(),
}));

vi.mock('./PianoRoll', () => ({
  PianoRoll: () => <div data-testid="pattern-piano-roll" />,
}));

vi.mock('./WholeSongPianoRoll', () => ({
  WholeSongPianoRoll: () => <div data-testid="song-piano-roll" />,
}));

const setTransportMode = (transportMode: 'PATTERN' | 'SONG') => {
  useAudioMock.mockReturnValue({
    selectedTrackId: 'lead',
    tracks: [{ id: 'lead', name: 'Lead', type: 'lead' }],
    transportMode,
  });
};

afterEach(() => {
  cleanup();
  act(() => setNotesPanelOpen(false));
  vi.clearAllMocks();
});

describe('PianoRollView editing scope', () => {
  it('opens the whole-song editor for the normal Song dock', () => {
    setTransportMode('SONG');
    act(() => setNotesPanelOpen(true));

    render(<PianoRollView />);

    expect(screen.getByTestId('song-piano-roll')).toBeTruthy();
    expect(screen.queryByTestId('pattern-piano-roll')).toBeNull();
    expect(screen.getByText('Song piano roll')).toBeTruthy();
  });

  it('opens the selected pattern editor for a clip without changing Song transport', () => {
    setTransportMode('SONG');
    act(() => setNotesPanelOpen(true, 'clip'));

    render(<PianoRollView />);

    expect(screen.getByTestId('pattern-piano-roll')).toBeTruthy();
    expect(screen.queryByTestId('song-piano-roll')).toBeNull();
    expect(screen.getByText('Clip piano roll')).toBeTruthy();
    expect(screen.getByText(/Linked clips update together/)).toBeTruthy();
  });

  it('keeps Pattern transport on the pattern editor', () => {
    setTransportMode('PATTERN');
    act(() => setNotesPanelOpen(true));

    render(<PianoRollView />);

    expect(screen.getByTestId('pattern-piano-roll')).toBeTruthy();
    expect(screen.getByText('Pattern piano roll')).toBeTruthy();
  });
});
