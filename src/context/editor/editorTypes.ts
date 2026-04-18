import type {
  ArrangementClip,
  AppView,
  BounceHistoryEntry,
  InstrumentType,
  MasterSettings,
  NoteEvent,
  Project,
  SampleSliceMemory,
  SongMarker,
  StudioSession,
  StudioUIState,
  SynthParams,
  TrackSource,
  TransportMode,
} from '../../project/schema';

export interface HistoryState {
  future: Project[];
  past: Project[];
  present: Project;
}

export interface EditorState {
  history: HistoryState;
  ui: StudioUIState;
}

export type EditorAction =
  | { type: 'ADD_ARRANGER_CLIP'; trackId?: string }
  | { type: 'APPLY_TRACK_VOICE_PRESET'; presetId: string; trackId: string }
  | { type: 'APPLY_TRACK_SNAPSHOT'; snapshotId: string; trackId: string }
  | { type: 'APPEND_BOUNCE_HISTORY'; entry: BounceHistoryEntry }
  | { type: 'APPLY_MASTER_SNAPSHOT'; snapshotId: string }
  | { type: 'CLEAR_TRACK'; trackId: string }
  | { type: 'CLEAR_PATTERN_AT'; trackId: string; patternIndex: number }
  | { type: 'CREATE_SONG_MARKER'; beat: number; name?: string }
  | { type: 'CREATE_TRACK'; trackType: InstrumentType }
  | { type: 'CREATE_SAMPLE_SLICE'; trackId: string; slice?: Partial<SampleSliceMemory> }
  | { type: 'DELETE_SAMPLE_SLICE'; trackId: string; sliceIndex: number }
  | { type: 'DELETE_MASTER_SNAPSHOT'; snapshotId: string }
  | { type: 'DELETE_TRACK_SNAPSHOT'; snapshotId: string }
  | { type: 'DUPLICATE_ARRANGER_CLIP'; clipId: string }
  | { type: 'DUPLICATE_SONG_RANGE'; endBeat: number; label?: string; startBeat: number }
  | { type: 'LOOP_ARRANGER_CLIP'; clipId: string; copies: number }
  | { type: 'MAKE_CLIP_PATTERN_UNIQUE'; clipId: string }
  | { type: 'SPLIT_ARRANGER_CLIP'; clipId: string; splitAtBeat?: number }
  | { type: 'DUPLICATE_TRACK'; trackId: string }
  | { type: 'MOVE_TRACK'; direction: 'up' | 'down'; trackId: string }
  | { type: 'HYDRATE_SESSION'; session: StudioSession }
  | { type: 'REDO' }
  | { type: 'REMOVE_ARRANGER_CLIP'; clipId: string }
  | { type: 'REMOVE_SONG_MARKER'; markerId: string }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'SET_SELECTED_ARRANGER_CLIP'; clipId: string | null }
  | { type: 'TOGGLE_PINNED_TRACK'; trackId: string }
  | { type: 'SHIFT_PATTERN'; direction: 'left' | 'right'; trackId: string }
  | { type: 'SHIFT_PATTERN_AT'; direction: 'left' | 'right'; trackId: string; patternIndex: number }
  | { type: 'SET_ACTIVE_VIEW'; view: AppView }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_COUNT_IN_BARS'; bars: number }
  | { type: 'SET_LOOP_RANGE'; endBeat: number | null; startBeat: number | null }
  | { type: 'SET_MASTER_SETTINGS'; settings: Partial<MasterSettings> }
  | { type: 'SET_CURRENT_PATTERN'; pattern: number }
  | { type: 'SET_PATTERN_COUNT'; patternCount: number }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_CLIP_PATTERN_STEP_SLICE'; clipId: string; note?: string; sliceIndex: number | null; stepIndex: number }
  | { type: 'SET_SELECTED_TRACK_ID'; trackId: string | null }
  | { type: 'SELECT_SAMPLE_SLICE'; trackId: string; sliceIndex: number | null }
  | { type: 'SET_STEPS_PER_PATTERN'; stepsPerPattern: number }
  | { type: 'SET_TRACK_NAME'; name: string; trackId: string }
  | { type: 'SET_TRACK_PARAMS'; params: Partial<SynthParams>; trackId: string }
  | { type: 'SET_TRACK_SOURCE'; source: Partial<TrackSource>; trackId: string }
  | { type: 'SET_METRONOME_ENABLED'; enabled: boolean }
  | { type: 'SET_TRANSPORT_MODE'; mode: TransportMode }
  | { type: 'SAVE_MASTER_SNAPSHOT'; snapshotId?: string | null }
  | { type: 'SAVE_TRACK_SNAPSHOT'; snapshotId?: string | null; trackId: string }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'TOGGLE_PAN'; pan: number; trackId: string }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_SOLO'; trackId: string }
  | { type: 'TOGGLE_CLIP_PATTERN_STEP'; clipId: string; mode?: 'add' | 'remove' | 'toggle'; note?: string; stepIndex: number }
  | { type: 'TOGGLE_STEP'; note?: string; stepIndex: number; trackId: string }
  | { type: 'TOGGLE_PATTERN_STEP'; note?: string; stepIndex: number; trackId: string; patternIndex: number }
  | { type: 'TOGGLE_VOLUME'; trackId: string; volume: number }
  | { type: 'TRANSFORM_CLIP_PATTERN'; clipId: string; transform: 'clear' | 'double-density' | 'halve-density' | 'randomize-velocity' | 'reset-automation' | 'shift-left' | 'shift-right' | 'transpose'; value?: number }
  | { type: 'TRANSPOSE_PATTERN'; semitones: number; trackId: string }
  | { type: 'TRANSPOSE_PATTERN_AT'; semitones: number; trackId: string; patternIndex: number }
  | { type: 'UNDO' }
  | { type: 'UPDATE_ARRANGER_CLIP'; clipId: string; updates: Partial<ArrangementClip> }
  | { type: 'UPDATE_CLIP_PATTERN_AUTOMATION_STEP'; clipId: string; stepIndex: number; lane: 'level' | 'tone'; value: number }
  | { type: 'UPDATE_CLIP_PATTERN_STEP_EVENT'; clipId: string; noteIndex: number; stepIndex: number; updates: Partial<NoteEvent> }
  | { type: 'UPDATE_PATTERN_AUTOMATION_STEP'; trackId: string; patternIndex: number; stepIndex: number; lane: 'level' | 'tone'; value: number }
  | { type: 'UPDATE_PATTERN_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; patternIndex: number; updates: Partial<NoteEvent> }
  | { type: 'UPDATE_SONG_MARKER'; markerId: string; updates: Partial<Omit<SongMarker, 'id'>> }
  | { type: 'UPDATE_SAMPLE_SLICE'; trackId: string; sliceIndex: number; updates: Partial<SampleSliceMemory> }
  | { type: 'UPDATE_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; updates: Partial<NoteEvent> };
