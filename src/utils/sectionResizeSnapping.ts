const QUARTER_BAR_STEPS = 4;
const QUARTER_BAR_MAGNET = 0.7;
const FULL_BAR_MAGNET = 1.1;

const nearestMultiple = (value: number, interval: number) => (
  Math.round(value / interval) * interval
);

export const snapSectionLength = (
  rawLength: number,
  stepsPerPattern: number,
  forceFullBars: boolean = false,
): number => {
  const barSteps = Math.max(QUARTER_BAR_STEPS, Math.round(stepsPerPattern));
  const length = Math.max(QUARTER_BAR_STEPS, rawLength);
  const nearestBar = nearestMultiple(length, barSteps);

  if (forceFullBars) {
    return Math.max(QUARTER_BAR_STEPS, nearestBar);
  }
  if (nearestBar >= barSteps && Math.abs(length - nearestBar) <= FULL_BAR_MAGNET) {
    return nearestBar;
  }

  const nearestQuarter = Math.max(
    QUARTER_BAR_STEPS,
    nearestMultiple(length, QUARTER_BAR_STEPS),
  );
  if (Math.abs(length - nearestQuarter) <= QUARTER_BAR_MAGNET) {
    return nearestQuarter;
  }

  return Math.max(QUARTER_BAR_STEPS, Math.round(length));
};
