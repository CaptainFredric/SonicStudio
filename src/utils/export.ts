// Honest export helpers for the current SonicStudio project model.
// JSON snapshot export is implemented today, and recorder output can now be
// converted into WAV downloads for mix and stem export flows.

import {
  createArrangerClip,
  createProjectFromTemplate,
  createStepEvent,
  createTrack,
  type InstrumentType,
  type NoteEvent,
  type Project,
  type StudioSession,
  type Track,
} from '../project/schema';

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

interface MidiTrackEvent {
  channel: number;
  noteNumber: number;
  tick: number;
  trackName: string;
  type: 'note-off' | 'note-on';
  velocity: number;
}

interface ParsedMidiNote {
  channel: number;
  durationTicks: number;
  noteNumber: number;
  startTick: number;
  velocity: number;
}

interface ParsedMidiTrack {
  channelUsage: Set<number>;
  name: string;
  notes: ParsedMidiNote[];
}

interface ParsedMidiFile {
  bpm: number;
  ticksPerQuarter: number;
  tracks: ParsedMidiTrack[];
}

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
  peakDb: number;
  quality: 'clean' | 'hot' | 'quiet';
  recommendation?: string;
  rmsDb: number;
  sampleRate: number;
  targetDeltaDb?: number;
  targetLabel?: string;
  targetProfileId?: RenderTargetProfileId;
  targetVerdict?: TargetVerdict;
}

interface RenderTargetProfile {
  description: string;
  id: RenderTargetProfileId;
  label: string;
  peakTargetDb: number;
  rmsToleranceDb: number;
  targetRmsDb: number;
}

export const RENDER_TARGET_PROFILES: RenderTargetProfile[] = [
  {
    description: 'Quick reference prints with a bit more headroom while the arrangement is still moving.',
    id: 'draft',
    label: 'Draft',
    peakTargetDb: -1.5,
    rmsToleranceDb: 1.8,
    targetRmsDb: -18,
  },
  {
    description: 'Balanced print target for general streaming references and portfolio exports.',
    id: 'streaming',
    label: 'Streaming',
    peakTargetDb: -1,
    rmsToleranceDb: 1.5,
    targetRmsDb: -14,
  },
  {
    description: 'Hotter reference target for denser electronic mixes and club leaning drafts.',
    id: 'club',
    label: 'Club',
    peakTargetDb: -0.8,
    rmsToleranceDb: 1.5,
    targetRmsDb: -10.5,
  },
  {
    description: 'More dynamic reference target with cleaner crest for spacious or cinematic work.',
    id: 'open',
    label: 'Open Air',
    peakTargetDb: -1.2,
    rmsToleranceDb: 1.8,
    targetRmsDb: -16,
  },
];

const getRenderTargetProfile = (profileId?: RenderTargetProfileId) => (
  RENDER_TARGET_PROFILES.find((profile) => profile.id === profileId) ?? RENDER_TARGET_PROFILES[1]
);

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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIDI_PPQ = 96;
const STEP_TICKS = MIDI_PPQ / 4;
const MAX_IMPORT_STEPS = 512;

const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

const midiToNote = (midi: number): string => {
  const clamped = Math.max(24, Math.min(96, Math.round(midi)));
  const pitchClass = NOTE_NAMES[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${pitchClass}${octave}`;
};

const readUint16 = (bytes: Uint8Array, offset: number) => ((bytes[offset] << 8) | bytes[offset + 1]);
const readUint32 = (bytes: Uint8Array, offset: number) => (
  ((bytes[offset] << 24) >>> 0)
  | (bytes[offset + 1] << 16)
  | (bytes[offset + 2] << 8)
  | bytes[offset + 3]
);

const readVariableLength = (bytes: Uint8Array, offset: number): { length: number; value: number } => {
  let value = 0;
  let length = 0;

  while (offset + length < bytes.length) {
    const byte = bytes[offset + length];
    value = (value << 7) | (byte & 0x7f);
    length += 1;
    if ((byte & 0x80) === 0) {
      break;
    }
  }

  return { length, value };
};

const decodeLatinText = (bytes: Uint8Array) => String.fromCharCode(...bytes).replace(/\0/g, '').trim();

const parseMidiFile = (bytes: Uint8Array): ParsedMidiFile => {
  if (decodeLatinText(bytes.slice(0, 4)) !== 'MThd') {
    throw new Error('Invalid MIDI header.');
  }

  const headerLength = readUint32(bytes, 4);
  const format = readUint16(bytes, 8);
  const trackCount = readUint16(bytes, 10);
  const division = readUint16(bytes, 12);
  if (division & 0x8000) {
    throw new Error('SMPTE MIDI timing is not supported.');
  }

  let bpm = 120;
  let cursor = 8 + headerLength;
  const tracks: ParsedMidiTrack[] = [];

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (decodeLatinText(bytes.slice(cursor, cursor + 4)) !== 'MTrk') {
      break;
    }

    const trackLength = readUint32(bytes, cursor + 4);
    const trackEnd = cursor + 8 + trackLength;
    let position = cursor + 8;
    let absoluteTick = 0;
    let runningStatus = 0;
    let trackName = `Track ${trackIndex + 1}`;
    const notes: ParsedMidiNote[] = [];
    const openNotes = new Map<string, Array<{ startTick: number; velocity: number }>>();
    const channelUsage = new Set<number>();

    while (position < trackEnd) {
      const delta = readVariableLength(bytes, position);
      absoluteTick += delta.value;
      position += delta.length;

      let status = bytes[position];
      if (status < 0x80) {
        status = runningStatus;
      } else {
        position += 1;
        runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = bytes[position];
        position += 1;
        const metaLength = readVariableLength(bytes, position);
        position += metaLength.length;
        const metaData = bytes.slice(position, position + metaLength.value);
        position += metaLength.value;

        if (metaType === 0x03 && metaData.length > 0) {
          trackName = decodeLatinText(metaData) || trackName;
        }

        if (metaType === 0x51 && metaData.length === 3 && bpm === 120) {
          const microsecondsPerQuarter = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
          bpm = Math.max(40, Math.min(240, Math.round(60_000_000 / microsecondsPerQuarter)));
        }

        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const sysexLength = readVariableLength(bytes, position);
        position += sysexLength.length + sysexLength.value;
        continue;
      }

      const command = status & 0xf0;
      const channel = status & 0x0f;
      const firstData = bytes[position];
      const secondData = command === 0xc0 || command === 0xd0 ? 0 : bytes[position + 1];
      position += command === 0xc0 || command === 0xd0 ? 1 : 2;

      if (command === 0x90 || command === 0x80) {
        channelUsage.add(channel);
        const key = `${channel}:${firstData}`;
        const stack = openNotes.get(key) ?? [];

        if (command === 0x90 && secondData > 0) {
          stack.push({ startTick: absoluteTick, velocity: secondData / 127 });
          openNotes.set(key, stack);
        } else {
          const openNote = stack.pop();
          if (openNote) {
            notes.push({
              channel,
              durationTicks: Math.max(division / 8, absoluteTick - openNote.startTick),
              noteNumber: firstData,
              startTick: openNote.startTick,
              velocity: openNote.velocity,
            });
          }
          if (stack.length === 0) {
            openNotes.delete(key);
          } else {
            openNotes.set(key, stack);
          }
        }
      }
    }

    tracks.push({
      channelUsage,
      name: trackName,
      notes,
    });
    cursor = trackEnd;
  }

  if (format !== 0 && format !== 1) {
    throw new Error('Only MIDI format 0 and 1 are supported.');
  }

  return {
    bpm,
    ticksPerQuarter: division,
    tracks,
  };
};

const inferTrackType = (track: ParsedMidiTrack): InstrumentType => {
  const notes = track.notes;
  if (notes.length === 0) {
    return 'lead';
  }

  const usesDrumChannel = [...track.channelUsage].includes(9);
  if (usesDrumChannel) {
    const averageDrum = notes.reduce((sum, note) => sum + note.noteNumber, 0) / notes.length;
    if (averageDrum < 40) {
      return 'kick';
    }
    if (averageDrum < 55) {
      return 'snare';
    }
    if (averageDrum < 70) {
      return 'hihat';
    }
    return 'fx';
  }

  const averageNote = notes.reduce((sum, note) => sum + note.noteNumber, 0) / notes.length;
  const averageDuration = notes.reduce((sum, note) => sum + note.durationTicks, 0) / notes.length;
  const uniqueStarts = new Set(notes.map((note) => note.startTick)).size;
  const density = notes.length / Math.max(1, uniqueStarts);

  if (averageNote < 50) {
    return 'bass';
  }
  if (density > 1.6) {
    return 'pad';
  }
  if (averageDuration < 180) {
    return 'pluck';
  }
  return averageNote > 72 ? 'lead' : 'pad';
};

const buildSessionFromMidi = (
  parsed: ParsedMidiFile,
  fileName: string,
): StudioSession => {
  const baseSession = {
    ...createProjectFromTemplate('blank-grid'),
  };
  const stepTicks = Math.max(1, Math.round(parsed.ticksPerQuarter / 4));
  const allNotes = parsed.tracks.flatMap((track) => track.notes);
  const maxEndTick = allNotes.reduce(
    (maxTick, note) => Math.max(maxTick, note.startTick + note.durationTicks),
    stepTicks * 16,
  );
  const totalSteps = Math.min(MAX_IMPORT_STEPS, Math.max(16, Math.ceil(maxEndTick / stepTicks)));
  const stepsPerPattern = totalSteps <= 16 ? 16 : totalSteps <= 32 ? 32 : 64;
  const patternCount = Math.max(1, Math.min(8, Math.ceil(totalSteps / stepsPerPattern)));
  const mode = totalSteps > stepsPerPattern ? 'SONG' : 'PATTERN';
  const trackSources = parsed.tracks
    .filter((track) => track.notes.length > 0)
    .slice(0, 8);

  const tracks = trackSources.map((parsedTrack, index) => {
    const type = inferTrackType(parsedTrack);
    const track = createTrack(type, {
      name: parsedTrack.name.slice(0, 28) || `MIDI ${index + 1}`,
      patternCount,
      stepsPerPattern,
    });

    for (const note of parsedTrack.notes) {
      const absoluteStep = Math.floor(note.startTick / stepTicks);
      if (absoluteStep >= patternCount * stepsPerPattern) {
        continue;
      }

      const patternIndex = Math.floor(absoluteStep / stepsPerPattern);
      const stepIndex = absoluteStep % stepsPerPattern;
      const noteLabel = type === 'kick' || type === 'snare' || type === 'hihat' || type === 'fx'
        ? 'C1'
        : midiToNote(note.noteNumber);
      const gate = Math.max(0.25, Math.min(4, Number((note.durationTicks / stepTicks).toFixed(2))));
      const velocity = Math.max(0.1, Math.min(1, Number(note.velocity.toFixed(2))));

      track.patterns[patternIndex][stepIndex].push(createStepEvent(noteLabel, { gate, velocity }));
    }

    return track;
  });

  const arrangerClips = mode === 'SONG'
    ? tracks.flatMap((track) => (
        Array.from({ length: patternCount }, (_, patternIndex) => {
          const hasEvents = track.patterns[patternIndex]?.some((step) => step.length > 0);
          return hasEvents
            ? createArrangerClip(track.id, {
                bpm: parsed.bpm,
                countInBars: 0,
                currentPattern: 0,
                metronomeEnabled: false,
                mode,
                patternCount,
                stepsPerPattern,
              }, {
                beatLength: stepsPerPattern,
                patternIndex,
                startBeat: patternIndex * stepsPerPattern,
              })
            : null;
        }).filter((clip): clip is ReturnType<typeof createArrangerClip> => clip !== null)
      ))
    : tracks.map((track) => createArrangerClip(track.id, {
        bpm: parsed.bpm,
        countInBars: 0,
        currentPattern: 0,
        metronomeEnabled: false,
        mode,
        patternCount,
        stepsPerPattern,
      }, {
        beatLength: stepsPerPattern,
        patternIndex: 0,
        startBeat: 0,
      }));

  const projectName = fileName.replace(/\.mid[i]?$/i, '').trim() || 'Imported MIDI';
  const project: Project = {
    ...baseSession,
    arrangerClips,
    bounceHistory: [],
    markers: mode === 'SONG'
      ? Array.from({ length: patternCount }, (_, index) => ({
          beat: index * stepsPerPattern,
          id: `marker_${index}_${Date.now()}`,
          name: `Section ${index + 1}`,
        }))
      : [],
    metadata: {
      ...baseSession.metadata,
      name: projectName,
      updatedAt: new Date().toISOString(),
    },
    tracks: tracks.length > 0 ? tracks : baseSession.tracks,
    transport: {
      ...baseSession.transport,
      bpm: parsed.bpm,
      currentPattern: 0,
      mode,
      patternCount,
      stepsPerPattern,
    },
  };

  return {
    project,
    ui: {
      activeView: 'SEQUENCER',
      isSettingsOpen: false,
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      pinnedTrackIds: [],
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      selectedTrackId: project.tracks[0]?.id ?? null,
    },
  };
};

const encodeVariableLength = (value: number) => {
  let buffer = value & 0x7f;
  const bytes = [];

  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
      continue;
    }
    break;
  }

  return bytes;
};

const writeUint32 = (value: number) => ([
  (value >> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
]);

const writeUint16 = (value: number) => ([
  (value >> 8) & 0xff,
  value & 0xff,
]);

const writeTextMetaEvent = (metaType: number, text: string) => {
  const textBytes = Array.from(new TextEncoder().encode(text));
  return [0x00, 0xff, metaType, ...encodeVariableLength(textBytes.length), ...textBytes];
};

const collectPatternMidiEvents = (
  track: Track,
  patternIndex: number,
  startStep: number,
  stepLength: number,
): MidiTrackEvent[] => {
  const pattern = track.patterns[patternIndex] ?? [];
  const events: MidiTrackEvent[] = [];

  for (let stepOffset = 0; stepOffset < stepLength; stepOffset += 1) {
    const localStep = stepOffset % Math.max(1, pattern.length || stepLength);
    const stepEvents = pattern[localStep] ?? [];

    for (const noteEvent of stepEvents) {
      const noteNumber = noteToMidi(noteEvent.note);
      if (noteNumber === null) {
        continue;
      }

      const startTick = (startStep + stepOffset) * STEP_TICKS;
      const durationTicks = Math.max(1, Math.round(Math.max(0.125, noteEvent.gate) * STEP_TICKS));
      const velocity = Math.max(1, Math.min(127, Math.round(noteEvent.velocity * 127)));

      events.push({
        channel: 0,
        noteNumber,
        tick: startTick,
        trackName: track.name,
        type: 'note-on',
        velocity,
      });
      events.push({
        channel: 0,
        noteNumber,
        tick: startTick + durationTicks,
        trackName: track.name,
        type: 'note-off',
        velocity: 0,
      });
    }
  }

  return events;
};

const buildProjectMidiTracks = (project: Project) => {
  const trackGroups = project.tracks.map((track) => {
    if (project.transport.mode === 'PATTERN') {
      return {
        name: track.name,
        events: collectPatternMidiEvents(track, project.transport.currentPattern, 0, project.transport.stepsPerPattern),
      };
    }

    const clips = project.arrangerClips
      .filter((clip) => clip.trackId === track.id)
      .sort((left, right) => left.startBeat - right.startBeat);

    const events = clips.flatMap((clip) => (
      collectPatternMidiEvents(track, clip.patternIndex, clip.startBeat, clip.beatLength)
    ));

    return {
      name: track.name,
      events,
    };
  });

  return trackGroups
    .filter((group) => group.events.length > 0)
    .map((group, index) => ({
      ...group,
      channel: index % 16,
    }));
};

const encodeMidiTrack = (
  name: string,
  events: MidiTrackEvent[],
  channel: number,
) => {
  const sortedEvents = [...events].sort((left, right) => {
    if (left.tick !== right.tick) {
      return left.tick - right.tick;
    }

    if (left.type === right.type) {
      return left.noteNumber - right.noteNumber;
    }

    return left.type === 'note-off' ? -1 : 1;
  });

  const bytes = [
    ...writeTextMetaEvent(0x03, name),
  ];
  let lastTick = 0;

  for (const event of sortedEvents) {
    const delta = Math.max(0, event.tick - lastTick);
    bytes.push(...encodeVariableLength(delta));
    bytes.push(event.type === 'note-on' ? 0x90 | channel : 0x80 | channel, event.noteNumber, event.velocity);
    lastTick = event.tick;
  }

  bytes.push(0x00, 0xff, 0x2f, 0x00);

  return [
    0x4d, 0x54, 0x72, 0x6b,
    ...writeUint32(bytes.length),
    ...bytes,
  ];
};

const encodeProjectToMidi = (project: Project) => {
  const microsecondsPerQuarter = Math.round(60_000_000 / Math.max(40, Math.min(240, project.transport.bpm)));
  const midiTracks = buildProjectMidiTracks(project);
  const headerTrack = [
    ...writeTextMetaEvent(0x03, `${project.metadata.name} Tempo`),
    0x00, 0xff, 0x51, 0x03,
    (microsecondsPerQuarter >> 16) & 0xff,
    (microsecondsPerQuarter >> 8) & 0xff,
    microsecondsPerQuarter & 0xff,
    0x00, 0xff, 0x2f, 0x00,
  ];
  const headerChunk = [
    0x4d, 0x54, 0x72, 0x6b,
    ...writeUint32(headerTrack.length),
    ...headerTrack,
  ];
  const trackChunks = midiTracks.map((track) => encodeMidiTrack(track.name, track.events, track.channel));
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    ...writeUint16(1),
    ...writeUint16(trackChunks.length + 1),
    ...writeUint16(MIDI_PPQ),
  ];

  return new Uint8Array([
    ...header,
    ...headerChunk,
    ...trackChunks.flat(),
  ]);
};

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
  const targetProfile = normalization === 'target' ? getRenderTargetProfile(options.targetProfileId) : null;
  const targetLinear = targetProfile ? Math.pow(10, targetProfile.targetRmsDb / 20) : null;

  let peak = 0;
  let squareSum = 0;
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const sourceChannel = sourceBuffer.getChannelData(channelIndex);
    const destinationChannel = processedBuffer.getChannelData(channelIndex);
    destinationChannel.set(sourceChannel);

    for (let sampleIndex = 0; sampleIndex < sourceChannel.length; sampleIndex += 1) {
      const sample = sourceChannel[sampleIndex] ?? 0;
      peak = Math.max(peak, Math.abs(sample));
      if (normalization === 'target') {
        squareSum += sample * sample;
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

  if (normalization === 'target' && peak > 0 && targetLinear) {
    const totalSamples = Math.max(1, channelCount * sourceBuffer.length);
    const currentRms = Math.sqrt(squareSum / totalSamples);
    const rmsGain = currentRms > 0 ? targetLinear / currentRms : 1;
    const peakGain = peakTargetLinear / peak;
    const gain = Math.min(rmsGain, peakGain, 1.6);

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const destinationChannel = processedBuffer.getChannelData(channelIndex);
      for (let sampleIndex = 0; sampleIndex < destinationChannel.length; sampleIndex += 1) {
        destinationChannel[sampleIndex] *= gain;
      }
    }
  }

  return processedBuffer;
};

const analyzeAudioBuffer = (
  audioBuffer: AudioBuffer,
  options: WavConversionOptions = {},
): AudioRenderAnalysis => {
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
  const crestDb = peakDb - rmsDb;
  const quality = peakDb > -0.3
    ? 'hot'
    : rmsDb < -28
      ? 'quiet'
      : 'clean';

  const targetProfile = options.normalization === 'target' ? getRenderTargetProfile(options.targetProfileId) : null;
  let targetVerdict: TargetVerdict | undefined;
  let targetDeltaDb: number | undefined;
  let recommendation: string | undefined;

  if (targetProfile) {
    const rmsDelta = rmsDb - targetProfile.targetRmsDb;
    targetDeltaDb = Number(rmsDelta.toFixed(1));

    if (Math.abs(rmsDelta) <= targetProfile.rmsToleranceDb) {
      targetVerdict = crestDb < 6 ? 'flat' : crestDb > 18 ? 'spiky' : 'aligned';
    } else if (rmsDelta > 0) {
      targetVerdict = 'loud';
    } else {
      targetVerdict = 'soft';
    }

    recommendation = targetVerdict === 'aligned'
      ? 'Energy sits close to the selected print target.'
      : targetVerdict === 'loud'
        ? 'Back off master gain or glue if this print feels too pushed for its target.'
        : targetVerdict === 'soft'
          ? 'Push gain or density a bit harder if you want this print to land closer to its target.'
          : targetVerdict === 'flat'
            ? 'Energy is on target, but crest is low. Ease the compressor or transient handling if it feels smeared.'
            : 'Energy is on target, but crest is high. Tighten peaks if you want a more settled reference print.';
  }

  return {
    crestDb: Number(crestDb.toFixed(1)),
    durationSeconds: audioBuffer.duration,
    peakDb: Number(peakDb.toFixed(1)),
    quality,
    recommendation,
    rmsDb: Number(rmsDb.toFixed(1)),
    sampleRate: audioBuffer.sampleRate,
    targetDeltaDb,
    targetLabel: targetProfile?.label,
    targetProfileId: targetProfile?.id,
    targetVerdict,
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
      analysis: analyzeAudioBuffer(processed, options),
      wavBlob: encodeAudioBufferToWav(decoded, options),
    };
  } finally {
    await context.close();
  }
};

export const importMidiFile = async (file: File): Promise<StudioSession> => {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const parsed = parseMidiFile(buffer);
  return buildSessionFromMidi(parsed, file.name);
};

export const exportToMIDI = async (project: Project, _options: Partial<ExportOptions> = {}): Promise<ExportResult> => {
  const startTime = performance.now();
  const midiData = encodeProjectToMidi(project);
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const fileName = `${sanitizeExportFileName(project.metadata.name)}-${project.transport.mode === 'SONG' ? 'song' : 'pattern'}.mid`;
  downloadBlob(blob, fileName);
  const duration = performance.now() - startTime;

  return {
    success: true,
    format: 'midi',
    size: midiData.length,
    duration,
    checksum: generateChecksum(midiData),
    timestamp: new Date().toISOString(),
  };
};
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
  importMidiFile,
  batchExport,
  sanitizeExportFileName,
};

export default ExportUtils;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
