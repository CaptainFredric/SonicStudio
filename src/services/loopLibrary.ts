import {
  createEmptyPattern,
  type InstrumentType,
  type NoteEvent,
  type PatternAutomation,
} from '../project/schema';
import type { PatternSegment } from './patternSegments';

export interface LoopBrowserEntry extends PatternSegment {
  description: string;
  energy: string;
  genre: string;
  tags: string[];
}

type StepEventSpec = string | {
  gate?: number;
  note: string;
  velocity?: number;
};

const clampAutomationValue = (value: number) => Math.min(1, Math.max(0, value));

const normalizeStepEvent = (event: StepEventSpec): NoteEvent => {
  if (typeof event === 'string') {
    return {
      gate: 1,
      note: event,
      velocity: 0.78,
    };
  }

  return {
    gate: event.gate ?? 1,
    note: event.note,
    velocity: event.velocity ?? 0.78,
  };
};

const createSteps = (
  stepsPerPattern: number,
  eventsByStep: Partial<Record<number, StepEventSpec | StepEventSpec[]>>,
) => {
  const steps = createEmptyPattern(stepsPerPattern);

  Object.entries(eventsByStep).forEach(([stepIndex, stepEvents]) => {
    const index = Number(stepIndex);
    if (!Number.isInteger(index) || index < 0 || index >= stepsPerPattern || !stepEvents) {
      return;
    }

    const normalizedEvents = Array.isArray(stepEvents)
      ? stepEvents.map((event) => normalizeStepEvent(event))
      : [normalizeStepEvent(stepEvents)];

    steps[index] = normalizedEvents;
  });

  return steps;
};

const createAutomation = (
  stepsPerPattern: number,
  baseLevel = 0.5,
  baseTone = 0.5,
  levelAccents: number[] = [],
  toneAccents: number[] = [],
): PatternAutomation => ({
  level: Array.from({ length: stepsPerPattern }, (_, stepIndex) => clampAutomationValue(
    baseLevel + (levelAccents.includes(stepIndex) ? 0.2 : 0),
  )),
  tone: Array.from({ length: stepsPerPattern }, (_, stepIndex) => clampAutomationValue(
    baseTone + (toneAccents.includes(stepIndex) ? 0.16 : 0),
  )),
});

const createFactoryLoop = ({
  automation,
  description,
  energy,
  eventsByStep,
  genre,
  id,
  name,
  sourceTrackType,
  stepsPerPattern = 16,
  tags,
}: {
  automation: PatternAutomation;
  description: string;
  energy: string;
  eventsByStep: Partial<Record<number, StepEventSpec | StepEventSpec[]>>;
  genre: string;
  id: string;
  name: string;
  sourceTrackType: InstrumentType;
  stepsPerPattern?: number;
  tags: string[];
}): LoopBrowserEntry => ({
  automation,
  createdAt: 'factory',
  description,
  energy,
  genre,
  id,
  name,
  sourceTrackName: 'Factory loop browser',
  sourceTrackType,
  steps: createSteps(stepsPerPattern, eventsByStep),
  stepsPerPattern,
  tags,
});

export const FACTORY_LOOP_LIBRARY: LoopBrowserEntry[] = [
  createFactoryLoop({
    automation: createAutomation(16, 0.66, 0.44, [0, 4, 8, 12], [15]),
    description: 'Straight drive with a light pickup so the bar rolls forward instead of resetting flat.',
    energy: 'Steady',
    eventsByStep: {
      0: { note: 'C1', velocity: 0.98 },
      4: { note: 'C1', velocity: 0.94 },
      8: { note: 'C1', velocity: 0.98 },
      12: { note: 'C1', velocity: 0.95 },
      15: { gate: 0.55, note: 'C1', velocity: 0.58 },
    },
    genre: 'Synthwave',
    id: 'factory-loop-night-drive-kick',
    name: 'Night Drive Kick',
    sourceTrackType: 'kick',
    tags: ['foundation', 'four-on-floor', 'starter'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.64, 0.42, [0, 7, 10], [7, 14]),
    description: 'Half-time pocket with a couple of push notes for slower choruses and moody intros.',
    energy: 'Heavy',
    eventsByStep: {
      0: { note: 'C1', velocity: 0.96 },
      7: { gate: 0.6, note: 'C1', velocity: 0.56 },
      8: { note: 'C1', velocity: 0.88 },
      10: { gate: 0.72, note: 'C1', velocity: 0.66 },
      12: { note: 'C1', velocity: 0.84 },
    },
    genre: 'Alt-pop',
    id: 'factory-loop-low-slung-kick',
    name: 'Low Slung Kick',
    sourceTrackType: 'kick',
    tags: ['half-time', 'slow-burn', 'verse'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.54, 0.58, [4, 12], [12]),
    description: 'A clean backbeat with a quieter pre-hit to stop the groove from feeling too square.',
    energy: 'Pocket',
    eventsByStep: {
      4: { note: 'D1', velocity: 0.94 },
      11: { gate: 0.46, note: 'D1', velocity: 0.44 },
      12: { note: 'D1', velocity: 0.97 },
    },
    genre: 'Indie pop',
    id: 'factory-loop-backseat-snare',
    name: 'Backseat Snare',
    sourceTrackType: 'snare',
    tags: ['backbeat', 'glue', 'song'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.5, 0.62, [4, 12], [2, 10, 14]),
    description: 'Snare and clap blend with tiny grace taps for choruses that need more lift.',
    energy: 'Bright',
    eventsByStep: {
      2: { gate: 0.34, note: 'D1', velocity: 0.34 },
      4: { note: 'D1', velocity: 0.88 },
      10: { gate: 0.34, note: 'D1', velocity: 0.3 },
      12: { note: 'D1', velocity: 0.92 },
      14: { gate: 0.28, note: 'D1', velocity: 0.28 },
    },
    genre: 'Electro pop',
    id: 'factory-loop-pocket-clap-snare',
    name: 'Pocket Clap Snare',
    sourceTrackType: 'snare',
    tags: ['chorus', 'air', 'lift'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.42, 0.7, [2, 6, 10, 14], [1, 5, 9, 13]),
    description: 'Even eighths with brighter offbeats so the hat lane keeps motion without sounding frantic.',
    energy: 'Open',
    eventsByStep: {
      0: { gate: 0.4, note: 'F#1', velocity: 0.54 },
      2: { gate: 0.38, note: 'F#1', velocity: 0.68 },
      4: { gate: 0.4, note: 'F#1', velocity: 0.56 },
      6: { gate: 0.38, note: 'F#1', velocity: 0.72 },
      8: { gate: 0.4, note: 'F#1', velocity: 0.58 },
      10: { gate: 0.38, note: 'F#1', velocity: 0.7 },
      12: { gate: 0.4, note: 'F#1', velocity: 0.56 },
      14: { gate: 0.38, note: 'F#1', velocity: 0.76 },
    },
    genre: 'Disco pop',
    id: 'factory-loop-runway-hats',
    name: 'Runway Hats',
    sourceTrackType: 'hihat',
    tags: ['eighth-note', 'motion', 'gloss'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.38, 0.74, [3, 7, 11, 15], [7, 15]),
    description: 'Tighter sixteenth weave with light swings on the tail so verses keep a nervous pulse.',
    energy: 'Fast',
    eventsByStep: {
      0: { gate: 0.26, note: 'F#1', velocity: 0.42 },
      1: { gate: 0.24, note: 'F#1', velocity: 0.3 },
      3: { gate: 0.28, note: 'F#1', velocity: 0.56 },
      4: { gate: 0.26, note: 'F#1', velocity: 0.46 },
      5: { gate: 0.24, note: 'F#1', velocity: 0.32 },
      7: { gate: 0.28, note: 'F#1', velocity: 0.6 },
      8: { gate: 0.26, note: 'F#1', velocity: 0.48 },
      9: { gate: 0.24, note: 'F#1', velocity: 0.32 },
      11: { gate: 0.28, note: 'F#1', velocity: 0.58 },
      12: { gate: 0.26, note: 'F#1', velocity: 0.46 },
      13: { gate: 0.24, note: 'F#1', velocity: 0.34 },
      15: { gate: 0.28, note: 'F#1', velocity: 0.66 },
    },
    genre: 'House',
    id: 'factory-loop-sprint-grid-hats',
    name: 'Sprint Grid Hats',
    sourceTrackType: 'hihat',
    tags: ['sixteenth', 'propulsive', 'verse'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.62, 0.5, [0, 6, 8, 12], [6, 12]),
    description: 'Short sub notes that leave enough air for a vocal or lead while still feeling locked to the drums.',
    energy: 'Tight',
    eventsByStep: {
      0: { gate: 1.1, note: 'C2', velocity: 0.9 },
      3: { gate: 0.76, note: 'C2', velocity: 0.72 },
      6: { gate: 1.05, note: 'G1', velocity: 0.82 },
      8: { gate: 1.1, note: 'A#1', velocity: 0.88 },
      11: { gate: 0.74, note: 'A#1', velocity: 0.68 },
      12: { gate: 1.05, note: 'G1', velocity: 0.84 },
      15: { gate: 0.72, note: 'F1', velocity: 0.62 },
    },
    genre: 'Pop noir',
    id: 'factory-loop-metro-pulse-bass',
    name: 'Metro Pulse Bass',
    sourceTrackType: 'bass',
    tags: ['sub', 'locked', 'verse'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.58, 0.54, [0, 8, 14], [8, 14]),
    description: 'Longer held bass movement that turns two bars of harmony into something cinematic.',
    energy: 'Wide',
    eventsByStep: {
      0: { gate: 1.8, note: 'C2', velocity: 0.82 },
      4: { gate: 1.2, note: 'D#2', velocity: 0.64 },
      8: { gate: 1.6, note: 'G1', velocity: 0.86 },
      12: { gate: 1.2, note: 'A#1', velocity: 0.7 },
      14: { gate: 0.84, note: 'G1', velocity: 0.62 },
    },
    genre: 'Dream pop',
    id: 'factory-loop-afterglow-bass',
    name: 'Afterglow Bass',
    sourceTrackType: 'bass',
    tags: ['sustain', 'lift', 'cinematic'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.48, 0.68, [2, 6, 10], [6, 10]),
    description: 'Short melodic answer phrases that sit neatly over a vocal line instead of fighting it.',
    energy: 'Hooky',
    eventsByStep: {
      1: { gate: 0.84, note: 'G4', velocity: 0.72 },
      2: { gate: 0.68, note: 'A#4', velocity: 0.76 },
      4: { gate: 0.92, note: 'D5', velocity: 0.78 },
      6: { gate: 0.64, note: 'C5', velocity: 0.72 },
      8: { gate: 0.84, note: 'G4', velocity: 0.74 },
      10: { gate: 0.68, note: 'A#4', velocity: 0.76 },
      12: { gate: 1.04, note: 'F5', velocity: 0.82 },
    },
    genre: 'Synth pop',
    id: 'factory-loop-metro-hook-lead',
    name: 'Metro Hook Lead',
    sourceTrackType: 'lead',
    tags: ['hook', 'answer', 'topline'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.44, 0.6, [0, 8], [0, 8]),
    description: 'Two sustained voicings that fill the bar without crowding the drums or bass.',
    energy: 'Atmospheric',
    eventsByStep: {
      0: [
        { gate: 3.2, note: 'C4', velocity: 0.52 },
        { gate: 3.2, note: 'G4', velocity: 0.5 },
        { gate: 3.2, note: 'A#4', velocity: 0.48 },
      ],
      8: [
        { gate: 3.2, note: 'D#4', velocity: 0.5 },
        { gate: 3.2, note: 'G4', velocity: 0.48 },
        { gate: 3.2, note: 'A#4', velocity: 0.46 },
      ],
    },
    genre: 'Ambient pop',
    id: 'factory-loop-glass-bloom-pad',
    name: 'Glass Bloom Pad',
    sourceTrackType: 'pad',
    tags: ['bed', 'wide', 'harmonic'],
  }),
  createFactoryLoop({
    automation: createAutomation(16, 0.46, 0.56, [0, 8, 12], [4, 12]),
    description: 'Arpeggiated sparkle that reads like guitar-strummed harmony without needing a dedicated guitar lane.',
    energy: 'Bright',
    eventsByStep: {
      0: { gate: 0.44, note: 'C5', velocity: 0.58 },
      1: { gate: 0.42, note: 'G4', velocity: 0.54 },
      2: { gate: 0.44, note: 'A#4', velocity: 0.56 },
      4: { gate: 0.44, note: 'D5', velocity: 0.58 },
      5: { gate: 0.42, note: 'A#4', velocity: 0.54 },
      6: { gate: 0.44, note: 'G4', velocity: 0.56 },
      8: { gate: 0.44, note: 'F5', velocity: 0.6 },
      9: { gate: 0.42, note: 'D5', velocity: 0.56 },
      10: { gate: 0.44, note: 'A#4', velocity: 0.58 },
      12: { gate: 0.44, note: 'G5', velocity: 0.62 },
      13: { gate: 0.42, note: 'D5', velocity: 0.56 },
      14: { gate: 0.44, note: 'A#4', velocity: 0.58 },
    },
    genre: 'Nu-disco',
    id: 'factory-loop-starlight-pluck',
    name: 'Starlight Pluck',
    sourceTrackType: 'pluck',
    tags: ['arp', 'strum-like', 'sparkle'],
  }),
];

export const getFactoryLoopById = (loopId: string) => (
  FACTORY_LOOP_LIBRARY.find((loop) => loop.id === loopId) ?? null
);

export const getFactoryLoopsForTrackType = (trackType: InstrumentType) => (
  FACTORY_LOOP_LIBRARY.filter((loop) => loop.sourceTrackType === trackType)
);