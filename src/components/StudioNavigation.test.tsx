// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileStudioNavigation } from './StudioNavigation';

const setActiveView = vi.fn();
const toggleSettings = vi.fn();

vi.mock('../context/AudioContext', () => ({
  useAudio: () => ({
    activeView: 'SEQUENCER',
    isSettingsOpen: false,
    setActiveView,
    toggleSettings,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MobileStudioNavigation', () => {
  it('keeps the core studio actions persistent and moves secondary work into one sheet', () => {
    const onOpenRecord = vi.fn();
    const onOpenShare = vi.fn();
    const onOpenTranscribe = vi.fn();
    render(
      <MobileStudioNavigation
        onEnterEditingMode={vi.fn()}
        onOpenLaunchpad={vi.fn()}
        onOpenRecord={onOpenRecord}
        onOpenShare={onOpenShare}
        onOpenTranscribe={onOpenTranscribe}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Mobile studio navigation' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mixer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Capture sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share this session' }));
    expect(setActiveView).toHaveBeenCalledWith('SEQUENCER');
    expect(setActiveView).toHaveBeenCalledWith('MIXER');
    expect(onOpenRecord).toHaveBeenCalledOnce();
    expect(onOpenShare).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'More studio actions' }));
    expect(screen.getByRole('dialog', { name: 'More studio actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe' }));
    expect(onOpenTranscribe).toHaveBeenCalledOnce();
  });
});
