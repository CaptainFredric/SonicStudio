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

// --- Chunked rendering ----------------------------------------------------
//
// A long bounce can be rendered in segments instead of one giant pass. Each
// chunk renders its own slice of the arrangement plus a short silent pre-roll
// so notes and reverb ringing into the slice are already established, then we
// discard the pre-roll and equal-power crossfade the seams. This keeps the
// graph-build per pass small, lets the UI breathe and report real progress
// between chunks, and makes the work cancelable, all without audible seams.

/** Steps (16th notes) per render chunk. ~16 bars of 4/4 at 16 steps/bar. */
const CHUNK_STEPS = 256;
/** Silent lead-in rendered before each chunk so tails crossing into it are right. */
const PRE_ROLL_SECONDS = 2.5;
/** Equal-power crossfade length applied at each chunk seam. */
const CROSSFADE_SECONDS = 0.012;
/** Below this, a single pass is simpler and avoids the crossfade overhead. */
const CHUNK_THRESHOLD_SECONDS = 25;

export interface ChunkedRenderOptions {
  sampleRate?: number;
  tailMode?: OfflineTailMode;
  /** Reports 0..1 completion as each chunk lands. */
  onProgress?: (fraction: number) => void;
}

// Render a single window of the arrangement starting at an exact beat. Note
// scheduling stops naturally at the arrangement end, so the trailing seconds
// capture the decay/reverb tail.
const renderProjectWindow = async (
  project: Project,
  startBeat: number,
  renderSeconds: number,
  sampleRate: number,
): Promise<AudioBuffer> => {
  const rendered = await Tone.Offline(async () => {
    const offlineEngine = new ToneEngine();
    await offlineEngine.init({ offline: true });
    offlineEngine.setTransportLoopEnabled(false);
    offlineEngine.syncProject(project);
    await offlineEngine.awaitAssetLoad();
    offlineEngine.startOfflineAt(startBeat);
  }, renderSeconds, 2, sampleRate);

  const audioBuffer = rendered.get();
  if (!audioBuffer) {
    throw new Error('Offline render produced no audio buffer.');
  }
  return audioBuffer;
};

export const renderProjectOfflineChunked = async (
  project: Project,
  options: ChunkedRenderOptions = {},
): Promise<AudioBuffer> => {
  const sampleRate = options.sampleRate ?? 48_000;
  const tailMode = options.tailMode ?? 'standard';
  const tailSeconds = TAIL_SECONDS[tailMode];
  const stepSeconds = (60 / project.transport.bpm) * 0.25;
  const totalBeats = getPlaybackBeats(project);
  const totalPlaySeconds = totalBeats * stepSeconds;

  // Short tracks: one pass, no seams to manage.
  if (totalPlaySeconds <= CHUNK_THRESHOLD_SECONDS) {
    const buffer = await renderProjectOffline(project, { sampleRate, tailMode });
    options.onProgress?.(1);
    return buffer;
  }

  const preRollBeats = Math.ceil(PRE_ROLL_SECONDS / stepSeconds);
  const xfadeSamples = Math.max(1, Math.round(CROSSFADE_SECONDS * sampleRate));
  const numChunks = Math.ceil(totalBeats / CHUNK_STEPS);
  const totalSamples = Math.round(totalPlaySeconds * sampleRate) + Math.round(tailSeconds * sampleRate);
  const channels = [new Float32Array(totalSamples), new Float32Array(totalSamples)];

  for (let chunk = 0; chunk < numChunks; chunk += 1) {
    const bodyStartBeat = chunk * CHUNK_STEPS;
    const bodyEndBeat = Math.min(totalBeats, bodyStartBeat + CHUNK_STEPS);
    const isLast = bodyEndBeat >= totalBeats;
    const windowStartBeat = Math.max(0, bodyStartBeat - preRollBeats);

    const preRollSeconds = (bodyStartBeat - windowStartBeat) * stepSeconds;
    const bodySeconds = (bodyEndBeat - bodyStartBeat) * stepSeconds;
    const trailSeconds = isLast ? tailSeconds : CROSSFADE_SECONDS;
    const renderSeconds = preRollSeconds + bodySeconds + trailSeconds;

    const buffer = await renderProjectWindow(project, windowStartBeat, renderSeconds, sampleRate);

    const bodyStartSample = Math.round(preRollSeconds * sampleRate);
    const segmentSamples = Math.round((bodySeconds + trailSeconds) * sampleRate);
    const outOffset = Math.round(bodyStartBeat * stepSeconds * sampleRate);

    for (let ch = 0; ch < channels.length; ch += 1) {
      const source = buffer.getChannelData(buffer.numberOfChannels > ch ? ch : 0);
      const dest = channels[ch];
      for (let i = 0; i < segmentSamples; i += 1) {
        const srcIdx = bodyStartSample + i;
        const destIdx = outOffset + i;
        if (srcIdx >= source.length || destIdx >= dest.length) {
          break;
        }
        let gain = 1;
        // Fade in to crossfade with the previous chunk's fade-out tail.
        if (chunk > 0 && i < xfadeSamples) {
          gain *= Math.sin((Math.PI / 2) * (i / xfadeSamples));
        }
        // Fade out so the next chunk's fade-in completes an equal-power blend.
        if (!isLast && i >= segmentSamples - xfadeSamples) {
          gain *= Math.sin((Math.PI / 2) * ((segmentSamples - 1 - i) / xfadeSamples));
        }
        dest[destIdx] += source[srcIdx] * gain;
      }
    }

    options.onProgress?.((chunk + 1) / numChunks);
    // Yield so progress paints and the page stays responsive between chunks.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  }

  const output = new AudioBuffer({ length: totalSamples, numberOfChannels: channels.length, sampleRate });
  for (let ch = 0; ch < channels.length; ch += 1) {
    output.copyToChannel(channels[ch], ch);
  }
  return output;
};
