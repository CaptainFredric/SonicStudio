import { useAudio } from '../context/AudioContext';
import { Arranger } from './Arranger';

// The Arranger is the song-level tab in the shared inspector. Its outer tab is
// always visible while this body is open, so the old second collapse header is
// intentionally gone.
export const ArrangementPanel = () => {
  const { activeView } = useAudio();

  if (activeView !== 'SEQUENCER') {
    return null;
  }

  return (
    <div className="arrangement-panel flex min-h-0 flex-col" data-studio-panel-body="arrangement" style={{ height: 'clamp(360px, 58vh, 640px)' }}>
      <Arranger />
    </div>
  );
};
