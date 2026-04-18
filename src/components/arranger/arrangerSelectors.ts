import type { ArrangementClip, SongMarker, Track } from '../../project/schema';
import type { LaneData, LaneGroupKey, LaneScope, LaneSection, LaneSectionKey, SectionRange } from './types';

export const DRUM_ROW_LABELS: Record<Track['type'], string> = {
  bass: 'Bass',
  fx: 'FX',
  hihat: 'Hat',
  kick: 'Kick',
  lead: 'Lead',
  pad: 'Pad',
  pluck: 'Pluck',
  snare: 'Snare',
};

export const LANE_GROUP_LABELS: Record<LaneGroupKey, string> = {
  RHYTHM: 'Rhythm',
  MUSICAL: 'Musical',
  TEXTURE: 'Texture',
};

export const isDrumTrack = (track: Track) => (
  track.type === 'kick' || track.type === 'snare' || track.type === 'hihat'
);

export const getLaneGroup = (track: Track): LaneGroupKey => {
  if (isDrumTrack(track)) {
    return 'RHYTHM';
  }

  if (track.type === 'fx') {
    return 'TEXTURE';
  }

  return 'MUSICAL';
};

export const buildSectionRanges = (
  arrangerClips: ArrangementClip[],
  songMarkers: SongMarker[],
  timelineSteps: number,
): SectionRange[] => {
  const sortedMarkers = [...songMarkers].sort((left, right) => left.beat - right.beat);
  const boundaries = sortedMarkers.length > 0
    ? sortedMarkers
    : [{ beat: 0, id: 'marker_fallback', name: 'Song' }];

  return boundaries.map((marker, index) => {
    const nextMarker = boundaries[index + 1];
    const startBeat = marker.beat;
    const endBeat = nextMarker?.beat ?? timelineSteps;
    const clipsInRange = arrangerClips.filter((clip) => (
      clip.startBeat < endBeat && clip.startBeat + clip.beatLength > startBeat
    ));

    return {
      clipCount: clipsInRange.length,
      endBeat,
      id: marker.id,
      label: marker.name,
      startBeat,
    };
  });
};

export interface BuildLaneDataOptions {
  arrangerClips: ArrangementClip[];
  laneScope: LaneScope;
  pinnedTrackIds: string[];
  selectedTrackId: string | null;
  tracks: Track[];
}

export const buildLaneData = ({
  arrangerClips,
  laneScope,
  pinnedTrackIds,
  selectedTrackId,
  tracks,
}: BuildLaneDataOptions): LaneData[] => (
  tracks.map((track) => ({
    clips: arrangerClips.filter((clip) => clip.trackId === track.id),
    track,
  })).filter(({ clips, track }) => {
    switch (laneScope) {
      case 'ACTIVE':
        return clips.length > 0;
      case 'FOCUSED':
        return track.id === selectedTrackId;
      case 'PINNED':
        return pinnedTrackIds.includes(track.id);
      case 'DRUMS':
        return isDrumTrack(track);
      case 'MUSICAL':
        return !isDrumTrack(track);
      default:
        return true;
    }
  })
);

export interface BuildLaneSectionsOptions {
  laneData: LaneData[];
  laneScope: LaneScope;
  pinnedTrackIds: string[];
}

export const buildLaneSections = ({
  laneData,
  laneScope,
  pinnedTrackIds,
}: BuildLaneSectionsOptions): LaneSection[] => {
  const sections: LaneSection[] = [];
  const pinnedLaneData = laneScope === 'PINNED'
    ? []
    : laneData.filter(({ track }) => pinnedTrackIds.includes(track.id));

  if (pinnedLaneData.length > 0) {
    sections.push({ key: 'PINNED', label: 'Pinned', lanes: pinnedLaneData });
  }

  const remainingLaneData = laneScope === 'PINNED'
    ? laneData
    : laneData.filter(({ track }) => !pinnedTrackIds.includes(track.id));

  (['RHYTHM', 'MUSICAL', 'TEXTURE'] as LaneGroupKey[]).forEach((groupKey) => {
    const lanes = remainingLaneData.filter(({ track }) => getLaneGroup(track) === groupKey);
    if (lanes.length === 0) {
      return;
    }

    sections.push({
      key: groupKey as LaneSectionKey,
      label: LANE_GROUP_LABELS[groupKey],
      lanes,
    });
  });

  return sections;
};
