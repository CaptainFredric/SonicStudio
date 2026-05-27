// Smart suggestions.
//
// Reads the user's current session and surfaces a few human-readable
// next-step tips. Uses pattern-recognition heuristics, not ML, so the
// output is deterministic and cheap. Pairs naturally with the live
// key detector — every melodic suggestion is named in the session's
// detected key when one is confident.
//
// Each suggestion carries an optional trackId so a UI surface can
// jump to the relevant lane on tap.

import type { Track } from '../project/schema';
import { detectKey } from './keyDetector';

export type SuggestionTone = 'tip' | 'attention';

export interface SmartSuggestion {
  id: string;
  title: string;
  detail: string;
  tone: SuggestionTone;
  trackId?: string;
}

const DRUM_TYPES = new Set<Track['type']>(['kick', 'snare', 'hihat']);
const MELODIC_TYPES = new Set<Track['type']>(['bass', 'lead', 'pad', 'pluck', 'violin', 'piano', 'bell']);

interface TrackStats {
  track: Track;
  noteCount: number;
  density: number; // active steps / total steps
  hasDownbeat: boolean;
}

const computeTrackStats = (track: Track): TrackStats => {
  let noteCount = 0;
  let activeSteps = 0;
  let totalSteps = 0;
  let hasDownbeat = false;
  Object.values(track.patterns).forEach((stepGrid) => {
    stepGrid.forEach((step, stepIndex) => {
      totalSteps += 1;
      if (step.length > 0) {
        activeSteps += 1;
        noteCount += step.length;
        if (stepIndex % 16 === 0) hasDownbeat = true;
      }
    });
  });
  return {
    track,
    noteCount,
    density: totalSteps === 0 ? 0 : activeSteps / totalSteps,
    hasDownbeat,
  };
};

export const computeSmartSuggestions = (tracks: Track[]): SmartSuggestion[] => {
  if (tracks.length === 0) return [];
  const key = detectKey(tracks);
  const keyHint = key.uncertain ? 'your session' : key.label;
  const stats = tracks.map(computeTrackStats);
  const suggestions: SmartSuggestion[] = [];

  // 1. Empty melodic lanes worth filling.
  for (const entry of stats) {
    if (!MELODIC_TYPES.has(entry.track.type)) continue;
    if (entry.noteCount > 0) continue;
    suggestions.push({
      id: `empty-${entry.track.id}`,
      title: `${entry.track.name} is empty`,
      detail: `Try a melody in ${keyHint}.`,
      tone: 'tip',
      trackId: entry.track.id,
    });
  }

  // 2. Drum lanes with no downbeat anchor.
  for (const entry of stats) {
    if (!DRUM_TYPES.has(entry.track.type)) continue;
    if (entry.noteCount === 0) {
      suggestions.push({
        id: `drums-empty-${entry.track.id}`,
        title: `${entry.track.name} has no hits`,
        detail: entry.track.type === 'kick'
          ? 'Try a four-on-the-floor or downbeat anchor.'
          : entry.track.type === 'snare'
            ? 'Try backbeats on steps 5 and 13.'
            : 'Try eighth-note hats for steady motion.',
        tone: 'tip',
        trackId: entry.track.id,
      });
    } else if (!entry.hasDownbeat) {
      suggestions.push({
        id: `drums-no-downbeat-${entry.track.id}`,
        title: `${entry.track.name} skips step 1`,
        detail: 'A hit on step 1 anchors the bar.',
        tone: 'attention',
        trackId: entry.track.id,
      });
    }
  }

  // 3. Dense melodic lanes that might be crowding the mix.
  for (const entry of stats) {
    if (!MELODIC_TYPES.has(entry.track.type)) continue;
    if (entry.density > 0.7 && entry.track.type !== 'pad') {
      suggestions.push({
        id: `dense-${entry.track.id}`,
        title: `${entry.track.name} is busy`,
        detail: 'Removing a few notes can give the lane room to breathe.',
        tone: 'attention',
        trackId: entry.track.id,
      });
    }
  }

  // 4. No bass anchor.
  const hasBass = stats.some((entry) => entry.track.type === 'bass' && entry.noteCount > 0);
  if (!hasBass && stats.some((entry) => entry.track.type === 'bass')) {
    const bassLane = stats.find((entry) => entry.track.type === 'bass');
    if (bassLane) {
      suggestions.push({
        id: `bass-anchor-${bassLane.track.id}`,
        title: 'Bass is silent',
        detail: key.uncertain
          ? 'A root note anchor under each chord pulls the mix together.'
          : `Try ${key.rootName}1 or ${key.rootName}2 to anchor each chord.`,
        tone: 'tip',
        trackId: bassLane.track.id,
      });
    }
  }

  // 5. No melodic content at all.
  const melodicNotes = stats
    .filter((entry) => MELODIC_TYPES.has(entry.track.type))
    .reduce((sum, entry) => sum + entry.noteCount, 0);
  if (melodicNotes === 0) {
    suggestions.push({
      id: 'no-melodic-content',
      title: 'No melody yet',
      detail: 'Open a Chord starter or use Alt+C to capture a string.',
      tone: 'tip',
    });
  }

  return suggestions;
};
