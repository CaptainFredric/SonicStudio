// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { OnboardingGuide } from './OnboardingGuide';

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    })),
  });
});

describe('OnboardingGuide', () => {
  it('turns showcase links into a focused three step preview with direct playback', () => {
    const onComplete = vi.fn();
    const onTogglePlayback = vi.fn();

    render(
      <OnboardingGuide
        isPlaying={false}
        mode="showcase"
        onComplete={onComplete}
        onSkip={vi.fn()}
        onTogglePlayback={onTogglePlayback}
        open
      />,
    );

    expect(screen.getByText('Quick preview')).toBeTruthy();
    expect(screen.getByText('Listen · 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play Night Transit' }));
    expect(onTogglePlayback).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Shape · 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter studio' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('keeps the complete eight step tour available inside the studio', () => {
    render(
      <OnboardingGuide
        isPlaying={false}
        mode="tour"
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        onTogglePlayback={vi.fn()}
        open
      />,
    );

    expect(screen.getByText('Start here · 1 of 8')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play Night Transit' })).toBeNull();
  });
});
