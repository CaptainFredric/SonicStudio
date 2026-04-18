import type { ArrangementClip, Track } from '../../project/schema';

export type DragMode = 'move' | 'trim-start' | 'trim-end';
export type SnapSize = 1 | 2 | 4 | 8 | 16;
export type ZoomPreset = 'PHRASE' | 'SECTION' | 'SONG';
export type PaintMode = 'add' | 'remove';
export type LaneScope = 'ALL' | 'ACTIVE' | 'FOCUSED' | 'PINNED' | 'DRUMS' | 'MUSICAL';
export type LaneGroupKey = 'RHYTHM' | 'MUSICAL' | 'TEXTURE';
export type LaneSectionKey = LaneGroupKey | 'PINNED';
export type InspectorTab = 'COMPOSE' | 'SHAPE' | 'SECTIONS';

export interface DragState {
  clipId: string;
  mode: DragMode;
  originX: number;
  previewBeatLength: number;
  previewStartBeat: number;
  sourceBeatLength: number;
  sourceStartBeat: number;
}

export interface PaintState {
  mode: PaintMode;
  note?: string;
  sliceIndex?: number;
}

export interface SectionRange {
  clipCount: number;
  endBeat: number;
  id: string;
  label: string;
  startBeat: number;
}

export interface LaneData {
  clips: ArrangementClip[];
  track: Track;
}

export interface LaneSection {
  key: LaneSectionKey;
  label: string;
  lanes: LaneData[];
}
