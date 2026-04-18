import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectFromTemplate } from '../../project/schema';
import { createRenderController } from './renderController';

const renderControllerMocks = vi.hoisted(() => ({
  exportOfflineMix: vi.fn(),
  exportOfflineStems: vi.fn(),
  exportToMIDI: vi.fn(),
  renderProjectOffline: vi.fn(),
}));

vi.mock('../../audio/offlineRender', () => ({
  renderProjectOffline: renderControllerMocks.renderProjectOffline,
}));

vi.mock('../../utils/export', () => ({
  exportToMIDI: renderControllerMocks.exportToMIDI,
}));

vi.mock('../../services/renderWorkflow', async () => {
  const actual = await vi.importActual<typeof import('../../services/renderWorkflow')>('../../services/renderWorkflow');
  return {
    ...actual,
    exportOfflineMix: renderControllerMocks.exportOfflineMix,
    exportOfflineStems: renderControllerMocks.exportOfflineStems,
  };
});

describe('renderController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips clip-window mix export when no clip is selected', async () => {
    const project = createProjectFromTemplate('night-transit');
    const controller = createRenderController({
      currentProject: project,
      dispatchAppendBounceHistory: vi.fn(),
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      selectedArrangerClipId: null,
      setRenderState: vi.fn(),
    });

    await controller.exportAudioMix('clip-window');

    expect(renderControllerMocks.exportOfflineMix).not.toHaveBeenCalled();
  });

  it('passes a clipped loop-window payload into offline mix export', async () => {
    const project = createProjectFromTemplate('night-transit');
    const setRenderState = vi.fn();
    const dispatchAppendBounceHistory = vi.fn();
    const controller = createRenderController({
      currentProject: project,
      dispatchAppendBounceHistory,
      loopRangeEndBeat: 20,
      loopRangeStartBeat: 8,
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      setRenderState,
    });

    await controller.exportAudioMix('loop-window', {
      normalization: 'target',
      targetProfileId: 'streaming',
    });

    expect(renderControllerMocks.exportOfflineMix).toHaveBeenCalledTimes(1);
    const call = renderControllerMocks.exportOfflineMix.mock.calls[0]?.[0];
    expect(call.renderPayload.label).toBe('Loop window');
    expect(call.renderPayload.fileSuffix).toBe('loop-9-20');
    expect(call.renderPayload.project.arrangerClips.every((clip: { startBeat: number; beatLength: number }) => (
      clip.startBeat >= 0 && clip.startBeat + clip.beatLength <= 12
    ))).toBe(true);
    expect(call.renderOffline).toBe(renderControllerMocks.renderProjectOffline);
    expect(call.setRenderState).toBe(setRenderState);
    expect(dispatchAppendBounceHistory).not.toHaveBeenCalled();
  });

  it('replays a stem export from bounce history with the stored scope', async () => {
    const project = createProjectFromTemplate('night-transit');
    project.bounceHistory = [{
      exportedAt: '2026-04-18T12:00:00.000Z',
      id: 'entry-a',
      label: 'Selected clip stems',
      masterSnapshotName: null,
      mode: 'stems',
      normalization: 'none',
      scope: 'clip-window',
      tailMode: 'short',
    }];

    const controller = createRenderController({
      currentProject: project,
      dispatchAppendBounceHistory: vi.fn(),
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      setRenderState: vi.fn(),
    });

    await controller.rerunBounceHistory('entry-a');

    expect(renderControllerMocks.exportOfflineStems).toHaveBeenCalledTimes(1);
    const call = renderControllerMocks.exportOfflineStems.mock.calls[0]?.[0];
    expect(call.renderPayload.label).toBe('Selected clip window');
    expect(call.options.tailMode).toBe('short');
  });
});
