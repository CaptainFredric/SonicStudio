// Honest export helpers for the current SonicStudio project model.
// JSON snapshot export is implemented today, and recorder output can now be
// converted into WAV downloads for mix and stem export flows.

import type { Project } from '../project/schema';

export interface ExportOptions {
  format: 'midi' | 'wav' | 'mp3' | 'json' | 'flac' | 'ogg';
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  bitDepth?: 16 | 24 | 32;
  sampleRate?: 44100 | 48000 | 96000;
  metadata?: Record<string, string>;
  includeMetronome?: boolean;
  normalization?: 'peak' | 'loudness' | 'none';
}

export interface ExportResult {
  success: boolean;
  format: string;
  size: number;
  duration: number;
  checksum: string;
  timestamp: string;
  message?: string;
  downloadUrl?: string;
}

export interface WavConversionOptions {
  normalization?: 'none' | 'peak';
  peakTargetDb?: number;
}

export interface AudioRenderAnalysis {
  durationSeconds: number;
  peakDb: number;
  quality: 'clean' | 'hot' | 'quiet';
  rmsDb: number;
  sampleRate: number;
}

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext ?? null;
};

const unsupportedExport = async (
  format: ExportOptions['format'],
): Promise<ExportResult> => ({
  success: false,
  format,
  size: 0,
  duration: 0,
  checksum: '',
  timestamp: new Date().toISOString(),
  message: `${format.toUpperCase()} export is not implemented yet. Use the live bounce action in Studio Setup for audio and JSON snapshot export for session data.`,
});

export async function exportToJSON(
  project: Project,
  options: Partial<ExportOptions> = {},
): Promise<ExportResult> {
  const startTime = performance.now();

  const exportData = {
    version: project.metadata.version,
    exportedAt: new Date().toISOString(),
    metadata: options.metadata || {},
    project: {
      id: project.metadata.id,
      name: project.metadata.name,
      createdAt: project.metadata.createdAt,
      updatedAt: project.metadata.updatedAt,
      transport: {
        bpm: project.transport.bpm,
        currentPattern: project.transport.currentPattern,
        mode: project.transport.mode,
        patternCount: project.transport.patternCount,
        stepsPerPattern: project.transport.stepsPerPattern,
      },
      arrangerClips: project.arrangerClips ?? [],
      tracks: project.tracks.map((track) => ({
        automation: track.automation,
        id: track.id,
        name: track.name,
        type: track.type,
        source: track.source,
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
        activeSteps: Object.values(track.patterns).reduce(
          (sum, pattern) => sum + pattern.filter((step) => step.length > 0).length,
          0,
        ),
        noteEvents: Object.values(track.patterns).reduce(
          (sum, pattern) => sum + pattern.reduce((patternSum, step) => patternSum + step.length, 0),
          0,
        ),
      })),
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const jsonData = new TextEncoder().encode(jsonString);
  const duration = performance.now() - startTime;

  return {
    success: true,
    format: 'json',
    size: jsonData.length,
    duration,
    checksum: generateChecksum(jsonData),
    timestamp: new Date().toISOString(),
  };
}

export const sanitizeExportFileName = (name: string) => (
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sonicstudio-export'
);

export const downloadBlob = (blob: Blob, fileName: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

const createProcessedAudioBuffer = (
  sourceBuffer: AudioBuffer,
  options: WavConversionOptions = {},
) => {
  const channelCount = sourceBuffer.numberOfChannels;
  const processedBuffer = new AudioBuffer({
    length: sourceBuffer.length,
    numberOfChannels: channelCount,
    sampleRate: sourceBuffer.sampleRate,
  });
  const normalization = options.normalization ?? 'none';
  const peakTargetDb = options.peakTargetDb ?? -1;
  const peakTargetLinear = Math.pow(10, peakTargetDb / 20);

  let peak = 0;
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const sourceChannel = sourceBuffer.getChannelData(channelIndex);
    const destinationChannel = processedBuffer.getChannelData(channelIndex);
    destinationChannel.set(sourceChannel);

    if (normalization === 'peak') {
      for (let sampleIndex = 0; sampleIndex < sourceChannel.length; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(sourceChannel[sampleIndex] ?? 0));
      }
    }
  }

  if (normalization === 'peak' && peak > 0) {
    const gain = Math.min(1, peakTargetLinear / peak);
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const destinationChannel = processedBuffer.getChannelData(channelIndex);
      for (let sampleIndex = 0; sampleIndex < destinationChannel.length; sampleIndex += 1) {
        destinationChannel[sampleIndex] *= gain;
      }
    }
  }

  return processedBuffer;
};

const analyzeAudioBuffer = (audioBuffer: AudioBuffer): AudioRenderAnalysis => {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;

  let peak = 0;
  let squareSum = 0;

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const samples = audioBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const sample = samples[sampleIndex] ?? 0;
      const absolute = Math.abs(sample);
      peak = Math.max(peak, absolute);
      squareSum += sample * sample;
    }
  }

  const totalSamples = Math.max(1, channelCount * sampleCount);
  const rms = Math.sqrt(squareSum / totalSamples);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -96;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -96;
  const quality = peakDb > -0.3
    ? 'hot'
    : rmsDb < -28
      ? 'quiet'
      : 'clean';

  return {
    durationSeconds: audioBuffer.duration,
    peakDb: Number(peakDb.toFixed(1)),
    quality,
    rmsDb: Number(rmsDb.toFixed(1)),
    sampleRate: audioBuffer.sampleRate,
  };
};

export const encodeAudioBufferToWav = (
  audioBuffer: AudioBuffer,
  options: WavConversionOptions = {},
): Blob => {
  const processedBuffer = createProcessedAudioBuffer(audioBuffer, options);
  const channelCount = processedBuffer.numberOfChannels;
  const sampleRate = processedBuffer.sampleRate;
  const sampleCount = processedBuffer.length;
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

  const channels = Array.from({ length: channelCount }, (_, channelIndex) => (
    processedBuffer.getChannelData(channelIndex)
  ));
  let offset = 44;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][sampleIndex] ?? 0));
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export const convertRecordingBlobToWav = async (
  recording: Blob,
  options: WavConversionOptions = {},
): Promise<Blob> => {
  const result = await convertRecordingBlobToWavWithAnalysis(recording, options);
  return result.wavBlob;
};

export const convertRecordingBlobToWavWithAnalysis = async (
  recording: Blob,
  options: WavConversionOptions = {},
): Promise<{ analysis: AudioRenderAnalysis; wavBlob: Blob }> => {
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    throw new Error('AudioContext is unavailable in this environment.');
  }

  const context = new AudioContextConstructor();

  try {
    const arrayBuffer = await recording.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const processed = createProcessedAudioBuffer(decoded, options);

    return {
      analysis: analyzeAudioBuffer(processed),
      wavBlob: encodeAudioBufferToWav(decoded, options),
    };
  } finally {
    await context.close();
  }
};

export const exportToMIDI = async (_project: Project, _options: Partial<ExportOptions> = {}) => unsupportedExport('midi');
export const exportToWAV = async (_project: Project, _options: Partial<ExportOptions> = {}) => unsupportedExport('wav');
export const exportToMP3 = async (_project: Project, _options: Partial<ExportOptions> = {}) => unsupportedExport('mp3');
export const exportToFLAC = async (_project: Project, _options: Partial<ExportOptions> = {}) => unsupportedExport('flac');
export const exportToOGG = async (_project: Project, _options: Partial<ExportOptions> = {}) => unsupportedExport('ogg');

export async function batchExport(
  project: Project,
  formats: ExportOptions['format'][],
): Promise<Record<string, ExportResult>> {
  const results: Record<string, ExportResult> = {};

  for (const format of formats) {
    const options: Partial<ExportOptions> = { format };

    switch (format) {
      case 'json':
        results[format] = await exportToJSON(project, options);
        break;
      case 'midi':
        results[format] = await exportToMIDI(project, options);
        break;
      case 'wav':
        results[format] = await exportToWAV(project, options);
        break;
      case 'mp3':
        results[format] = await exportToMP3(project, options);
        break;
      case 'flac':
        results[format] = await exportToFLAC(project, options);
        break;
      case 'ogg':
        results[format] = await exportToOGG(project, options);
        break;
    }
  }

  return results;
}

function generateChecksum(data: Uint8Array): string {
  let hash = 0;

  for (let i = 0; i < data.length; i += 1) {
    hash = ((hash << 5) - hash) + data[i];
    hash &= hash;
  }

  return Math.abs(hash).toString(16);
}

export const ExportUtils = {
  convertRecordingBlobToWav,
  convertRecordingBlobToWavWithAnalysis,
  downloadBlob,
  encodeAudioBufferToWav,
  exportToMIDI,
  exportToWAV,
  exportToMP3,
  exportToJSON,
  exportToFLAC,
  exportToOGG,
  batchExport,
  sanitizeExportFileName,
};

export default ExportUtils;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
