import React, {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { engine } from '../audio/ToneEngine';
import {
  cloneProject,
  createArrangerClip as buildArrangerClip,
  createEmptyPattern,
  createStepEvent,
  createTrack as buildTrack,
  defaultNoteForTrack,
  duplicateTrack as buildDuplicateTrack,
  MAX_PATTERN_COUNT,
  MAX_STEPS_PER_PATTERN,
  MIN_PATTERN_COUNT,
  MIN_STEPS_PER_PATTERN,
  resizeTrackPatterns,
  type ArrangementClip,
  type AppView,
  type InstrumentType,
  type NoteEvent,
  type Project,
  type StudioSession,
  type StudioUIState,
  type SynthParams,
  type Track,
  type TrackSource,
  type TransportMode,
} from '../project/schema';
import {
  createDefaultSession,
  hydrateSessionPayload,
  loadPersistedSession,
  persistSession,
} from '../project/storage';
import {
  convertRecordingBlobToWav,
  downloadBlob,
  sanitizeExportFileName,
} from '../utils/export';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AudioContextType {
  activeView: AppView;
  addArrangerClip: (trackId?: string) => void;
  arrangerClips: ArrangementClip[];
  bpm: number;
  canRedo: boolean;
  canUndo: boolean;
  clearPatternAt: (trackId: string, patternIndex: number) => void;
  clearTrack: (trackId: string) => void;
  createTrack: (trackType: InstrumentType) => void;
  currentPattern: number;
  currentStep: number;
  duplicateArrangerClip: (clipId: string) => void;
  exportAudioMix: () => Promise<void>;
  exportTrackStems: () => Promise<void>;
  loopArrangerClip: (clipId: string, copies: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  duplicateTrack: (trackId: string) => void;
  exportSession: () => void;
  importSession: (file: File) => Promise<boolean>;
  initAudio: () => Promise<void>;
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  isSettingsOpen: boolean;
  lastSavedAt: string | null;
  newSession: () => void;
  patternCount: number;
  previewTrack: (trackId: string, note?: string) => Promise<void>;
  projectName: string;
  redo: () => void;
  removeArrangerClip: (clipId: string) => void;
  removeTrack: (trackId: string) => void;
  renameProject: (name: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  saveProject: () => void;
  saveStatus: SaveStatus;
  selectedTrackId: string | null;
  shiftPattern: (trackId: string, direction: 'left' | 'right') => void;
  setActiveView: (view: AppView) => void;
  setBpm: (bpm: number) => void;
  setCurrentPattern: (pattern: number) => void;
  setPatternCount: (patternCount: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setStepsPerPattern: (stepsPerPattern: number) => void;
  setTrackParams: (id: string, params: Partial<SynthParams>) => void;
  setTrackSource: (id: string, source: Partial<TrackSource>) => void;
  setTransportMode: (mode: TransportMode) => void;
  shiftPatternAt: (trackId: string, patternIndex: number, direction: 'left' | 'right') => void;
  songLengthInBeats: number;
  splitArrangerClip: (clipId: string) => void;
  stepsPerPattern: number;
  stop: () => void;
  toggleMute: (trackId: string) => void;
  togglePlay: () => void;
  togglePatternStep: (trackId: string, patternIndex: number, stepIndex: number, note?: string) => void;
  toggleRecording: () => Promise<void>;
  toggleSettings: () => void;
  toggleSolo: (trackId: string) => void;
  toggleStep: (trackId: string, stepIndex: number, note?: string) => void;
  tracks: Track[];
  transposePatternAt: (trackId: string, patternIndex: number, semitones: number) => void;
  transposePattern: (trackId: string, semitones: number) => void;
  transportMode: TransportMode;
  undo: () => void;
  updateArrangerClip: (clipId: string, updates: Partial<ArrangementClip>) => void;
  updatePatternAutomationStep: (trackId: string, patternIndex: number, stepIndex: number, lane: 'level' | 'tone', value: number) => void;
  updatePatternStepEvent: (trackId: string, patternIndex: number, stepIndex: number, noteIndex: number, updates: Partial<NoteEvent>) => void;
  updateStepEvent: (trackId: string, stepIndex: number, noteIndex: number, updates: Partial<NoteEvent>) => void;
  updateTrackPan: (trackId: string, pan: number) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
}

interface HistoryState {
  future: Project[];
  past: Project[];
  present: Project;
}

interface EditorState {
  history: HistoryState;
  ui: StudioUIState;
}

type EditorAction =
  | { type: 'ADD_ARRANGER_CLIP'; trackId?: string }
  | { type: 'CLEAR_TRACK'; trackId: string }
  | { type: 'CLEAR_PATTERN_AT'; trackId: string; patternIndex: number }
  | { type: 'CREATE_TRACK'; trackType: InstrumentType }
  | { type: 'DUPLICATE_ARRANGER_CLIP'; clipId: string }
  | { type: 'LOOP_ARRANGER_CLIP'; clipId: string; copies: number }
  | { type: 'MAKE_CLIP_PATTERN_UNIQUE'; clipId: string }
  | { type: 'SPLIT_ARRANGER_CLIP'; clipId: string }
  | { type: 'DUPLICATE_TRACK'; trackId: string }
  | { type: 'HYDRATE_SESSION'; session: StudioSession }
  | { type: 'REDO' }
  | { type: 'REMOVE_ARRANGER_CLIP'; clipId: string }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'SHIFT_PATTERN'; direction: 'left' | 'right'; trackId: string }
  | { type: 'SHIFT_PATTERN_AT'; direction: 'left' | 'right'; trackId: string; patternIndex: number }
  | { type: 'SET_ACTIVE_VIEW'; view: AppView }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_CURRENT_PATTERN'; pattern: number }
  | { type: 'SET_PATTERN_COUNT'; patternCount: number }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_SELECTED_TRACK_ID'; trackId: string | null }
  | { type: 'SET_STEPS_PER_PATTERN'; stepsPerPattern: number }
  | { type: 'SET_TRACK_NAME'; name: string; trackId: string }
  | { type: 'SET_TRACK_PARAMS'; params: Partial<SynthParams>; trackId: string }
  | { type: 'SET_TRACK_SOURCE'; source: Partial<TrackSource>; trackId: string }
  | { type: 'SET_TRANSPORT_MODE'; mode: TransportMode }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'TOGGLE_PAN'; pan: number; trackId: string }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_SOLO'; trackId: string }
  | { type: 'TOGGLE_STEP'; note?: string; stepIndex: number; trackId: string }
  | { type: 'TOGGLE_PATTERN_STEP'; note?: string; stepIndex: number; trackId: string; patternIndex: number }
  | { type: 'TOGGLE_VOLUME'; trackId: string; volume: number }
  | { type: 'TRANSPOSE_PATTERN'; semitones: number; trackId: string }
  | { type: 'TRANSPOSE_PATTERN_AT'; semitones: number; trackId: string; patternIndex: number }
  | { type: 'UNDO' }
  | { type: 'UPDATE_ARRANGER_CLIP'; clipId: string; updates: Partial<ArrangementClip> }
  | { type: 'UPDATE_PATTERN_AUTOMATION_STEP'; trackId: string; patternIndex: number; stepIndex: number; lane: 'level' | 'tone'; value: number }
  | { type: 'UPDATE_PATTERN_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; patternIndex: number; updates: Partial<NoteEvent> }
  | { type: 'UPDATE_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; updates: Partial<NoteEvent> };

const AudioContext = createContext<AudioContextType | null>(null);
const HISTORY_LIMIT = 100;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));
const compareNotesDescending = (left: string, right: string) => (
  (noteToMidi(right) ?? 0) - (noteToMidi(left) ?? 0)
);

const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

const midiToNote = (midi: number): string => {
  const clampedMidi = clamp(Math.round(midi), 24, 96);
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

const transposeNote = (note: string, semitones: number): string => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

const syncArrangerClips = (
  arrangerClips: ArrangementClip[],
  tracks: Track[],
  patternCount: number,
): ArrangementClip[] => {
  if (arrangerClips.length === 0 || tracks.length === 0) {
    return [];
  }

  const trackOrder = new Map(tracks.map((track, index) => [track.id, index]));

  return arrangerClips
    .filter((clip) => trackOrder.has(clip.trackId))
    .map((clip) => ({
      ...clip,
      beatLength: clamp(Math.round(clip.beatLength || 16), 4, 128),
      patternIndex: clamp(Math.round(clip.patternIndex || 0), 0, Math.max(patternCount - 1, 0)),
      startBeat: clamp(Math.round(clip.startBeat || 0), 0, 4096),
    }))
    .sort((left, right) => {
      const leftTrackIndex = trackOrder.get(left.trackId) ?? 0;
      const rightTrackIndex = trackOrder.get(right.trackId) ?? 0;

      if (leftTrackIndex !== rightTrackIndex) {
        return leftTrackIndex - rightTrackIndex;
      }

      return left.startBeat - right.startBeat;
    });
};

const createInitialEditorState = (): EditorState => {
  const session = loadPersistedSession() ?? createDefaultSession();

  return {
    history: {
      future: [],
      past: [],
      present: session.project,
    },
    ui: session.ui,
  };
};

const ensureSelectedTrackId = (project: Project, selectedTrackId: string | null) => {
  if (selectedTrackId && project.tracks.some((track) => track.id === selectedTrackId)) {
    return selectedTrackId;
  }

  return project.tracks[0]?.id ?? null;
};

const stampProjectUpdate = (project: Project): Project => ({
  ...project,
  metadata: {
    ...project.metadata,
    updatedAt: new Date().toISOString(),
  },
});

const commitProject = (
  state: EditorState,
  nextProject: Project,
  selectedTrackId: string | null = state.ui.selectedTrackId,
): EditorState => {
  if (nextProject === state.history.present) {
    return state;
  }

  const nextPast = [...state.history.past, cloneProject(state.history.present)].slice(-HISTORY_LIMIT);

  return {
    history: {
      future: [],
      past: nextPast,
      present: stampProjectUpdate(nextProject),
    },
    ui: {
      ...state.ui,
      selectedTrackId: ensureSelectedTrackId(nextProject, selectedTrackId),
    },
  };
};

const updateTrack = (
  project: Project,
  trackId: string,
  updater: (track: Track) => Track,
): Project => {
  let didChange = false;
  const tracks = project.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }

    const nextTrack = updater(track);
    if (nextTrack !== track) {
      didChange = true;
    }

    return nextTrack;
  });

  return didChange ? { ...project, tracks } : project;
};

const resizeProjectTransport = (
  project: Project,
  patternCount: number,
  stepsPerPattern: number,
): Project => {
  const nextPatternCount = clamp(patternCount, MIN_PATTERN_COUNT, MAX_PATTERN_COUNT);
  const nextStepsPerPattern = clamp(stepsPerPattern, MIN_STEPS_PER_PATTERN, MAX_STEPS_PER_PATTERN);

  if (
    nextPatternCount === project.transport.patternCount
    && nextStepsPerPattern === project.transport.stepsPerPattern
  ) {
    return project;
  }

  const tracks = project.tracks.map((track) => (
    resizeTrackPatterns(track, nextPatternCount, nextStepsPerPattern)
  ));

  return {
    ...project,
    arrangerClips: syncArrangerClips(project.arrangerClips, tracks, nextPatternCount),
    tracks,
    transport: {
      ...project.transport,
      currentPattern: clamp(project.transport.currentPattern, 0, nextPatternCount - 1),
      patternCount: nextPatternCount,
      stepsPerPattern: nextStepsPerPattern,
    },
  };
};

const updatePatternSteps = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: NoteEvent[][]) => NoteEvent[][],
): Track => {
  const currentPattern = track.patterns[patternIndex] ?? createEmptyPattern(stepsPerPattern);
  const nextPattern = updater(currentPattern.map(cloneStepEvents));

  return {
    ...track,
    patterns: {
      ...track.patterns,
      [patternIndex]: nextPattern,
    },
  };
};

const updateTrackAutomationPattern = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: { level: number[]; tone: number[] }) => { level: number[]; tone: number[] },
): Track => {
  const currentPattern = track.automation?.[patternIndex] ?? {
    level: Array.from({ length: stepsPerPattern }, () => 0.5),
    tone: Array.from({ length: stepsPerPattern }, () => 0.5),
  };
  const nextPattern = updater({
    level: [...currentPattern.level],
    tone: [...currentPattern.tone],
  });

  return {
    ...track,
    automation: {
      ...track.automation,
      [patternIndex]: nextPattern,
    },
  };
};

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  const { present } = state.history;

  switch (action.type) {
    case 'HYDRATE_SESSION':
      return {
        history: {
          future: [],
          past: [],
          present: action.session.project,
        },
        ui: {
          ...action.session.ui,
          selectedTrackId: ensureSelectedTrackId(action.session.project, action.session.ui.selectedTrackId),
        },
      };

    case 'SET_ACTIVE_VIEW':
      return state.ui.activeView === action.view
        ? state
        : { ...state, ui: { ...state.ui, activeView: action.view } };

    case 'TOGGLE_SETTINGS':
      return { ...state, ui: { ...state.ui, isSettingsOpen: !state.ui.isSettingsOpen } };

    case 'SET_SELECTED_TRACK_ID': {
      const nextSelectedTrackId = ensureSelectedTrackId(present, action.trackId);
      return nextSelectedTrackId === state.ui.selectedTrackId
        ? state
        : { ...state, ui: { ...state.ui, selectedTrackId: nextSelectedTrackId } };
    }

    case 'SET_PROJECT_NAME': {
      const nextName = action.name.trim();
      if (!nextName || nextName === present.metadata.name) {
        return state;
      }

      return commitProject(state, {
        ...present,
        metadata: {
          ...present.metadata,
          name: nextName,
        },
      });
    }

    case 'SET_TRANSPORT_MODE': {
      if (present.transport.mode === action.mode) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          mode: action.mode,
        },
      });
    }

    case 'SET_CURRENT_PATTERN': {
      const nextPattern = clamp(action.pattern, 0, present.transport.patternCount - 1);
      if (nextPattern === present.transport.currentPattern) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          currentPattern: nextPattern,
        },
      });
    }

    case 'SET_BPM': {
      const nextBpm = clamp(action.bpm, 40, 240);
      if (nextBpm === present.transport.bpm) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          bpm: nextBpm,
        },
      });
    }

    case 'SET_PATTERN_COUNT':
      return commitProject(state, resizeProjectTransport(present, action.patternCount, present.transport.stepsPerPattern));

    case 'SET_STEPS_PER_PATTERN':
      return commitProject(state, resizeProjectTransport(present, present.transport.patternCount, action.stepsPerPattern));

    case 'SET_TRACK_NAME': {
      const nextName = action.name.trim();
      if (!nextName) {
        return state;
      }

      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        nextName === track.name ? track : { ...track, name: nextName }
      )));
    }

    case 'SET_TRACK_PARAMS':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        params: {
          ...track.params,
          ...action.params,
        },
      })));

    case 'SET_TRACK_SOURCE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        source: {
          ...track.source,
          ...action.source,
        },
      })));

    case 'TOGGLE_STEP': {
      const nextProject = updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(defaultNoteForTrack(track))];
            return nextSteps;
          }

          const existingNoteIndex = existingStep.findIndex((step) => step.note === action.note);

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(action.note, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));

          return nextSteps;
        });
      });

      return commitProject(state, nextProject);
    }

    case 'TOGGLE_PATTERN_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(defaultNoteForTrack(track))];
            return nextSteps;
          }

          const existingNoteIndex = existingStep.findIndex((step) => step.note === action.note);

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(action.note, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));

          return nextSteps;
        })
      )));

    case 'SHIFT_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        });
      }));

    case 'SHIFT_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'TRANSPOSE_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'TRANSPOSE_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'TOGGLE_VOLUME':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextVolume = clamp(action.volume, -60, 6);
        return nextVolume === track.volume ? track : { ...track, volume: nextVolume };
      }));

    case 'TOGGLE_PAN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextPan = clamp(action.pan, -1, 1);
        return nextPan === track.pan ? track : { ...track, pan: nextPan };
      }));

    case 'TOGGLE_MUTE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        muted: !track.muted,
      })));

    case 'TOGGLE_SOLO':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        solo: !track.solo,
      })));

    case 'CLEAR_TRACK':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ));
      }));

    case 'CLEAR_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    case 'UPDATE_STEP_EVENT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
          },
        };
      }));

    case 'UPDATE_PATTERN_STEP_EVENT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const currentPattern = track.patterns[action.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [action.patternIndex]: nextSteps,
          },
        };
      }));

    case 'UPDATE_PATTERN_AUTOMATION_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateTrackAutomationPattern(
          track,
          action.patternIndex,
          present.transport.stepsPerPattern,
          (patternAutomation) => ({
            ...patternAutomation,
            [action.lane]: patternAutomation[action.lane].map((entry, entryIndex) => (
              entryIndex === action.stepIndex
                ? clamp(action.value, 0, 1)
                : entry
            )),
          }),
        )
      )));

    case 'CREATE_TRACK': {
      const nextTrack = buildTrack(action.trackType, {
        patternCount: present.transport.patternCount,
        stepsPerPattern: present.transport.stepsPerPattern,
      });

      return commitProject(state, {
        ...present,
        arrangerClips: present.transport.mode === 'SONG'
          ? syncArrangerClips(
              [
                ...present.arrangerClips,
                buildArrangerClip(nextTrack.id, present.transport, {
                  beatLength: present.transport.stepsPerPattern,
                  patternIndex: present.transport.currentPattern,
                  startBeat: 0,
                }),
              ],
              [...present.tracks, nextTrack],
              present.transport.patternCount,
            )
          : present.arrangerClips,
        tracks: [...present.tracks, nextTrack],
      }, nextTrack.id);
    }

    case 'DUPLICATE_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips,
            buildArrangerClip(sourceClip.trackId, present.transport, {
              beatLength: sourceClip.beatLength,
              patternIndex: sourceClip.patternIndex,
              startBeat: sourceClip.startBeat + sourceClip.beatLength,
            }),
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId);
    }

    case 'LOOP_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const copies = Math.max(1, Math.min(8, Math.round(action.copies)));
      const loopedClips = Array.from({ length: copies }, (_, index) => (
        buildArrangerClip(sourceClip.trackId, present.transport, {
          beatLength: sourceClip.beatLength,
          patternIndex: sourceClip.patternIndex,
          startBeat: sourceClip.startBeat + sourceClip.beatLength * (index + 1),
        })
      ));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [...present.arrangerClips, ...loopedClips],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId);
    }

    case 'MAKE_CLIP_PATTERN_UNIQUE': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const sourceTrack = present.tracks.find((track) => track.id === sourceClip.trackId);
      if (!sourceTrack) {
        return state;
      }

      const occupiedPatternIndices = new Set(
        present.arrangerClips
          .filter((clip) => clip.trackId === sourceTrack.id && clip.id !== sourceClip.id)
          .map((clip) => clip.patternIndex),
      );
      const nextPatternIndex = Array.from(
        { length: present.transport.patternCount },
        (_, patternIndex) => patternIndex,
      ).find((patternIndex) => !occupiedPatternIndices.has(patternIndex) && patternIndex !== sourceClip.patternIndex);

      if (nextPatternIndex === undefined) {
        return state;
      }

      const nextProject = updateTrack(present, sourceTrack.id, (track) => {
        const sourcePattern = track.patterns[sourceClip.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [nextPatternIndex]: sourcePattern.map(cloneStepEvents),
          },
        };
      });

      return commitProject(state, {
        ...nextProject,
        arrangerClips: syncArrangerClips(
          nextProject.arrangerClips.map((clip) => (
            clip.id === sourceClip.id ? { ...clip, patternIndex: nextPatternIndex } : clip
          )),
          nextProject.tracks,
          nextProject.transport.patternCount,
        ),
      }, sourceTrack.id);
    }

    case 'SPLIT_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip || sourceClip.beatLength < 8) {
        return state;
      }

      const halfLength = Math.floor(sourceClip.beatLength / 8) * 4;
      const firstLength = clamp(halfLength, 4, sourceClip.beatLength - 4);
      const secondLength = sourceClip.beatLength - firstLength;

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips.map((clip) => (
              clip.id === sourceClip.id
                ? { ...clip, beatLength: firstLength }
                : clip
            )),
            buildArrangerClip(sourceClip.trackId, present.transport, {
              beatLength: secondLength,
              patternIndex: sourceClip.patternIndex,
              startBeat: sourceClip.startBeat + firstLength,
            }),
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId);
    }

    case 'DUPLICATE_TRACK': {
      const sourceTrack = present.tracks.find((track) => track.id === action.trackId);
      if (!sourceTrack) {
        return state;
      }

      const duplicatedTrack = buildDuplicateTrack(sourceTrack, present.transport);
      const duplicatedClips = present.arrangerClips
        .filter((clip) => clip.trackId === sourceTrack.id)
        .map((clip) => ({
          ...clip,
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          trackId: duplicatedTrack.id,
        }));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [...present.arrangerClips, ...duplicatedClips],
          [...present.tracks, duplicatedTrack],
          present.transport.patternCount,
        ),
        tracks: [...present.tracks, duplicatedTrack],
      }, duplicatedTrack.id);
    }

    case 'REMOVE_TRACK': {
      if (!present.tracks.some((track) => track.id === action.trackId)) {
        return state;
      }

      const nextTracks = present.tracks.filter((track) => track.id !== action.trackId);
      const nextSelectedTrackId = state.ui.selectedTrackId === action.trackId
        ? nextTracks[0]?.id ?? null
        : state.ui.selectedTrackId;

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.filter((clip) => clip.trackId !== action.trackId),
          nextTracks,
          present.transport.patternCount,
        ),
        tracks: nextTracks,
      }, nextSelectedTrackId);
    }

    case 'ADD_ARRANGER_CLIP': {
      const targetTrackId = action.trackId
        ?? state.ui.selectedTrackId
        ?? present.tracks[0]?.id;

      if (!targetTrackId) {
        return state;
      }

      const laneTail = present.arrangerClips
        .filter((clip) => clip.trackId === targetTrackId)
        .reduce((maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength), 0);

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips,
            buildArrangerClip(targetTrackId, present.transport, {
              beatLength: present.transport.stepsPerPattern,
              patternIndex: present.transport.currentPattern,
              startBeat: laneTail,
            }),
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, targetTrackId);
    }

    case 'REMOVE_ARRANGER_CLIP':
      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.filter((clip) => clip.id !== action.clipId),
          present.tracks,
          present.transport.patternCount,
        ),
      });

    case 'UPDATE_ARRANGER_CLIP':
      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.map((clip) => (
            clip.id === action.clipId ? { ...clip, ...action.updates } : clip
          )),
          present.tracks,
          present.transport.patternCount,
        ),
      });

    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state;
      }

      const previous = cloneProject(state.history.past[state.history.past.length - 1]);
      return {
        history: {
          future: [cloneProject(state.history.present), ...state.history.future].slice(0, HISTORY_LIMIT),
          past: state.history.past.slice(0, -1),
          present: previous,
        },
        ui: {
          ...state.ui,
          selectedTrackId: ensureSelectedTrackId(previous, state.ui.selectedTrackId),
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) {
        return state;
      }

      const [nextProject, ...remainingFuture] = state.history.future;
      const restoredProject = cloneProject(nextProject);

      return {
        history: {
          future: remainingFuture,
          past: [...state.history.past, cloneProject(state.history.present)].slice(-HISTORY_LIMIT),
          present: restoredProject,
        },
        ui: {
          ...state.ui,
          selectedTrackId: ensureSelectedTrackId(restoredProject, state.ui.selectedTrackId),
        },
      };
    }

    default:
      return state;
  }
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }

  return context;
};

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const [editorState, dispatch] = useReducer(editorReducer, undefined, createInitialEditorState);
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const project = editorState.history.present;
  const { activeView, selectedTrackId } = editorState.ui;
  const arrangerClips = project.arrangerClips ?? [];
  const songLengthInBeats = arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  );

  useEffect(() => {
    engine.syncProject(project);
  }, [project]);

  useEffect(() => {
    const unsubscribe = engine.onStep((step) => {
      setCurrentStep(step);
    });

    return unsubscribe;
  }, []);

  const persistCurrentSession = useEffectEvent(() => {
    const envelope = persistSession({
      project: editorState.history.present,
      ui: editorState.ui,
    });

    if (envelope) {
      setLastSavedAt(envelope.savedAt);
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('error');
  });

  useEffect(() => {
    setSaveStatus('saving');
    const timeoutId = window.setTimeout(() => {
      persistCurrentSession();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorState.history.present, editorState.ui]);

  const initAudio = async () => {
    await engine.init();
    engine.syncProject(project);
    setIsInitialized(true);
  };

  const togglePlay = () => {
    setIsPlaying(engine.togglePlayback());
  };

  const stop = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const toggleRecording = async () => {
    if (!isInitialized) {
      await initAudio();
    }

    if (isRecording) {
      await engine.stopRecording();
      setIsRecording(false);
      return;
    }

    await engine.startRecording();
    setIsRecording(true);

    if (!isPlaying) {
      togglePlay();
    }
  };

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    )) {
      return;
    }

    const isModifierPressed = event.metaKey || event.ctrlKey;
    const normalizedKey = event.key.toLowerCase();

    if (isModifierPressed && normalizedKey === 's') {
      event.preventDefault();
      setSaveStatus('saving');
      persistCurrentSession();
      return;
    }

    if (isModifierPressed && normalizedKey === 'z' && event.shiftKey) {
      event.preventDefault();
      dispatch({ type: 'REDO' });
      return;
    }

    if (isModifierPressed && normalizedKey === 'z') {
      event.preventDefault();
      dispatch({ type: 'UNDO' });
      return;
    }

    if (isModifierPressed && normalizedKey === 'y') {
      event.preventDefault();
      dispatch({ type: 'REDO' });
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();

      if (!isInitialized) {
        void initAudio();
        return;
      }

      togglePlay();
      return;
    }

    if (!isModifierPressed && normalizedKey === 'escape' && editorState.ui.isSettingsOpen) {
      dispatch({ type: 'TOGGLE_SETTINGS' });
      return;
    }

    if (!isModifierPressed && /^[1-8]$/.test(normalizedKey)) {
      dispatch({ type: 'SET_CURRENT_PATTERN', pattern: Number(normalizedKey) - 1 });
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcuts);

    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  const saveProject = () => {
    setSaveStatus('saving');
    persistCurrentSession();
  };

  const previewTrack = async (trackId: string, note?: string) => {
    const track = project.tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      return;
    }

    if (!isInitialized) {
      await initAudio();
    }

    engine.previewTrack(track, note ?? defaultNoteForTrack(track));
  };

  const resetTransportState = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const newSession = () => {
    resetTransportState();
    setLastSavedAt(null);
    setSaveStatus('idle');
    dispatch({ type: 'HYDRATE_SESSION', session: createDefaultSession() });
  };

  const exportSession = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = JSON.stringify({
      project: editorState.history.present,
      ui: editorState.ui,
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const fileName = project.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sonicstudio-session';

    anchor.href = url;
    anchor.download = `${fileName}.sonicstudio.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const bounceProjectRecording = async (renderProject: Project) => {
    if (typeof window === 'undefined' || isRecording) {
      return null;
    }

    if (!isInitialized) {
      await initAudio();
    }

    const renderSteps = renderProject.transport.mode === 'SONG'
      ? Math.max(
          renderProject.arrangerClips.reduce(
            (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
            renderProject.transport.stepsPerPattern,
          ),
          renderProject.transport.stepsPerPattern,
        )
      : renderProject.transport.stepsPerPattern;
    const renderDurationSeconds = renderSteps * (60 / renderProject.transport.bpm) * 0.25;
    const tailSeconds = 1.5;
    const bounceDurationMs = Math.max(1200, Math.ceil((renderDurationSeconds + tailSeconds) * 1000));

    stop();
    engine.syncProject(renderProject);

    try {
      await engine.startRecording();
      setIsRecording(true);
      setIsPlaying(engine.togglePlayback());

      await new Promise((resolve) => {
        window.setTimeout(resolve, bounceDurationMs);
      });

      return await engine.stopRecording(false);
    } finally {
      stop();
      setIsRecording(false);
      engine.syncProject(project);
    }
  };

  const exportAudioMix = async () => {
    const recording = await bounceProjectRecording(project);

    if (!recording) {
      return;
    }

    const wavBlob = await convertRecordingBlobToWav(recording);
    downloadBlob(wavBlob, `${sanitizeExportFileName(project.metadata.name)}-mix.wav`);
  };

  const exportTrackStems = async () => {
    const baseFileName = sanitizeExportFileName(project.metadata.name);

    for (const track of project.tracks) {
      const stemProject = cloneProject(project);
      stemProject.tracks = stemProject.tracks.map((candidate) => (
        candidate.id === track.id
          ? { ...candidate, muted: false, solo: false }
          : { ...candidate, muted: true, solo: false }
      ));

      const recording = await bounceProjectRecording(stemProject);
      if (!recording) {
        return;
      }

      const wavBlob = await convertRecordingBlobToWav(recording);
      downloadBlob(
        wavBlob,
        `${baseFileName}-${sanitizeExportFileName(track.name)}-stem.wav`,
      );

      if (typeof window !== 'undefined') {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 160);
        });
      }
    }
  };

  const importSession = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const session = hydrateSessionPayload(parsed);

      if (!session) {
        setSaveStatus('error');
        return false;
      }

      resetTransportState();
      setLastSavedAt(null);
      setSaveStatus('idle');
      dispatch({ type: 'HYDRATE_SESSION', session });
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  };

  return (
    <AudioContext.Provider value={{
      activeView,
      addArrangerClip: (trackId) => dispatch({ type: 'ADD_ARRANGER_CLIP', trackId }),
      arrangerClips,
      bpm: project.transport.bpm,
      canRedo: editorState.history.future.length > 0,
      canUndo: editorState.history.past.length > 0,
      clearPatternAt: (trackId, patternIndex) => dispatch({ type: 'CLEAR_PATTERN_AT', trackId, patternIndex }),
      clearTrack: (trackId) => dispatch({ type: 'CLEAR_TRACK', trackId }),
      createTrack: (trackType) => dispatch({ type: 'CREATE_TRACK', trackType }),
      currentPattern: project.transport.currentPattern,
      currentStep,
      duplicateArrangerClip: (clipId) => dispatch({ type: 'DUPLICATE_ARRANGER_CLIP', clipId }),
      exportAudioMix,
      exportTrackStems,
      loopArrangerClip: (clipId, copies) => dispatch({ type: 'LOOP_ARRANGER_CLIP', clipId, copies }),
      makeClipPatternUnique: (clipId) => dispatch({ type: 'MAKE_CLIP_PATTERN_UNIQUE', clipId }),
      duplicateTrack: (trackId) => dispatch({ type: 'DUPLICATE_TRACK', trackId }),
      exportSession,
      importSession,
      initAudio,
      isInitialized,
      isPlaying,
      isRecording,
      isSettingsOpen: editorState.ui.isSettingsOpen,
      lastSavedAt,
      newSession,
      patternCount: project.transport.patternCount,
      previewTrack,
      projectName: project.metadata.name,
      redo: () => dispatch({ type: 'REDO' }),
      removeArrangerClip: (clipId) => dispatch({ type: 'REMOVE_ARRANGER_CLIP', clipId }),
      removeTrack: (trackId) => dispatch({ type: 'REMOVE_TRACK', trackId }),
      renameProject: (name) => dispatch({ type: 'SET_PROJECT_NAME', name }),
      renameTrack: (trackId, name) => dispatch({ type: 'SET_TRACK_NAME', name, trackId }),
      saveProject,
      saveStatus,
      selectedTrackId,
      shiftPatternAt: (trackId, patternIndex, direction) => dispatch({ type: 'SHIFT_PATTERN_AT', direction, trackId, patternIndex }),
      shiftPattern: (trackId, direction) => dispatch({ type: 'SHIFT_PATTERN', direction, trackId }),
      setActiveView: (view) => dispatch({ type: 'SET_ACTIVE_VIEW', view }),
      setBpm: (bpm) => dispatch({ type: 'SET_BPM', bpm }),
      setCurrentPattern: (pattern) => dispatch({ type: 'SET_CURRENT_PATTERN', pattern }),
      setPatternCount: (patternCount) => dispatch({ type: 'SET_PATTERN_COUNT', patternCount }),
      setSelectedTrackId: (trackId) => dispatch({ type: 'SET_SELECTED_TRACK_ID', trackId }),
      setStepsPerPattern: (stepsPerPattern) => dispatch({ type: 'SET_STEPS_PER_PATTERN', stepsPerPattern }),
      setTrackParams: (trackId, params) => dispatch({ type: 'SET_TRACK_PARAMS', params, trackId }),
      setTrackSource: (trackId, source) => dispatch({ type: 'SET_TRACK_SOURCE', source, trackId }),
      setTransportMode: (mode) => dispatch({ type: 'SET_TRANSPORT_MODE', mode }),
      songLengthInBeats,
      splitArrangerClip: (clipId) => dispatch({ type: 'SPLIT_ARRANGER_CLIP', clipId }),
      stepsPerPattern: project.transport.stepsPerPattern,
      stop,
      toggleMute: (trackId) => dispatch({ type: 'TOGGLE_MUTE', trackId }),
      togglePlay,
      togglePatternStep: (trackId, patternIndex, stepIndex, note) => dispatch({ type: 'TOGGLE_PATTERN_STEP', note, patternIndex, stepIndex, trackId }),
      toggleRecording,
      toggleSettings: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
      toggleSolo: (trackId) => dispatch({ type: 'TOGGLE_SOLO', trackId }),
      toggleStep: (trackId, stepIndex, note) => dispatch({ type: 'TOGGLE_STEP', note, stepIndex, trackId }),
      tracks: project.tracks,
      transposePatternAt: (trackId, patternIndex, semitones) => dispatch({ type: 'TRANSPOSE_PATTERN_AT', semitones, trackId, patternIndex }),
      transposePattern: (trackId, semitones) => dispatch({ type: 'TRANSPOSE_PATTERN', semitones, trackId }),
      transportMode: project.transport.mode,
      undo: () => dispatch({ type: 'UNDO' }),
      updateArrangerClip: (clipId, updates) => dispatch({ type: 'UPDATE_ARRANGER_CLIP', clipId, updates }),
      updatePatternAutomationStep: (trackId, patternIndex, stepIndex, lane, value) => dispatch({ type: 'UPDATE_PATTERN_AUTOMATION_STEP', trackId, patternIndex, stepIndex, lane, value }),
      updatePatternStepEvent: (trackId, patternIndex, stepIndex, noteIndex, updates) => dispatch({ type: 'UPDATE_PATTERN_STEP_EVENT', noteIndex, stepIndex, trackId, patternIndex, updates }),
      updateStepEvent: (trackId, stepIndex, noteIndex, updates) => dispatch({ type: 'UPDATE_STEP_EVENT', noteIndex, stepIndex, trackId, updates }),
      updateTrackPan: (trackId, pan) => dispatch({ type: 'TOGGLE_PAN', pan, trackId }),
      updateTrackVolume: (trackId, volume) => dispatch({ type: 'TOGGLE_VOLUME', trackId, volume }),
    }}>
      {children}
    </AudioContext.Provider>
  );
};
