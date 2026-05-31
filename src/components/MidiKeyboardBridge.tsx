import { useAudio, usePlaybackStep } from '../context/AudioContext';
import { useMidiKeyboard } from '../hooks/useMidiKeyboard';
import { midiToNote } from '../context/editor/reducer/reducerUtils';
import { shouldRecordMidiNote } from '../audio/midiInput';

// Bridges a hardware MIDI keyboard to the engine. It lives in its own tiny,
// null-rendering component on purpose: recording needs the live playhead, and
// subscribing to it here re-renders only this node each sequencer step instead
// of the whole studio shell. Played notes always audition the selected lane's
// voice; while recording is armed and the transport is running, they also land
// on the step the playhead is passing.
export const MidiKeyboardBridge = () => {
  const {
    midiInputEnabled,
    midiRecordEnabled,
    isPlaying,
    previewTrack,
    recordStepNote,
    selectedTrackId,
    tracks,
  } = useAudio();
  const currentStep = usePlaybackStep();

  useMidiKeyboard(midiInputEnabled, (message) => {
    if (message.type !== 'noteon' || typeof message.note !== 'number') {
      return;
    }
    const targetTrackId = selectedTrackId ?? tracks[0]?.id;
    if (!targetTrackId) {
      return;
    }
    const note = midiToNote(message.note);
    void previewTrack(targetTrackId, note, undefined, message.velocity ?? 0.8);
    if (shouldRecordMidiNote({ recordEnabled: midiRecordEnabled, isPlaying, message })) {
      recordStepNote(targetTrackId, currentStep, note);
    }
  });

  return null;
};
