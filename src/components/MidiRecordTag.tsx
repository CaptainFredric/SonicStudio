import { useAudio } from '../context/AudioContext';

// Small transport tag that lights up only while MIDI notes are actually being
// captured: the keyboard is on, recording is armed, and the transport is
// running. It is the feedback counterpart to the MIDI record toggle in
// Settings, so it is clear when played notes are landing on the grid.
export const MidiRecordTag = ({ className = '' }: { className?: string }) => {
  const { midiInputEnabled, midiRecordEnabled, isPlaying } = useAudio();

  if (!(midiInputEnabled && midiRecordEnabled && isPlaying)) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(248,113,113,0.9)] ${className}`}
      title="Recording played MIDI notes onto the selected lane"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[rgba(248,113,113,0.95)] animate-pulse" />
      MIDI
    </span>
  );
};
