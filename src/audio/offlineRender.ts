import * as Tone from 'tone';

import { type Project } from '../project/schema';
import { ToneEngine } from './ToneEngine';

type OfflineTailMode = 'short' | 'standard' | 'long';

const TAIL_SECONDS: Record<OfflineTailMode, number> = {
  long: 2.8,
  short: 0.5,
  standard: 1.4,
};

const getPlaybackBeats = (project: Project) => (
  project.transport.mode === 'SONG'
    ? Math.max(
        project.arrangerClips.reduce(
          (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
          project.transport.stepsPerPattern,
        ),
        project.transport.stepsPerPattern,
      )
    : project.transport.stepsPerPattern
);

export const getOfflineRenderDurationSeconds = (
  project: Project,
  tailMode: OfflineTailMode = 'standard',
) => {
  const stepDurationSeconds = (60 / project.transport.bpm) * 0.25;
  const playbackDurationSeconds = getPlaybackBeats(project) * stepDurationSeconds;

  return {
    playbackDurationSeconds,
    renderDurationSeconds: playbackDurationSeconds + TAIL_SECONDS[tailMode],
  };
};

export const renderProjectOffline = async (
  project: Project,
  options: { sampleRate?: number; tailMode?: OfflineTailMode } = {},
): Promise<AudioBuffer> => {
  const sampleRate = options.sampleRate ?? 48_000;
  const { playbackDurationSeconds, renderDurationSeconds } = getOfflineRenderDurationSeconds(
    project,
    options.tailMode ?? 'standard',
  );

  const rendered = await Tone.Offline(async ({ transport }) => {
    const offlineEngine = new ToneEngine();
    await offlineEngine.init({ offline: true });
    offlineEngine.setTransportLoopEnabled(false);
    offlineEngine.syncProject(project);
    await offlineEngine.awaitAssetLoad();
    transport.stop(playbackDurationSeconds);
    offlineEngine.togglePlayback();
  }, renderDurationSeconds, 2, sampleRate);

  const audioBuffer = rendered.get();
  if (!audioBuffer) {
    throw new Error('Offline render produced no audio buffer.');
  }

  return audioBuffer;
};
