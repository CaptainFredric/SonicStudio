import {
  cloneProject,
  type BounceHistoryEntry,
  type Project,
} from '../project/schema';
import {
  convertAudioBufferToWavWithAnalysis,
  downloadBlob,
  sanitizeExportFileName,
  type AudioRenderAnalysis,
} from '../utils/export';
import {
  formatBounceScopeLabel,
  type BounceRenderOptions,
  type BounceTailMode,
  type ExportScope,
  type RenderState,
} from './workflowTypes';

export interface RenderProjectPayload {
  fileSuffix: string;
  label: string;
  project: Project;
}

export interface RenderProjectRequest {
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  project: Project;
  scope: ExportScope;
  selectedArrangerClipId: string | null;
}

export interface RenderScheduler {
  clearTimeout: (timerId: number) => void;
  delay: (ms: number) => Promise<void>;
  setTimeout: (callback: () => void, ms: number) => number;
}

export type RenderStateUpdater = (
  nextState: RenderState | ((current: RenderState) => RenderState),
) => void;

interface OfflineRenderControllerBase {
  options: BounceRenderOptions;
  projectName: string;
  renderOffline: (project: Project, options: { tailMode?: BounceTailMode }) => Promise<AudioBuffer>;
  renderPayload: RenderProjectPayload;
  scheduler: RenderScheduler;
  setRenderState: RenderStateUpdater;
}

interface OfflineMixController extends OfflineRenderControllerBase {
  onMixRendered: (analysis: AudioRenderAnalysis) => void;
}

interface OfflineStemController extends OfflineRenderControllerBase {
  onStemBatchRendered: () => void;
}

const queueProgressTimers = (
  scheduler: RenderScheduler,
  setRenderState: RenderStateUpdater,
  progressBase: number,
  progressWeight: number,
  trackName?: string | null,
) => [0.18, 0.42, 0.66, 0.84].map((progress, index) => (
  scheduler.setTimeout(() => {
    setRenderState((current) => current.active ? {
      ...current,
      currentTrackName: trackName ?? current.currentTrackName,
      progress: Math.max(current.progress, progressBase + (progress * progressWeight)),
    } : current);
  }, 240 + index * 260)
));

const clearProgressTimers = (scheduler: RenderScheduler, timerIds: number[]) => {
  timerIds.forEach((timerId) => {
    scheduler.clearTimeout(timerId);
  });
};

export const buildWindowRenderProject = (
  project: Project,
  rangeStart: number,
  rangeEnd: number,
  label: string,
  fileSuffix: string,
): RenderProjectPayload | null => {
  const normalizedStart = Math.max(0, Math.round(rangeStart));
  const normalizedEnd = Math.max(normalizedStart + 1, Math.round(rangeEnd));
  if (normalizedEnd <= normalizedStart) {
    return null;
  }

  const clippedProject = cloneProject(project);
  clippedProject.arrangerClips = clippedProject.arrangerClips
    .filter((clip) => clip.startBeat < normalizedEnd && clip.startBeat + clip.beatLength > normalizedStart)
    .map((clip) => ({
      ...clip,
      beatLength: Math.max(
        1,
        Math.min(clip.startBeat + clip.beatLength, normalizedEnd) - Math.max(clip.startBeat, normalizedStart),
      ),
      startBeat: Math.max(clip.startBeat, normalizedStart) - normalizedStart,
    }));
  clippedProject.markers = clippedProject.markers
    .filter((marker) => marker.beat >= normalizedStart && marker.beat < normalizedEnd)
    .map((marker) => ({
      ...marker,
      beat: marker.beat - normalizedStart,
    }));
  clippedProject.transport = {
    ...clippedProject.transport,
    countInBars: 0,
    metronomeEnabled: false,
    mode: 'SONG',
  };

  return {
    fileSuffix,
    label,
    project: clippedProject,
  };
};

export const buildRenderProject = ({
  loopRangeEndBeat,
  loopRangeStartBeat,
  project,
  scope,
  selectedArrangerClipId,
}: RenderProjectRequest): RenderProjectPayload | null => {
  if (scope === 'pattern') {
    return {
      fileSuffix: 'pattern',
      label: `Pattern ${String.fromCharCode(65 + project.transport.currentPattern)}`,
      project: {
        ...cloneProject(project),
        transport: {
          ...project.transport,
          countInBars: 0,
          metronomeEnabled: false,
          mode: 'PATTERN',
        },
      },
    };
  }

  if (scope === 'song') {
    return {
      fileSuffix: 'song',
      label: 'Full song',
      project: {
        ...cloneProject(project),
        transport: {
          ...project.transport,
          countInBars: 0,
          metronomeEnabled: false,
          mode: 'SONG',
        },
      },
    };
  }

  if (scope === 'loop-window') {
    if (loopRangeStartBeat === null || loopRangeEndBeat === null) {
      return null;
    }

    return buildWindowRenderProject(
      project,
      loopRangeStartBeat,
      loopRangeEndBeat,
      'Loop window',
      `loop-${loopRangeStartBeat + 1}-${loopRangeEndBeat}`,
    );
  }

  const selectedClip = project.arrangerClips.find((clip) => clip.id === selectedArrangerClipId);
  if (!selectedClip) {
    return null;
  }

  return buildWindowRenderProject(
    project,
    selectedClip.startBeat,
    selectedClip.startBeat + selectedClip.beatLength,
    'Selected clip window',
    `clip-${selectedClip.patternIndex + 1}`,
  );
};

export const buildBounceHistoryEntry = (
  project: Project,
  mode: 'mix' | 'stems',
  scope: ExportScope,
  options: BounceRenderOptions,
  label: string,
  analysis?: AudioRenderAnalysis,
): BounceHistoryEntry => {
  const matchingSnapshot = project.masterSnapshots.find((snapshot) => (
    snapshot.settings.glueCompression === project.master.glueCompression
    && snapshot.settings.highCutHz === project.master.highCutHz
    && snapshot.settings.limiterCeiling === project.master.limiterCeiling
    && snapshot.settings.lowCutHz === project.master.lowCutHz
    && snapshot.settings.outputGain === project.master.outputGain
    && snapshot.settings.stereoWidth === project.master.stereoWidth
    && snapshot.settings.tone === project.master.tone
  ));

  return {
    exportedAt: new Date().toISOString(),
    id: `bounce-history_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    masterSnapshotName: matchingSnapshot?.name ?? null,
    mode,
    normalization: options.normalization ?? 'none',
    crestDb: analysis?.crestDb,
    durationSeconds: analysis?.durationSeconds,
    estimatedLufs: analysis?.estimatedLufs,
    peakDb: analysis?.peakDb,
    quality: analysis?.quality,
    recommendation: analysis?.recommendation,
    rmsDb: analysis?.rmsDb,
    sampleRate: analysis?.sampleRate,
    scope,
    tailMode: options.tailMode ?? 'standard',
    targetDeltaDb: analysis?.targetDeltaDb,
    targetLabel: analysis?.targetLabel,
    targetLufs: analysis?.targetLufs,
    targetLufsDelta: analysis?.targetLufsDelta,
    targetProfileId: options.normalization === 'target' ? options.targetProfileId ?? 'streaming' : undefined,
    targetVerdict: analysis?.targetVerdict,
  };
};

export const exportOfflineMix = async ({
  onMixRendered,
  options,
  projectName,
  renderOffline,
  renderPayload,
  scheduler,
  setRenderState,
}: OfflineMixController) => {
  setRenderState({
    active: true,
    currentTrackName: null,
    etaSeconds: null,
    mode: 'mix',
    phase: `Rendering ${renderPayload.label.toLowerCase()} offline`,
    progress: 0,
  });

  let progressTimers: number[] = [];

  try {
    progressTimers = queueProgressTimers(scheduler, setRenderState, 0, 1);
    const audioBuffer = await renderOffline(renderPayload.project, {
      tailMode: options.tailMode,
    });
    clearProgressTimers(scheduler, progressTimers);
    progressTimers = [];

    setRenderState((current) => ({
      ...current,
      etaSeconds: null,
      phase: 'Encoding WAV',
      progress: Math.max(current.progress, 0.98),
    }));

    const { analysis, wavBlob } = convertAudioBufferToWavWithAnalysis(audioBuffer, {
      normalization: options.normalization ?? 'none',
      targetProfileId: options.targetProfileId,
    });
    downloadBlob(wavBlob, `${sanitizeExportFileName(projectName)}-${renderPayload.fileSuffix}-mix.wav`);
    onMixRendered(analysis);
    setRenderState((current) => ({
      ...current,
      phase: 'Mix ready',
      progress: 1,
    }));
  } finally {
    clearProgressTimers(scheduler, progressTimers);
    scheduler.setTimeout(() => {
      setRenderState({
        active: false,
        currentTrackName: null,
        etaSeconds: null,
        mode: null,
        phase: 'Idle',
        progress: 0,
      });
    }, 500);
  }
};

export const exportOfflineStems = async ({
  onStemBatchRendered,
  options,
  projectName,
  renderOffline,
  renderPayload,
  scheduler,
  setRenderState,
}: OfflineStemController) => {
  const baseFileName = sanitizeExportFileName(projectName);
  const stemTracks = renderPayload.project.tracks;

  setRenderState({
    active: true,
    currentTrackName: stemTracks[0]?.name ?? null,
    etaSeconds: null,
    mode: 'stems',
    phase: `Rendering ${renderPayload.label.toLowerCase()} stems 1/${stemTracks.length}`,
    progress: 0,
  });

  let progressTimers: number[] = [];

  try {
    for (const [index, track] of stemTracks.entries()) {
      const stemProject = cloneProject(renderPayload.project);
      stemProject.tracks = stemProject.tracks.map((candidate) => (
        candidate.id === track.id
          ? { ...candidate, muted: false, solo: false }
          : { ...candidate, muted: true, solo: false }
      ));

      const progressBase = index / stemTracks.length;
      const progressWeight = 1 / stemTracks.length;
      setRenderState((current) => ({
        ...current,
        currentTrackName: track.name,
        phase: `Rendering ${renderPayload.label.toLowerCase()} stems ${index + 1}/${stemTracks.length}`,
        progress: progressBase,
      }));

      progressTimers = queueProgressTimers(scheduler, setRenderState, progressBase, progressWeight, track.name);
      const audioBuffer = await renderOffline(stemProject, {
        tailMode: options.tailMode,
      });
      clearProgressTimers(scheduler, progressTimers);
      progressTimers = [];

      setRenderState((current) => ({
        ...current,
        currentTrackName: track.name,
        etaSeconds: null,
        phase: `Encoding ${track.name}`,
        progress: Math.max(current.progress, progressBase + (progressWeight * 0.98)),
      }));

      const { wavBlob } = convertAudioBufferToWavWithAnalysis(audioBuffer, {
        normalization: options.normalization ?? 'none',
        targetProfileId: options.targetProfileId,
      });
      downloadBlob(
        wavBlob,
        `${baseFileName}-${renderPayload.fileSuffix}-${sanitizeExportFileName(track.name)}-stem.wav`,
      );

      await scheduler.delay(160);
    }

    onStemBatchRendered();
    setRenderState((current) => ({
      ...current,
      currentTrackName: null,
      phase: 'Stems ready',
      progress: 1,
    }));
  } finally {
    clearProgressTimers(scheduler, progressTimers);
    scheduler.setTimeout(() => {
      setRenderState({
        active: false,
        currentTrackName: null,
        etaSeconds: null,
        mode: null,
        phase: 'Idle',
        progress: 0,
      });
    }, 500);
  }
};

export const buildBounceHistoryLabel = (scope: ExportScope, mode: 'mix' | 'stems') => (
  `${formatBounceScopeLabel(scope)} ${mode}`
);
