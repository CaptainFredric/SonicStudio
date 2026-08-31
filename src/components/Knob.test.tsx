// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Knob } from './Knob';

describe('Knob help', () => {
  it('opens concise, control-specific help and closes it again', () => {
    const view = render(
      <Knob label="Reverb" max={1} min={0} onChange={vi.fn()} value={0.4} />,
    );
    const helpButton = view.getByRole('button', { name: 'About Reverb' });

    expect(view.queryByRole('tooltip')).toBeNull();
    fireEvent.click(helpButton);
    expect(view.getByRole('tooltip').textContent).toContain('room reflections');
    expect(helpButton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(helpButton);
    expect(view.queryByRole('tooltip')).toBeNull();
  });
});
