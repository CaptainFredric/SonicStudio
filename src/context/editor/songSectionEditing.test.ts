import { describe, expect, it } from 'vitest';

import { createBlankProject, createEmptyPattern, normalizeProject, type Project } from '../../project/schema';
import {
  clearSongRange,
  deleteSongRange,
  duplicateSongRange,
  insertBlankSongSection,
  insertSavedSongSection,
  removeSavedSongSection,
  renameSavedSongSection,
  resizeSongSectionEnd,
  saveSongRange,
} from './songSectionEditing';
import { songLengthFromProject } from './reducer/reducerUtils';

const buildSectionProject = (): Project => {
  const base = createBlankProject('Section editing');
  const track = base.tracks[0];
  return {
    ...base,
    arrangementLength: 48,
    arrangerClips: [0, 16, 32].map((startBeat, patternIndex) => ({
      beatLength: 16,
      id: `clip_${patternIndex}`,
      patternIndex,
      startBeat,
      trackId: track.id,
    })),
    markers: [
      { beat: 0, id: 'marker_intro', name: 'Intro' },
      { beat: 16, id: 'marker_verse', name: 'Verse' },
      { beat: 32, id: 'marker_hook', name: 'Hook' },
    ],
    transport: { ...base.transport, mode: 'SONG' },
  };
};

describe('song section editing', () => {
  it('inserts a named blank section and shifts later clips and markers', () => {
    const result = insertBlankSongSection(buildSectionProject(), 16, 16, 'Break');

    expect(songLengthFromProject(result)).toBe(64);
    expect(result.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 32, 48]);
    expect(result.markers.map((marker) => [marker.beat, marker.name])).toEqual([
      [0, 'Intro'],
      [16, 'Break'],
      [32, 'Verse'],
      [48, 'Hook'],
    ]);
  });

  it('clears section music without changing its duration or boundaries', () => {
    const result = clearSongRange(buildSectionProject(), 16, 32);

    expect(songLengthFromProject(result)).toBe(48);
    expect(result.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 32]);
    expect(result.markers.map((marker) => marker.beat)).toEqual([0, 16, 32]);
  });

  it('deletes time, closes the gap, and keeps the following section marker', () => {
    const result = deleteSongRange(buildSectionProject(), 16, 32);

    expect(songLengthFromProject(result)).toBe(32);
    expect(result.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 16]);
    expect(result.markers.map((marker) => [marker.beat, marker.name])).toEqual([
      [0, 'Intro'],
      [16, 'Hook'],
    ]);
  });

  it('stretches a section by inserting time and shifting everything after its edge', () => {
    const result = resizeSongSectionEnd(buildSectionProject(), 0, 16, 24);

    expect(songLengthFromProject(result)).toBe(56);
    expect(result.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength])).toEqual([
      [0, 16],
      [24, 16],
      [40, 16],
    ]);
    expect(result.markers.map((marker) => [marker.beat, marker.name])).toEqual([
      [0, 'Intro'],
      [24, 'Verse'],
      [40, 'Hook'],
    ]);
  });

  it('shortens a section by removing time and pulling later music to its edge', () => {
    const result = resizeSongSectionEnd(buildSectionProject(), 0, 16, 12);

    expect(songLengthFromProject(result)).toBe(44);
    expect(result.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength])).toEqual([
      [0, 12],
      [12, 16],
      [28, 16],
    ]);
    expect(result.markers.map((marker) => [marker.beat, marker.name])).toEqual([
      [0, 'Intro'],
      [12, 'Verse'],
      [28, 'Hook'],
    ]);
  });

  it('duplicates by inserting time instead of overlapping later music', () => {
    const result = duplicateSongRange(buildSectionProject(), 0, 16, 'Intro');

    expect(songLengthFromProject(result)).toBe(64);
    expect(result.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 16, 32, 48]);
    expect(result.markers.map((marker) => [marker.beat, marker.name])).toEqual([
      [0, 'Intro'],
      [16, 'Intro Copy'],
      [32, 'Verse'],
      [48, 'Hook'],
    ]);
  });

  it('preserves pattern phase when edits cut through the middle of a clip', () => {
    const base = buildSectionProject();
    const project: Project = {
      ...base,
      arrangementLength: 32,
      arrangerClips: [{
        ...base.arrangerClips[0],
        beatLength: 32,
        patternOffset: 2,
      }],
      markers: [{ beat: 0, id: 'marker_intro', name: 'Intro' }],
    };

    const cleared = clearSongRange(project, 4, 12);
    expect(cleared.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength, clip.patternOffset])).toEqual([
      [0, 4, 2],
      [12, 20, 14],
    ]);

    const deleted = deleteSongRange(project, 4, 12);
    expect(deleted.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength, clip.patternOffset])).toEqual([
      [0, 4, 2],
      [4, 20, 14],
    ]);

    const duplicated = duplicateSongRange(project, 4, 12, 'Middle');
    expect(duplicated.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength, clip.patternOffset])).toEqual([
      [0, 12, 2],
      [12, 8, 6],
      [20, 20, 14],
    ]);

    const saved = saveSongRange(project, 4, 12, 'Middle');
    expect(saved.savedSongSections[0].clips[0].patternOffset).toBe(6);
    const recalled = insertSavedSongSection(saved, saved.savedSongSections[0].id, 32);
    expect(recalled.arrangerClips.find((clip) => clip.startBeat === 32)?.patternOffset).toBe(6);
  });

  it('saves frozen pattern content and restores it into a new pattern slot', () => {
    const project = buildSectionProject();
    const saved = saveSongRange(project, 0, 16, 'Opening');
    const sourceTrackId = project.tracks[0].id;
    const sourceNote = project.tracks[0].patterns[0][0][0]?.note;
    const edited = {
      ...saved,
      tracks: saved.tracks.map((track) => (
        track.id === sourceTrackId
          ? { ...track, patterns: { ...track.patterns, 0: createEmptyPattern(16) } }
          : track
      )),
    };
    const sectionId = saved.savedSongSections[0].id;
    const result = insertSavedSongSection(edited, sectionId, 48);

    expect(saved.savedSongSections).toHaveLength(1);
    expect(result.transport.patternCount).toBe(project.transport.patternCount + 1);
    expect(songLengthFromProject(result)).toBe(64);
    const insertedClip = result.arrangerClips.find((clip) => clip.startBeat === 48);
    expect(insertedClip).toBeDefined();
    expect(result.tracks[0].patterns[insertedClip?.patternIndex ?? -1][0][0]?.note).toBe(sourceNote);
    expect(result.tracks[0].patterns[0][0]).toEqual([]);
  });

  it('renames and removes saved sections without changing the song', () => {
    const project = saveSongRange(buildSectionProject(), 0, 16, 'Opening');
    const sectionId = project.savedSongSections[0].id;
    const renamed = renameSavedSongSection(project, sectionId, 'Cold open');
    const removed = removeSavedSongSection(renamed, sectionId);

    expect(renamed.savedSongSections[0].name).toBe('Cold open');
    expect(removed.savedSongSections).toEqual([]);
    expect(songLengthFromProject(removed)).toBe(48);
  });

  it('preserves saved sections and explicit empty song time through project serialization', () => {
    const saved = saveSongRange(buildSectionProject(), 0, 16, 'Opening');
    const serialized = JSON.parse(JSON.stringify({
      ...saved,
      arrangementLength: 64,
    }));
    const restored = normalizeProject(serialized);

    expect(restored).toBeTruthy();
    expect(restored!.arrangementLength).toBe(64);
    expect(restored!.savedSongSections).toHaveLength(1);
    expect(restored!.savedSongSections[0]).toMatchObject({
      beatLength: 16,
      name: 'Opening',
    });
    expect(restored!.savedSongSections[0].clips[0].pattern[0]).toEqual(
      saved.savedSongSections[0].clips[0].pattern[0],
    );
  });
});
