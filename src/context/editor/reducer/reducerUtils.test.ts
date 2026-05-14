import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../../../project/schema';
import { clampCurrentStepToLoopBounds, getLoopBoundsForProject } from './reducerUtils';

describe('reducerUtils loop bounds', () => {
  it('uses the explicit song loop range when one is active', () => {
    const project = createProjectFromTemplate('night-transit');

    expect(getLoopBoundsForProject(project, 16, 32)).toEqual({
      endBeat: 32,
      startBeat: 16,
    });
  });

  it('uses the explicit loop range even in pattern mode', () => {
    const project = createProjectFromTemplate('blank-grid');

    expect(getLoopBoundsForProject(project, 24, 48)).toEqual({
      endBeat: 48,
      startBeat: 24,
    });
  });

  it('falls back to the full pattern bounds when pattern playback has no custom loop', () => {
    const project = createProjectFromTemplate('blank-grid');

    expect(getLoopBoundsForProject(project, null, null)).toEqual({
      endBeat: project.transport.stepsPerPattern,
      startBeat: 0,
    });
  });

  it('clamps an out-of-range playhead back to the loop start', () => {
    const project = createProjectFromTemplate('night-transit');

    expect(clampCurrentStepToLoopBounds(project, 40, 8, 24)).toBe(8);
    expect(clampCurrentStepToLoopBounds(project, 16, 8, 24)).toBe(16);
  });
});