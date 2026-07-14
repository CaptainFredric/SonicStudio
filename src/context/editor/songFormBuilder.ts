import {
  type ArrangementClip,
  type InstrumentType,
  type Project,
  type SongMarker,
  type Track,
} from '../../project/schema';
import { syncArrangerClips } from './projectMutations';
import { syncSongMarkers } from './reducer/reducerUtils';
import {
  SONG_FORM_DEFINITIONS,
  type SongFormId,
  type SongFormRole,
  type SongFormSection,
} from './songFormDefinitions';

const ROLE_TRACKS: Record<SongFormRole, InstrumentType[]> = {
  intro: ['hihat', 'pad', 'pluck', 'fx'],
  groove: ['kick', 'snare', 'hihat', 'bass', 'pad', 'pluck'],
  lift: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  break: ['hihat', 'lead', 'pad', 'pluck', 'fx'],
  return: ['kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx'],
  outro: ['hihat', 'bass', 'pad', 'pluck', 'fx'],
};

const getDefinition = (formId: SongFormId) => (
  SONG_FORM_DEFINITIONS.find((definition) => definition.id === formId)
);

const preferredPatternForTrack = (project: Project, track: Track) => (
  project.arrangerClips.find((clip) => clip.trackId === track.id)?.patternIndex
  ?? project.transport.currentPattern
  ?? 0
);

const tracksForRole = (tracks: Track[], role: SongFormRole) => {
  const acceptedTypes = ROLE_TRACKS[role];
  const selectedTracks = tracks.filter((track) => acceptedTypes.includes(track.type));

  return selectedTracks.length > 0 ? selectedTracks : tracks;
};

const createClip = (
  project: Project,
  track: Track,
  section: SongFormSection,
  sectionIndex: number,
  startBeat: number,
  runId: string,
): ArrangementClip => {
  const patternCount = Math.max(1, project.transport.patternCount);
  const basePattern = preferredPatternForTrack(project, track);

  return {
    beatLength: section.length,
    id: `clip_form_${runId}_${sectionIndex}_${track.id}`,
    patternIndex: (basePattern + section.patternOffset) % patternCount,
    startBeat,
    trackId: track.id,
  };
};

export const buildSongFormProject = (
  project: Project,
  formId: SongFormId,
): { project: Project; selectedArrangerClipId: string | null; selectedTrackId: string | null } | null => {
  const definition = getDefinition(formId);
  if (!definition || project.tracks.length === 0) {
    return null;
  }

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let cursor = 0;
  const nextMarkers: SongMarker[] = [];
  const nextClips: ArrangementClip[] = [];

  definition.sections.forEach((section, sectionIndex) => {
    nextMarkers.push({
      beat: cursor,
      id: `marker_form_${runId}_${sectionIndex}`,
      name: section.label,
    });

    tracksForRole(project.tracks, section.role).forEach((track) => {
      nextClips.push(createClip(project, track, section, sectionIndex, cursor, runId));
    });

    cursor += section.length;
  });

  const syncedClips = syncArrangerClips(nextClips, project.tracks, project.transport.patternCount);

  return {
    project: {
      ...project,
      arrangementLength: cursor,
      arrangerClips: syncedClips,
      markers: syncSongMarkers(nextMarkers, cursor),
      transport: {
        ...project.transport,
        mode: 'SONG',
      },
    },
    selectedArrangerClipId: syncedClips[0]?.id ?? null,
    selectedTrackId: syncedClips[0]?.trackId ?? project.tracks[0]?.id ?? null,
  };
};
