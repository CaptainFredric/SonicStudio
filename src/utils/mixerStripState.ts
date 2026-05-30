// Mixer strip audibility helpers.
//
// Tone's Channel.solo silences every channel that is not soloed the moment
// any track is soloed. The mixer needs to mirror that so a strip can show
// when it is being held quiet by someone else's solo, rather than looking
// active while producing no sound.

import type { Track } from '../project/schema';

export const anyTrackSoloed = (tracks: Array<Pick<Track, 'solo'>>): boolean => (
  tracks.some((track) => track.solo)
);

// A strip is silenced by solo when at least one other track is soloed and
// this one is neither soloed nor already muted (an explicit mute is shown on
// its own, so we do not double-label it).
export const isSilencedBySolo = (
  track: Pick<Track, 'solo' | 'muted'>,
  anySolo: boolean,
): boolean => anySolo && !track.solo && !track.muted;
