// Web MIDI input: let a connected hardware MIDI keyboard play the selected
// track's voice. The project does not ship Web MIDI type definitions, so the
// few shapes we touch are declared here and the navigator hop is cast once.

export interface MidiNoteMessage {
  type: 'noteon' | 'noteoff' | 'other';
  // Raw MIDI note number, 0..127.
  note?: number;
  // Normalised 0..1 velocity.
  velocity?: number;
}

// A MIDI message is [status, data1, data2]. The high nibble of status is the
// command: 0x90 note on, 0x80 note off. A note on with velocity 0 is the
// running-status way of saying note off, so we fold it in.
export const parseMidiMessage = (data: ArrayLike<number> | null | undefined): MidiNoteMessage => {
  if (!data || data.length < 1) {
    return { type: 'other' };
  }
  const command = data[0] & 0xf0;
  const note = data.length > 1 ? data[1] : undefined;
  const rawVelocity = data.length > 2 ? data[2] : 0;

  if (command === 0x90 && rawVelocity > 0) {
    return { type: 'noteon', note, velocity: Math.max(0, Math.min(1, rawVelocity / 127)) };
  }
  if (command === 0x80 || (command === 0x90 && rawVelocity === 0)) {
    return { type: 'noteoff', note, velocity: 0 };
  }
  return { type: 'other' };
};

// Recording is opt-in and only meaningful while the transport runs: a played
// note lands on whatever step the playhead is passing. Outside playback, or
// with recording off, incoming notes only audition (handled by the caller).
export const shouldRecordMidiNote = (params: {
  recordEnabled: boolean;
  isPlaying: boolean;
  message: MidiNoteMessage;
}): boolean => (
  params.recordEnabled
  && params.isPlaying
  && params.message.type === 'noteon'
  && typeof params.message.note === 'number'
);

interface MidiMessageEventLike {
  data: Uint8Array;
}

interface MidiInputLike {
  name?: string | null;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiAccessLike {
  inputs: { forEach: (callback: (input: MidiInputLike) => void) => void };
  onstatechange: ((event: unknown) => void) | null;
}

interface NavigatorWithMidi {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;
}

type NoteListener = (message: MidiNoteMessage) => void;
type DevicesListener = (deviceNames: string[]) => void;

export class MidiInputManager {
  private access: MidiAccessLike | null = null;
  private noteListener: NoteListener | null = null;
  private devicesListener: DevicesListener | null = null;
  private active = false;

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && typeof (navigator as unknown as NavigatorWithMidi).requestMIDIAccess === 'function';
  }

  public onNote(listener: NoteListener | null): void {
    this.noteListener = listener;
  }

  public onDevices(listener: DevicesListener | null): void {
    this.devicesListener = listener;
  }

  public async enable(): Promise<boolean> {
    if (!MidiInputManager.isSupported()) {
      return false;
    }
    try {
      const request = (navigator as unknown as NavigatorWithMidi).requestMIDIAccess;
      this.access = await request!({ sysex: false });
    } catch {
      this.access = null;
      return false;
    }
    this.active = true;
    this.attachInputs();
    this.access.onstatechange = () => this.attachInputs();
    return true;
  }

  public disable(): void {
    this.active = false;
    if (this.access) {
      this.access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      this.access.onstatechange = null;
    }
    this.access = null;
    this.devicesListener?.([]);
  }

  private attachInputs(): void {
    if (!this.access) {
      return;
    }
    const names: string[] = [];
    this.access.inputs.forEach((input) => {
      names.push((input.name ?? '').trim() || 'MIDI device');
      input.onmidimessage = (event) => {
        if (!this.active || !this.noteListener) {
          return;
        }
        const message = parseMidiMessage(event.data);
        if (message.type !== 'other') {
          this.noteListener(message);
        }
      };
    });
    this.devicesListener?.(names);
  }
}
