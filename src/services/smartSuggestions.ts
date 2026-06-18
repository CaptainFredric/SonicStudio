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
import { detectPatternKeyDrift, getEffectiveKey } from './keyDetector';
import { suggestNextChords } from './nextChord';
import type { CapturedNoteToken } from './noteStringLibrary';

export type SuggestionTone = 'tip' | 'attention';

export type SmartSuggestionAction =
  | {
      kind: 'place-steps';
      trackId: string;
      steps: Array<{ stepIndex: number; note: string }>;
    }
  | {
      kind: 'apply-preset';
      trackId: string;
      presetId: string;
    }
  | {
      kind: 'save-and-queue-string';
      name: string;
      tokens: CapturedNoteToken[];
    }
  | {
      kind: 'trim-drift';
      patternIndex: number;
    };

export interface SmartSuggestion {
  id: string;
  title: string;
  detail: string;
  tone: SuggestionTone;
  trackId?: string;
  action?: SmartSuggestionAction;
  actionLabel?: string;
}

// One-tap voice recommendations for sparse / empty lanes. Pulled from
// the preset library by id so the suggestion panel does not need to
// know the preset's internal shape.
// Exported so a registry test can confirm each recommended preset id still
// exists and applies to the track type it is offered for.
export const PRESET_RECOMMENDATIONS: Record<string, { presetId: string; label: string }> = {
  pad: { presetId: 'tape-warmth', label: 'Try Tape Warmth on this pad' },
  violin: { presetId: 'bowed-ribbon', label: 'Try Bowed Ribbon on this violin' },
  bell: { presetId: 'glass-bell', label: 'Try Glass Bell on this bell' },
  lead: { presetId: 'whistle-breath', label: 'Try Whistle Breath on this lead' },
  bass: { presetId: 'round-sub', label: 'Try Round Sub on this bass' },
  piano: { presetId: 'felt-piano', label: 'Try Felt Piano on this piano' },
};

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
  const key = getEffectiveKey(tracks);
  const keyHint = key.uncertain ? 'your session' : key.label;
  const stats = tracks.map(computeTrackStats);
  const suggestions: SmartSuggestion[] = [];

  // 1. Empty melodic lanes worth filling. When the session has a
  //    confident key we can offer to drop the tonic on step 0 as a
  //    starting anchor; otherwise the user just gets the lane focus.
  for (const entry of stats) {
    if (!MELODIC_TYPES.has(entry.track.type)) continue;
    if (entry.noteCount > 0) continue;
    const octaveByType: Record<string, number> = { bass: 2, pad: 3, piano: 4, violin: 4, lead: 4, pluck: 4, bell: 5 };
    const octave = octaveByType[entry.track.type] ?? 4;
    const anchorNote = key.uncertain ? `C${octave}` : `${key.rootName}${octave}`;
    suggestions.push({
      id: `empty-${entry.track.id}`,
      title: `${entry.track.name} is empty`,
      detail: `Try a melody in ${keyHint}.`,
      tone: 'tip',
      trackId: entry.track.id,
      action: {
        kind: 'place-steps',
        trackId: entry.track.id,
        steps: [
          { stepIndex: 0, note: anchorNote },
          { stepIndex: 8, note: anchorNote },
        ],
      },
      actionLabel: 'Place tonic anchor',
    });
  }

  // 2. Drum lanes with no downbeat anchor. Each empty drum lane gets
  //    a tap-to-apply pattern that matches its instrument family.
  for (const entry of stats) {
    if (!DRUM_TYPES.has(entry.track.type)) continue;
    if (entry.noteCount === 0) {
      const drumPatterns: Record<string, { detail: string; label: string; steps: number[] }> = {
        kick: {
          detail: 'Try a four-on-the-floor or downbeat anchor.',
          label: 'Add four-on-the-floor',
          steps: [0, 4, 8, 12],
        },
        snare: {
          detail: 'Try backbeats on steps 5 and 13.',
          label: 'Add backbeats',
          steps: [4, 12],
        },
        hihat: {
          detail: 'Try eighth-note hats for steady motion.',
          label: 'Add eighth-note hats',
          steps: [0, 2, 4, 6, 8, 10, 12, 14],
        },
      };
      const recipe = drumPatterns[entry.track.type];
      if (recipe) {
        suggestions.push({
          id: `drums-empty-${entry.track.id}`,
          title: `${entry.track.name} has no hits`,
          detail: recipe.detail,
          tone: 'tip',
          trackId: entry.track.id,
          action: {
            kind: 'place-steps',
            trackId: entry.track.id,
            steps: recipe.steps.map((stepIndex) => ({ stepIndex, note: 'C1' })),
          },
          actionLabel: recipe.label,
        });
      }
    } else if (!entry.hasDownbeat) {
      suggestions.push({
        id: `drums-no-downbeat-${entry.track.id}`,
        title: `${entry.track.name} skips step 1`,
        detail: 'A hit on step 1 anchors the bar.',
        tone: 'attention',
        trackId: entry.track.id,
        action: {
          kind: 'place-steps',
          trackId: entry.track.id,
          steps: [{ stepIndex: 0, note: 'C1' }],
        },
        actionLabel: 'Add step 1 hit',
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
      const anchor = key.uncertain ? 'C2' : `${key.rootName}2`;
      suggestions.push({
        id: `bass-anchor-${bassLane.track.id}`,
        title: 'Bass is silent',
        detail: key.uncertain
          ? 'A root note anchor under each chord pulls the mix together.'
          : `Try ${key.rootName}1 or ${key.rootName}2 to anchor each chord.`,
        tone: 'tip',
        trackId: bassLane.track.id,
        action: {
          kind: 'place-steps',
          trackId: bassLane.track.id,
          steps: [
            { stepIndex: 0, note: anchor },
            { stepIndex: 8, note: anchor },
          ],
        },
        actionLabel: `Anchor on ${anchor}`,
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

  // 6. Sparse melodic lanes that haven't been color-shaped yet: offer
  //    a fitting voice preset. Skip lanes that already have a custom
  //    preset (heuristic: non-default waveform or any sample setup).
  for (const entry of stats) {
    const recommendation = PRESET_RECOMMENDATIONS[entry.track.type];
    if (!recommendation) continue;
    // Only nudge when the lane has a few notes but feels sparse.
    if (entry.noteCount < 1 || entry.noteCount > 8) continue;
    if (entry.track.source.engine === 'sample') continue;
    suggestions.push({
      id: `voice-${entry.track.id}-${recommendation.presetId}`,
      title: `${entry.track.name} could use a voice`,
      detail: `${recommendation.label}.`,
      tone: 'tip',
      trackId: entry.track.id,
      action: {
        kind: 'apply-preset',
        trackId: entry.track.id,
        presetId: recommendation.presetId,
      },
      actionLabel: 'Apply voice',
    });
  }

  // 7. Suggested next chords based on the user's last placed root.
  //    Cap at two so the suggestion list does not get crowded.
  const nextChords = suggestNextChords(tracks, key);
  for (const next of nextChords.slice(0, 2)) {
    suggestions.push({
      id: `next-chord-${next.id}`,
      title: `Try ${next.numeral} (${next.label}) next`,
      detail: 'Common move from your current chord. Saves as a single-chord string queued for the next tap.',
      tone: 'tip',
      action: {
        kind: 'save-and-queue-string',
        name: `${next.label} (next)`,
        tokens: next.tokens,
      },
      actionLabel: 'Save and queue',
    });
  }

  // 8. Patterns that wander out of the session's detected key. When
  //    the drifting pattern is long, offer a trim action that strips
  //    the out-of-key notes in one tap.
  const drift = detectPatternKeyDrift(tracks, key);
  for (const entry of drift) {
    if (!entry.drifts) continue;
    const percentInside = entry.ratio === null ? 0 : Math.round(entry.ratio * 100);
    const isHeavy = entry.outside >= 12;
    const patternLetter = String.fromCharCode(65 + entry.patternIndex);
    suggestions.push({
      id: `pattern-drift-${entry.patternIndex}`,
      title: `Pattern ${patternLetter} wanders out of ${keyHint}`,
      detail: isHeavy
        ? `Only ${percentInside}% of its ${entry.inside + entry.outside} notes fit ${keyHint}. Trim the off-key ones in one tap.`
        : `Only ${percentInside}% of its notes fit ${keyHint}. Intentional? Then ignore.`,
      tone: 'attention',
      ...(isHeavy
        ? {
            action: { kind: 'trim-drift', patternIndex: entry.patternIndex },
            actionLabel: `Trim off-key in ${patternLetter}`,
          }
        : {}),
    });
  }

  return suggestions;
};
