import type { ArrangementClip, StepValue, Track, TransportMode } from '../project/schema';

// A track only reaches the speakers when it is not muted and not silenced by
// another track's solo. The scheduler uses this to skip synthesizing voices
// that Tone's channel solo would mute anyway, saving real DSP while a solo is
// held, which matters most on weaker devices.
export const isTrackAudible = (
  track: Pick<Track, 'muted' | 'solo'>,
  anySolo: boolean,
): boolean => !track.muted && (!anySolo || track.solo);

/**
 * The highest step index (across every track) that holds a note in the given
 * pattern, or -1 if the pattern is empty. Used to trim the PATTERN-mode audition
 * loop so an over-extended pattern (e.g. stretched to 32 steps but only filled
 * to step 24) repeats right after the last note instead of playing dead air to
 * the end. Internal gaps before that note are preserved; only the trailing empty
 * tail is dropped. The stored pattern length is untouched, so SONG playback and
 * the grid still use the full length.
 */
export const lastActivePatternStep = (
  tracks: Track[],
  patternIndex: number,
  stepsPerPattern: number,
): number => {
  let last = -1;
  for (const track of tracks) {
    const pattern = track.patterns[patternIndex];
    if (!pattern) {
      continue;
    }
    const limit = Math.min(pattern.length, stepsPerPattern);
    for (let step = limit - 1; step > last; step -= 1) {
      if (pattern[step] && pattern[step].length > 0) {
        last = step;
        break;
      }
    }
  }
  return last;
};

export interface ResolvedPatternStep {
  note: StepValue;
  patternIndex: number;
  stepIndex: number;
}

interface PlaybackResolverState {
  arrangerClipsByTrack: Record<string, ArrangementClip[]>;
  currentPattern: number;
  stepsPerPattern: number;
  transportMode: TransportMode;
}

interface ResolvePatternStepOptions extends PlaybackResolverState {
  songStep: number;
  track: Track;
}

interface HasPlayableStepAtOptions extends PlaybackResolverState {
  songStep: number;
  tracks: Track[];
}

interface FindFirstPlayableStepInLoopOptions extends PlaybackResolverState {
  loopBounds: { endBeat: number; startBeat: number };
  tracks: Track[];
}

export const resolvePatternStepForPlayback = ({
  arrangerClipsByTrack,
  currentPattern,
  songStep,
  stepsPerPattern,
  track,
  transportMode,
}: ResolvePatternStepOptions): ResolvedPatternStep | null => {
  if (transportMode === 'PATTERN') {
    const stepIndex = songStep % stepsPerPattern;
    const patternSteps = track.patterns[currentPattern];
    return {
      note: patternSteps?.[stepIndex] ?? [],
      patternIndex: currentPattern,
      stepIndex,
    };
  }

  const trackClips = arrangerClipsByTrack[track.id] ?? [];
  const activeClip = trackClips.find((clip) => (
    clip.trackId === track.id
    && songStep >= clip.startBeat
    && songStep < clip.startBeat + clip.beatLength
  ));

  if (!activeClip) {
    // Song mode can be active before clips are arranged. In that case, fall
    // back to the current pattern so Play always produces audible feedback.
    if (trackClips.length === 0) {
      const stepIndex = songStep % stepsPerPattern;
      const patternSteps = track.patterns[currentPattern];
      return {
        note: patternSteps?.[stepIndex] ?? [],
        patternIndex: currentPattern,
        stepIndex,
      };
    }

    return null;
  }

  const localStep = (songStep - activeClip.startBeat) % stepsPerPattern;
  const patternSteps = track.patterns[activeClip.patternIndex];

  return {
    note: patternSteps?.[localStep] ?? [],
    patternIndex: activeClip.patternIndex,
    stepIndex: localStep,
  };
};

export const hasPlayableStepAt = ({
  arrangerClipsByTrack,
  currentPattern,
  songStep,
  stepsPerPattern,
  tracks,
  transportMode,
}: HasPlayableStepAtOptions): boolean => {
  return tracks.some((track) => {
    if (track.muted) {
      return false;
    }

    const resolved = resolvePatternStepForPlayback({
      arrangerClipsByTrack,
      currentPattern,
      songStep,
      stepsPerPattern,
      track,
      transportMode,
    });
    return Boolean(resolved && resolved.note.length > 0);
  });
};

export const findFirstPlayableStepInLoop = ({
  arrangerClipsByTrack,
  currentPattern,
  loopBounds,
  stepsPerPattern,
  tracks,
  transportMode,
}: FindFirstPlayableStepInLoopOptions): number | null => {
  for (let step = loopBounds.startBeat; step < loopBounds.endBeat; step += 1) {
    if (hasPlayableStepAt({
      arrangerClipsByTrack,
      currentPattern,
      songStep: step,
      stepsPerPattern,
      tracks,
      transportMode,
    })) {
      return step;
    }
  }

  return null;
};