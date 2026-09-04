// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMediaQuery } from './useMediaQuery';

const QueryProbe = () => (
  <div>{useMediaQuery('(max-width: 767px)') ? 'Mobile' : 'Desktop'}</div>
);

describe('useMediaQuery', () => {
  it('subscribes to viewport changes without a synchronization render', () => {
    let matches = false;
    let listener: (() => void) | null = null;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: (_type: string, nextListener: () => void) => {
          listener = nextListener;
        },
        matches,
        media: '(max-width: 767px)',
        removeEventListener: vi.fn(),
      })),
    });

    const view = render(<QueryProbe />);
    expect(view.getByText('Desktop')).toBeTruthy();

    matches = true;
    act(() => listener?.());

    expect(view.getByText('Mobile')).toBeTruthy();
  });
});
