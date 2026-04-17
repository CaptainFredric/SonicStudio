import type { RenderTargetProfileId } from '../utils/export';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type RenderMode = 'mix' | 'stems' | null;
export type ExportScope = 'pattern' | 'song' | 'clip-window' | 'loop-window';
export type BounceTailMode = 'short' | 'standard' | 'long';
export type BounceNormalizationMode = 'none' | 'peak' | 'target';

export interface RenderState {
  active: boolean;
  currentTrackName: string | null;
  etaSeconds: number | null;
  mode: RenderMode;
  phase: string;
  progress: number;
}

export interface BounceRenderOptions {
  normalization?: BounceNormalizationMode;
  tailMode?: BounceTailMode;
  targetProfileId?: RenderTargetProfileId;
}

export const IDLE_RENDER_STATE: RenderState = {
  active: false,
  currentTrackName: null,
  etaSeconds: null,
  mode: null,
  phase: 'Idle',
  progress: 0,
};

export const formatBounceScopeLabel = (scope: ExportScope) => {
  if (scope === 'clip-window') {
    return 'Clip window';
  }

  if (scope === 'loop-window') {
    return 'Loop window';
  }

  return scope === 'song' ? 'Song' : 'Pattern';
};
