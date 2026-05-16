export type PaneTarget = 'ARRANGER' | 'PIANO_ROLL' | 'MIXER' | 'SEQUENCER';
export type SidePlacement = 'right' | 'left';

export interface LayoutPreset {
  name: string;
  topView: PaneTarget;
  bottomView: PaneTarget;
  sideOpen: boolean;
  sideView: PaneTarget;
  sidePlacement: SidePlacement;
  topRatio: number;
  sideWidth: number;
}

export const TARGET_LABELS: Record<PaneTarget, string> = {
  ARRANGER: 'Arranger',
  PIANO_ROLL: 'Piano roll',
  MIXER: 'Mixer',
  SEQUENCER: 'Sequencer',
};

export const STORAGE = {
  topRatio: 'sonicstudio:compose:topRatio:v1',
  topView: 'sonicstudio:compose:topView:v1',
  bottomView: 'sonicstudio:compose:bottomView:v1',
  sideOpen: 'sonicstudio:compose:sideOpen:v1',
  sideView: 'sonicstudio:compose:sideView:v1',
  sideWidth: 'sonicstudio:compose:sideWidth:v1',
  sidePlacement: 'sonicstudio:compose:sidePlacement:v1',
  presets: 'sonicstudio:compose:presets:v1',
} as const;

export const MIN_TOP_RATIO = 0.12;
export const MAX_TOP_RATIO = 0.88;
// Favour the lower pane by default: it usually holds the Piano Roll, where
// the detailed note work happens, while the upper Arranger reads as an
// overview and needs less height.
export const DEFAULT_TOP_RATIO = 0.42;

export const MIN_SIDE_WIDTH = 220;
export const MAX_SIDE_WIDTH = 880;
export const DEFAULT_SIDE_WIDTH = 380;

export const DEFAULT_PRESETS: LayoutPreset[] = [
  { name: 'Writing', topView: 'ARRANGER', bottomView: 'PIANO_ROLL', sideOpen: false, sideView: 'MIXER', sidePlacement: 'right', topRatio: 0.5, sideWidth: 380 },
  { name: 'Mixing', topView: 'MIXER', bottomView: 'PIANO_ROLL', sideOpen: true, sideView: 'ARRANGER', sidePlacement: 'right', topRatio: 0.55, sideWidth: 420 },
  { name: 'Beat-making', topView: 'SEQUENCER', bottomView: 'PIANO_ROLL', sideOpen: false, sideView: 'MIXER', sidePlacement: 'right', topRatio: 0.45, sideWidth: 380 },
];

export const isPaneTarget = (value: unknown): value is PaneTarget => (
  value === 'ARRANGER' || value === 'PIANO_ROLL' || value === 'MIXER' || value === 'SEQUENCER'
);

export const isSidePlacement = (value: unknown): value is SidePlacement => value === 'left' || value === 'right';

export const clampTopRatio = (value: number) => Math.min(MAX_TOP_RATIO, Math.max(MIN_TOP_RATIO, value));
export const clampSideWidth = (value: number) => Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, value));

export const normalizeLayoutPreset = (entry: unknown): LayoutPreset | null => {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Record<string, unknown>;
  if (!isPaneTarget(candidate.topView) || !isPaneTarget(candidate.bottomView) || !isPaneTarget(candidate.sideView)) return null;
  if (!isSidePlacement(candidate.sidePlacement)) return null;

  const name = typeof candidate.name === 'string' && candidate.name.trim()
    ? candidate.name.trim().slice(0, 24)
    : 'Preset';
  const topRatio = typeof candidate.topRatio === 'number' && Number.isFinite(candidate.topRatio)
    ? clampTopRatio(candidate.topRatio)
    : DEFAULT_TOP_RATIO;
  const sideWidth = typeof candidate.sideWidth === 'number' && Number.isFinite(candidate.sideWidth)
    ? clampSideWidth(candidate.sideWidth)
    : DEFAULT_SIDE_WIDTH;

  return {
    name,
    topView: candidate.topView,
    bottomView: candidate.bottomView,
    sideOpen: candidate.sideOpen === true,
    sideView: candidate.sideView,
    sidePlacement: candidate.sidePlacement,
    topRatio,
    sideWidth,
  };
};

export const normalizeLayoutPresets = (value: unknown): LayoutPreset[] => {
  if (!Array.isArray(value)) return DEFAULT_PRESETS;
  const sanitized = value
    .map(normalizeLayoutPreset)
    .filter((entry): entry is LayoutPreset => entry !== null)
    .slice(0, 6);
  return sanitized.length ? sanitized : DEFAULT_PRESETS;
};
