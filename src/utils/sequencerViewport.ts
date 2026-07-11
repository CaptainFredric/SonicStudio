export interface SequencerFollowViewport {
  clientWidth: number;
  forceCenter?: boolean;
  laneHeaderWidth: number;
  scrollLeft: number;
  scrollWidth: number;
  stepCellWidth: number;
  stepIndex: number;
}

export const getSequencerFollowScrollLeft = ({
  clientWidth,
  forceCenter = false,
  laneHeaderWidth,
  scrollLeft,
  scrollWidth,
  stepCellWidth,
  stepIndex,
}: SequencerFollowViewport): number | null => {
  const stepCenter = laneHeaderWidth + ((stepIndex + 0.5) * stepCellWidth);
  const visibleGridWidth = Math.max(stepCellWidth, clientWidth - laneHeaderWidth);
  const visibleLeft = scrollLeft + laneHeaderWidth + stepCellWidth;
  const visibleRight = scrollLeft + clientWidth - stepCellWidth;

  if (!forceCenter && stepCenter >= visibleLeft && stepCenter <= visibleRight) {
    return null;
  }

  const centeredLeft = stepCenter - laneHeaderWidth - (visibleGridWidth * 0.42);
  return Math.max(0, Math.min(Math.max(0, scrollWidth - clientWidth), centeredLeft));
};
