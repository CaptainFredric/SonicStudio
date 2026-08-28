// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShowcaseStage } from './ShowcaseStage';

const togglePlay = vi.fn();

vi.mock('../context/AudioContext', () => ({
  useAudio: () => ({ isPlaying: false, togglePlay }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShowcaseStage', () => {
  it('leads with playback and preserves direct paths into the studio and sharing', () => {
    const onEnterStudio = vi.fn();
    const onOpenShare = vi.fn();
    render(<ShowcaseStage onEnterStudio={onEnterStudio} onOpenShare={onOpenShare} />);

    expect(screen.getByText('Handshake Featured')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hear the song. Then open the machine.' })).toBeTruthy();
    expect(screen.getAllByText('Glass pad').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Play Night Transit' }));
    fireEvent.click(screen.getByRole('button', { name: /Enter full studio/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Share Night Transit' }));

    expect(togglePlay).toHaveBeenCalledOnce();
    expect(onEnterStudio).toHaveBeenCalledOnce();
    expect(onOpenShare).toHaveBeenCalledOnce();
  });
});
