import type { Dispatch, SetStateAction } from 'react';

import { renderProjectOffline } from '../../audio/offlineRender';
import { type BounceHistoryEntry, type Project } from '../../project/schema';
import {
  buildBounceHistoryEntry,
  buildBounceHistoryLabel,
  buildRenderProject,
  exportOfflineMix,
  exportOfflineStems,
} from '../../services/renderWorkflow';
import type {
  BounceNormalizationMode,
  BounceTailMode,
  ExportScope,
  RenderState,
} from '../../services/workflowTypes';
import { exportToMIDI, type RenderTargetProfileId } from '../../utils/export';

interface CreateRenderControllerOptions {
  currentProject: Project;
  dispatchAppendBounceHistory: (entry: BounceHistoryEntry) => void;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  selectedArrangerClipId: string | null;
  setRenderState: Dispatch<SetStateAction<RenderState>>;
}

const browserScheduler = {
  clearTimeout: (timerId: number) => window.clearTimeout(timerId),
  delay: (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  }),
  setTimeout: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
};

export const buildBounceReplayOptions = (entry: BounceHistoryEntry) => ({
  normalization: entry.normalization,
  tailMode: entry.tailMode,
  targetProfileId: entry.targetProfileId,
} satisfies {
  normalization: BounceNormalizationMode;
  tailMode: BounceTailMode;
  targetProfileId?: RenderTargetProfileId;
});

export const createRenderController = ({
  currentProject,
  dispatchAppendBounceHistory,
  loopRangeEndBeat,
  loopRangeStartBeat,
  selectedArrangerClipId,
  setRenderState,
}: CreateRenderControllerOptions) => {
  const appendBounceHistory = (
    mode: 'mix' | 'stems',
    scope: ExportScope,
    options: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId },
    label: string,
    analysis?: Parameters<typeof buildBounceHistoryEntry>[5],
  ) => {
    dispatchAppendBounceHistory(
      buildBounceHistoryEntry(currentProject, mode, scope, options, label, analysis),
    );
  };

  const resolveRenderPayload = (scope: ExportScope) => buildRenderProject({
    loopRangeEndBeat,
    loopRangeStartBeat,
    project: currentProject,
    scope,
    selectedArrangerClipId,
  });

  const exportAudioMix = async (
    scope: ExportScope = currentProject.transport.mode === 'SONG' ? 'song' : 'pattern',
    options: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId } = {},
  ) => {
    const renderPayload = resolveRenderPayload(scope);
    if (!renderPayload) {
      return;
    }

    await exportOfflineMix({
      onMixRendered: (analysis) => {
        appendBounceHistory('mix', scope, options, buildBounceHistoryLabel(scope, 'mix'), analysis);
      },
      options,
      projectName: currentProject.metadata.name,
      renderOffline: renderProjectOffline,
      renderPayload,
      scheduler: browserScheduler,
      setRenderState,
    });
  };

  const exportMidi = async (
    scope: ExportScope = currentProject.transport.mode === 'SONG' ? 'song' : 'pattern',
  ) => {
    const renderPayload = resolveRenderPayload(scope);
    if (!renderPayload) {
      return;
    }

    await exportToMIDI(renderPayload.project, { format: 'midi' });
  };

  const exportTrackStems = async (
    scope: ExportScope = currentProject.transport.mode === 'SONG' ? 'song' : 'pattern',
    options: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId } = {},
  ) => {
    const renderPayload = resolveRenderPayload(scope);
    if (!renderPayload) {
      return;
    }

    await exportOfflineStems({
      onStemBatchRendered: () => {
        appendBounceHistory('stems', scope, options, buildBounceHistoryLabel(scope, 'stems'));
      },
      options,
      projectName: currentProject.metadata.name,
      renderOffline: renderProjectOffline,
      renderPayload,
      scheduler: browserScheduler,
      setRenderState,
    });
  };

  const rerunBounceHistory = async (entryId: string) => {
    const entry = currentProject.bounceHistory.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return;
    }

    const options = buildBounceReplayOptions(entry);

    if (entry.mode === 'stems') {
      await exportTrackStems(entry.scope, options);
      return;
    }

    await exportAudioMix(entry.scope, options);
  };

  return {
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    rerunBounceHistory,
  };
};
