export interface SequencerFollowViewport {
  clientWidth: number;
  forceCenter?: boolean;
  laneHeaderWidth: number;
  scrollLeft: number;
  scrollWidth: number;
  stepCellWidth: number;
  stepIndex: number;
}

export interface SequencerWheelViewport {
  clientHeight: number;
  clientWidth: number;
  deltaX: number;
  deltaY: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  shiftKey?: boolean;
}

// Returns a horizontal pan only when the wheel cannot make useful vertical
// progress. This lets a normal wheel travel down the lanes first, then carry
// on across a wide pattern instead of feeling dead at the top or bottom edge.
export const getSequencerWheelPanDelta = ({
  clientHeight,
  clientWidth,
  deltaX,
  deltaY,
  scrollHeight,
  scrollLeft,
  scrollTop,
  scrollWidth,
  shiftKey = false,
}: SequencerWheelViewport): number | null => {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  if (maxScrollLeft <= 1) return null;

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const canScrollVertically = maxScrollTop > 1;
  const horizontalDeltaIsDominant = Math.abs(deltaX) > Math.abs(deltaY);
  const horizontalIntent = shiftKey || horizontalDeltaIsDominant || !canScrollVertically;

  if (!horizontalIntent) {
    const canMoveUp = deltaY < 0 && scrollTop > 1;
    const canMoveDown = deltaY > 0 && scrollTop < maxScrollTop - 1;
    if (canMoveUp || canMoveDown || deltaY === 0) return null;
  }

  const delta = horizontalDeltaIsDominant ? deltaX : deltaY;
  if (delta === 0) return null;
  if (delta < 0 && scrollLeft <= 1) return null;
  if (delta > 0 && scrollLeft >= maxScrollLeft - 1) return null;
  return delta;
};

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
