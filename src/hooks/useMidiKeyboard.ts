import { useEffect, useEffectEvent, useState } from 'react';

import { MidiInputManager, type MidiNoteMessage } from '../audio/midiInput';

interface MidiKeyboardState {
  devices: string[];
  supported: boolean;
}

// Owns a Web MIDI connection while `enabled`, forwarding note messages to the
// latest `onNote` and exposing the connected device names. Requesting access
// happens only when the user opts in (it can prompt for permission), and
// everything is guarded so an unsupported browser is a quiet no-op.
export const useMidiKeyboard = (
  enabled: boolean,
  onNote: (message: MidiNoteMessage) => void,
): MidiKeyboardState => {
  const [devices, setDevices] = useState<string[]>([]);
  const supported = MidiInputManager.isSupported();
  const handleNote = useEffectEvent((message: MidiNoteMessage) => {
    onNote(message);
  });

  useEffect(() => {
    if (!enabled || !supported) {
      return undefined;
    }

    const manager = new MidiInputManager();
    manager.onNote(handleNote);
    manager.onDevices(setDevices);
    void manager.enable();

    return () => {
      manager.onNote(null);
      manager.onDevices(null);
      manager.disable();
    };
  }, [enabled, supported]);

  return { devices: enabled && supported ? devices : [], supported };
};
