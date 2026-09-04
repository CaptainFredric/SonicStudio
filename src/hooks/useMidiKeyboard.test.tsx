// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMidiKeyboard } from './useMidiKeyboard';
import type { MidiNoteMessage } from '../audio/midiInput';

const MidiProbe = ({
  enabled,
  onNote,
}: {
  enabled: boolean;
  onNote: (message: MidiNoteMessage) => void;
}) => {
  const { devices, supported } = useMidiKeyboard(enabled, onNote);
  return <div>{supported ? devices.join(', ') || 'No devices' : 'Unsupported'}</div>;
};

describe('useMidiKeyboard', () => {
  it('uses the latest note callback and releases the device when disabled', async () => {
    const input = {
      name: 'Keys 49',
      onmidimessage: null as ((event: { data: Uint8Array }) => void) | null,
    };
    const access = {
      inputs: { forEach: (callback: (entry: typeof input) => void) => callback(input) },
      onstatechange: null as ((event: unknown) => void) | null,
    };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn().mockResolvedValue(access),
    });

    const firstOnNote = vi.fn();
    const secondOnNote = vi.fn();
    const view = render(<MidiProbe enabled onNote={firstOnNote} />);

    await waitFor(() => expect(view.getByText('Keys 49')).toBeTruthy());
    view.rerender(<MidiProbe enabled onNote={secondOnNote} />);

    act(() => {
      input.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]) });
    });

    expect(firstOnNote).not.toHaveBeenCalled();
    expect(secondOnNote).toHaveBeenCalledWith({
      note: 60,
      type: 'noteon',
      velocity: 100 / 127,
    });

    view.rerender(<MidiProbe enabled={false} onNote={secondOnNote} />);
    expect(view.getByText('No devices')).toBeTruthy();
    expect(input.onmidimessage).toBeNull();
  });
});
