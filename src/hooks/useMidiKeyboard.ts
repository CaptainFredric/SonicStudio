import { useEffect, useRef, useState } from 'react';

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
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  useEffect(() => {
    if (!enabled || !MidiInputManager.isSupported()) {
      setDevices([]);
      return undefined;
    }

    const manager = new MidiInputManager();
    manager.onNote((message) => onNoteRef.current(message));
    manager.onDevices(setDevices);
    void manager.enable();

    return () => {
      manager.onNote(null);
      manager.onDevices(null);
      manager.disable();
    };
  }, [enabled]);

  return { devices, supported: MidiInputManager.isSupported() };
};
