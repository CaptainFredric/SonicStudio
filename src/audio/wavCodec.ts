// Pure, worker-safe audio codec: peak/target normalization, loudness analysis,
// and 16-bit WAV byte encoding over raw PCM channel data. There are no DOM or
// Web Audio dependencies here, so the same logic runs on the main thread or
// inside a Web Worker. The AudioBuffer-based helpers in utils/export.ts adapt
// to these functions, and the render worker imports them directly to keep big
// exports (millions of samples) off the main thread.

export interface WavConversionOptions {
  normalization?: 'none' | 'peak' | 'target';
  peakTargetDb?: number;
  targetProfileId?: RenderTargetProfileId;
}

export type RenderTargetProfileId = 'draft' | 'streaming' | 'club' | 'open';
export type TargetVerdict = 'aligned' | 'loud' | 'soft' | 'flat' | 'spiky';

export interface AudioRenderAnalysis {
  crestDb: number;
  durationSeconds: number;
  estimatedLufs: number;
  peakDb: number;
  quality: 'clean' | 'hot' | 'quiet' | 'silent';
  recommendation?: string;
  rmsDb: number;
  sampleRate: number;
  targetLufs?: number;
  targetLufsDelta?: number;
  targetDeltaDb?: number;
  targetLabel?: string;
  targetProfileId?: RenderTargetProfileId;
  targetVerdict?: TargetVerdict;
}

interface RenderTargetProfile {
  crestRangeDb: [number, number];
  description: string;
  id: RenderTargetProfileId;
  label: string;
  targetLufs: number;
  peakTargetDb: number;
  rmsToleranceDb: number;
  lufsTolerance: number;
}

export const RENDER_TARGET_PROFILES: RenderTargetProfile[] = [
  {
    crestRangeDb: [8, 16],
    description: 'Quick reference prints with a bit more headroom while the arrangement is still moving.',
    id: 'draft',
    label: 'Draft',
    peakTargetDb: -1.5,
    lufsTolerance: 1.6,
    rmsToleranceDb: 1.8,
    targetLufs: -18,
  },
  {
    crestRangeDb: [7, 14],
    description: 'Balanced print target for general streaming references and portfolio exports.',
    id: 'streaming',
    label: 'Streaming',
    peakTargetDb: -1,
    lufsTolerance: 1.3,
    rmsToleranceDb: 1.5,
    targetLufs: -14,
  },
  {
    crestRangeDb: [5, 11],
    description: 'Hotter reference target for denser electronic mixes and club leaning drafts.',
    id: 'club',
    label: 'Club',
    peakTargetDb: -0.8,
    lufsTolerance: 1.2,
    rmsToleranceDb: 1.5,
    targetLufs: -10.5,
  },
  {
    crestRangeDb: [10, 18],
    description: 'More dynamic reference target with cleaner crest for spacious or cinematic work.',
    id: 'open',
    label: 'Open Air',
    peakTargetDb: -1.2,
    lufsTolerance: 1.5,
    rmsToleranceDb: 1.8,
    targetLufs: -16,
  },
];

export const getRenderTargetProfile = (profileId?: RenderTargetProfileId) => (
  RENDER_TARGET_PROFILES.find((profile) => profile.id === profileId) ?? RENDER_TARGET_PROFILES[1]
);

// Raw interleavable PCM payload: one Float32Array per channel plus rate/length.
// Channel buffers are transferable, which is what lets the render worker take
// ownership of the samples without a copy.
export interface PcmAudio {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
}

const estimateIntegratedLufs = (pcm: PcmAudio): number => {
  const { sampleRate, length } = pcm;
  const channelCount = pcm.channels.length;
  const blockSize = Math.max(1, Math.round(sampleRate * 0.4));
  const hopSize = Math.max(1, Math.round(sampleRate * 0.1));
  const blockEnergies: number[] = [];

  for (let blockStart = 0; blockStart < length; blockStart += hopSize) {
    const blockEnd = Math.min(length, blockStart + blockSize);
    if (blockEnd <= blockStart) {
      continue;
    }

    let squareSum = 0;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = pcm.channels[channelIndex];
      for (let sampleIndex = blockStart; sampleIndex < blockEnd; sampleIndex += 1) {
        const sample = channel[sampleIndex] ?? 0;
        squareSum += sample * sample;
      }
    }

    const meanSquare = squareSum / (Math.max(1, blockEnd - blockStart) * Math.max(1, channelCount));
    if (meanSquare > 0) {
      blockEnergies.push(meanSquare);
    }
  }

  if (blockEnergies.length === 0) {
    return -96;
  }

  const toLufs = (meanSquare: number) => -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-12));
  const absoluteGated = blockEnergies.filter((energy) => toLufs(energy) > -70);
  if (absoluteGated.length === 0) {
    return -96;
  }

  const ungatedMean = absoluteGated.reduce((sum, energy) => sum + energy, 0) / absoluteGated.length;
  const relativeGate = toLufs(ungatedMean) - 10;
  const relativeGated = absoluteGated.filter((energy) => toLufs(energy) > relativeGate);
  const pool = relativeGated.length > 0 ? relativeGated : absoluteGated;
  const integratedMean = pool.reduce((sum, energy) => sum + energy, 0) / Math.max(1, pool.length);

  return toLufs(integratedMean);
};

// Applies peak or target-loudness normalization, returning fresh channel data
// only when a gain is actually applied (so 'none' and unity-gain stay zero-copy).
export const normalizePcm = (pcm: PcmAudio, options: WavConversionOptions = {}): PcmAudio => {
  const channelCount = pcm.channels.length;
  const normalization = options.normalization ?? 'none';
  const peakTargetDb = options.peakTargetDb ?? -1;
  const peakTargetLinear = Math.pow(10, peakTargetDb / 20);
  const targetProfile = normalization === 'target' ? getRenderTargetProfile(options.targetProfileId) : null;
  const targetLinear = targetProfile ? Math.pow(10, targetProfile.targetLufs / 20) : null;

  let peak = 0;
  let squareSum = 0;
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channel = pcm.channels[channelIndex];
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      const sample = channel[sampleIndex] ?? 0;
      const absolute = Math.abs(sample);
      if (absolute > peak) {
        peak = absolute;
      }
      if (normalization === 'target') {
        squareSum += sample * sample;
      }
    }
  }

  let gain = 1;
  if (normalization === 'peak' && peak > 0) {
    gain = Math.min(1, peakTargetLinear / peak);
  } else if (normalization === 'target' && peak > 0 && targetLinear) {
    const totalSamples = Math.max(1, channelCount * pcm.length);
    const currentRms = Math.sqrt(squareSum / totalSamples);
    const rmsGain = currentRms > 0 ? targetLinear / currentRms : 1;
    const peakGain = peakTargetLinear / peak;
    gain = Math.min(rmsGain, peakGain, 1.6);
  }

  if (gain === 1) {
    return pcm;
  }

  const channels = pcm.channels.map((channel) => {
    const scaled = new Float32Array(channel.length);
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      scaled[sampleIndex] = (channel[sampleIndex] ?? 0) * gain;
    }
    return scaled;
  });

  return { channels, sampleRate: pcm.sampleRate, length: pcm.length };
};

export const analyzePcm = (
  pcm: PcmAudio,
  options: WavConversionOptions = {},
): AudioRenderAnalysis => {
  const channelCount = pcm.channels.length;
  const sampleCount = pcm.length;

  let peak = 0;
  let squareSum = 0;
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const samples = pcm.channels[channelIndex];
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const sample = samples[sampleIndex] ?? 0;
      const absolute = Math.abs(sample);
      if (absolute > peak) {
        peak = absolute;
      }
      squareSum += sample * sample;
    }
  }

  const totalSamples = Math.max(1, channelCount * sampleCount);
  const rms = Math.sqrt(squareSum / totalSamples);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -96;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -96;
  const crestDb = peakDb - rmsDb;
  const estimatedLufs = estimateIntegratedLufs(pcm);
  // An effectively silent render almost always means a broken export, not an
  // artistic choice, so flag it distinctly instead of mislabelling it "quiet".
  const quality = peakDb <= -90
    ? 'silent'
    : peakDb > -0.3
      ? 'hot'
      : rmsDb < -28
        ? 'quiet'
        : 'clean';

  const targetProfile = options.normalization === 'target' ? getRenderTargetProfile(options.targetProfileId) : null;
  let targetVerdict: TargetVerdict | undefined;
  let targetDeltaDb: number | undefined;
  let targetLufsDelta: number | undefined;
  let recommendation: string | undefined;

  if (targetProfile) {
    const rmsDelta = rmsDb - targetProfile.targetLufs;
    const lufsDelta = estimatedLufs - targetProfile.targetLufs;
    const [crestFloor, crestCeiling] = targetProfile.crestRangeDb;
    targetDeltaDb = Number(rmsDelta.toFixed(1));
    targetLufsDelta = Number(lufsDelta.toFixed(1));

    if (Math.abs(lufsDelta) <= targetProfile.lufsTolerance) {
      targetVerdict = crestDb < crestFloor ? 'flat' : crestDb > crestCeiling ? 'spiky' : 'aligned';
    } else if (lufsDelta > 0) {
      targetVerdict = 'loud';
    } else {
      targetVerdict = 'soft';
    }

    recommendation = targetVerdict === 'aligned'
      ? 'Estimated loudness sits close to the selected print target.'
      : targetVerdict === 'loud'
        ? 'Estimated loudness is running hot. Back off output gain, glue, or limiter pressure.'
        : targetVerdict === 'soft'
          ? 'Estimated loudness is light for this target. Push gain or density harder if you want a stronger reference print.'
          : targetVerdict === 'flat'
            ? `Loudness is on target, but crest is below the ${targetProfile.label.toLowerCase()} window. Ease compression or transient shaving if the print feels smeared.`
            : `Loudness is on target, but crest is above the ${targetProfile.label.toLowerCase()} window. Tighten peaks if you want a more settled reference print.`;
  }

  return {
    crestDb: Number(crestDb.toFixed(1)),
    durationSeconds: sampleCount / Math.max(1, pcm.sampleRate),
    estimatedLufs: Number(estimatedLufs.toFixed(1)),
    peakDb: Number(peakDb.toFixed(1)),
    quality,
    recommendation,
    rmsDb: Number(rmsDb.toFixed(1)),
    sampleRate: pcm.sampleRate,
    targetLufs: targetProfile?.targetLufs,
    targetLufsDelta,
    targetDeltaDb,
    targetLabel: targetProfile?.label,
    targetProfileId: targetProfile?.id,
    targetVerdict,
  };
};

const writeAscii = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

// Encodes already-normalized PCM to a 16-bit little-endian WAV byte buffer.
export const encodePcmToWavBytes = (pcm: PcmAudio): ArrayBuffer => {
  const channelCount = Math.max(1, pcm.channels.length);
  const { sampleRate } = pcm;
  const sampleCount = pcm.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = pcm.channels;
  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex]?.[sampleIndex] ?? 0));
      const pcmValue = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(pcmValue), true);
      offset += bytesPerSample;
    }
  }

  return buffer;
};

// One-shot: normalize once, then analyze and encode the normalized signal.
// This is what both the worker and the main-thread fallback call, and it avoids
// the double normalization pass the old AudioBuffer path performed.
export const processPcmToWav = (
  pcm: PcmAudio,
  options: WavConversionOptions = {},
): { analysis: AudioRenderAnalysis; wav: ArrayBuffer } => {
  const processed = normalizePcm(pcm, options);
  return {
    analysis: analyzePcm(processed, options),
    wav: encodePcmToWavBytes(processed),
  };
};
