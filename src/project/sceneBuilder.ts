// Reusable scene-authoring helpers.
//
// Hand-built templates used to repeat the same bookkeeping: track a running
// start beat across sections, create one arranger clip per active lane, and
// keep a separate marker list whose beats had to match the sections by hand.
// That duplication was easy to get subtly wrong. These helpers let a new scene
// declare its sections once, in order, and derive the clips and markers from
// that single source of truth, so building more faithful tracks is faster.

import {
  createArrangerClip,
  createId,
  type ArrangementClip,
  type SongMarker,
  type Track,
  type TransportSettings,
} from './schema';

export interface SceneSection {
  /** Marker label shown on the timeline (also names the section). */
  name: string;
  /** Length in bars. */
  bars: number;
  /** Pattern index this section plays. */
  pattern: number;
  /** Tracks (lanes) that sound during this section. */
  lanes: Track[];
}

/** Total length of a section list in bars. */
export const arrangementBars = (sections: SceneSection[]): number =>
  sections.reduce((total, section) => total + section.bars, 0);

/**
 * Lay a list of sections end to end into arranger clips plus one marker per
 * section. Each clip loops its 16-step pattern across the section length, so a
 * section is one clip per active lane. Returns both the clips and the derived
 * markers, so callers cannot drift the two out of sync.
 */
export const arrangeSections = (
  transport: TransportSettings,
  sections: SceneSection[],
  stepsPerBar = 16,
): { clips: ArrangementClip[]; markers: SongMarker[] } => {
  const clips: ArrangementClip[] = [];
  const markers: SongMarker[] = [];
  let startBeat = 0;

  for (const section of sections) {
    const beatLength = section.bars * stepsPerBar;
    for (const track of section.lanes) {
      clips.push(createArrangerClip(track.id, transport, {
        beatLength,
        patternIndex: section.pattern,
        startBeat,
      }));
    }
    markers.push({ beat: startBeat, id: createId('marker'), name: section.name });
    startBeat += beatLength;
  }

  return { clips, markers };
};
