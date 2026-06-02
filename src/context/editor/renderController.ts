import type { Dispatch, SetStateAction } from 'react';

import { renderProjectOfflineChunked } from '../../audio/offlineRender';
import { type BounceHistoryEntry, type Project } from '../../project/schema';
import { exportFailureNotice, exportSuccessNotice } from '../../services/exportFeedback';
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

type ExportNotifier = (tone: 'success' | 'error', title: string, detail?: string) => void;

interface CreateRenderControllerOptions {
  currentProject: Project;
  dispatchAppendBounceHistory: (entry: BounceHistoryEntry) => void;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  // Surface the outcome of an export so a failed render is never silent.
  notify?: ExportNotifier;
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
  notify = () => {},
  selectedArrangerClipId,
  setRenderState,
}: CreateRenderControllerOptions) => {
  const notifySuccess = (kind: Parameters<typeof exportSuccessNotice>[0]) => {
    const notice = exportSuccessNotice(kind);
    notify('success', notice.title, notice.detail);
  };
  const notifyFailure = (kind: Parameters<typeof exportFailureNotice>[0], error: unknown) => {
    const notice = exportFailureNotice(kind, error);
    notify('error', notice.title, notice.detail);
  };
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

    try {
      await exportOfflineMix({
        onMixRendered: (analysis) => {
          appendBounceHistory('mix', scope, options, buildBounceHistoryLabel(scope, 'mix'), analysis);
        },
        options,
        projectName: currentProject.metadata.name,
        renderOffline: renderProjectOfflineChunked,
        renderPayload,
        scheduler: browserScheduler,
        setRenderState,
      });
      notifySuccess('mix');
    } catch (error) {
      notifyFailure('mix', error);
    }
  };

  const exportMidi = async (
    scope: ExportScope = currentProject.transport.mode === 'SONG' ? 'song' : 'pattern',
  ) => {
    const renderPayload = resolveRenderPayload(scope);
    if (!renderPayload) {
      return;
    }

    try {
      const result = await exportToMIDI(renderPayload.project, { format: 'midi' });
      if (result.success) {
        notifySuccess('midi');
      } else {
        notifyFailure('midi', new Error(result.message ?? ''));
      }
    } catch (error) {
      notifyFailure('midi', error);
    }
  };

  const exportTrackStems = async (
    scope: ExportScope = currentProject.transport.mode === 'SONG' ? 'song' : 'pattern',
    options: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId } = {},
  ) => {
    const renderPayload = resolveRenderPayload(scope);
    if (!renderPayload) {
      return;
    }

    try {
      await exportOfflineStems({
        onStemBatchRendered: () => {
          appendBounceHistory('stems', scope, options, buildBounceHistoryLabel(scope, 'stems'));
        },
        options,
        projectName: currentProject.metadata.name,
        renderOffline: renderProjectOfflineChunked,
        renderPayload,
        scheduler: browserScheduler,
        setRenderState,
      });
      notifySuccess('stems');
    } catch (error) {
      notifyFailure('stems', error);
    }
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
