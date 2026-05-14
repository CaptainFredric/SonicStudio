import type { SongFormId, SongFormRole } from '../context/editor/songFormDefinitions';
import type { InstrumentType } from '../project/schema';
import { getFactoryLoopById, type LoopBrowserEntry } from './loopLibrary';

export interface SessionPlayerPatternDeckDefinition {
  description: string;
  label: string;
  loopIds: string[];
  patternIndex: number;
  role: SongFormRole;
}

export interface SessionPlayerPatternDeck extends Omit<SessionPlayerPatternDeckDefinition, 'loopIds'> {
  segments: LoopBrowserEntry[];
}

export interface SessionPlayerProfile {
  defaultFormId: SongFormId;
  description: string;
  focus: string;
  id: string;
  label: string;
  patternDecks: SessionPlayerPatternDeckDefinition[];
}

const resolveDeck = (deck: SessionPlayerPatternDeckDefinition): SessionPlayerPatternDeck => ({
  description: deck.description,
  label: deck.label,
  patternIndex: deck.patternIndex,
  role: deck.role,
  segments: deck.loopIds
    .map((loopId) => getFactoryLoopById(loopId))
    .filter((loop): loop is LoopBrowserEntry => loop !== null),
});

export const SESSION_PLAYER_PROFILES: SessionPlayerProfile[] = [
  {
    defaultFormId: 'full-arc',
    description: 'A locked synth-pop band that drops in clean drums, pulse bass, and a wide pad bed.',
    focus: 'Steady songwriting bed',
    id: 'neon-motorik',
    label: 'Neon Motorik',
    patternDecks: [
      {
        description: 'A light opener that keeps only the air and motion before the drums fully land.',
        label: 'Intro',
        loopIds: [
          'factory-loop-runway-hats',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 0,
        role: 'intro',
      },
      {
        description: 'The stable verse pocket with enough bass and hats to carry writing over the top.',
        label: 'Groove',
        loopIds: [
          'factory-loop-night-drive-kick',
          'factory-loop-backseat-snare',
          'factory-loop-runway-hats',
          'factory-loop-metro-pulse-bass',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 1,
        role: 'groove',
      },
      {
        description: 'A fuller chorus lift with denser hats and a melodic top line.',
        label: 'Lift',
        loopIds: [
          'factory-loop-night-drive-kick',
          'factory-loop-pocket-clap-snare',
          'factory-loop-sprint-grid-hats',
          'factory-loop-metro-pulse-bass',
          'factory-loop-metro-hook-lead',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 2,
        role: 'lift',
      },
      {
        description: 'A breakdown pattern that leaves air for transitions and smaller melodic answers.',
        label: 'Break',
        loopIds: [
          'factory-loop-sprint-grid-hats',
          'factory-loop-glass-bloom-pad',
          'factory-loop-metro-hook-lead',
        ],
        patternIndex: 3,
        role: 'break',
      },
    ],
  },
  {
    defaultFormId: 'full-arc',
    description: 'A slower, heavier backing player that leans into half-time drums and long low-end motion.',
    focus: 'Moody half-time support',
    id: 'after-hours',
    label: 'After Hours',
    patternDecks: [
      {
        description: 'Longer sustained motion for the opening section before the groove hardens.',
        label: 'Intro',
        loopIds: [
          'factory-loop-afterglow-bass',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 0,
        role: 'intro',
      },
      {
        description: 'A heavy verse pocket with half-time drums and a darker low end.',
        label: 'Groove',
        loopIds: [
          'factory-loop-low-slung-kick',
          'factory-loop-pocket-clap-snare',
          'factory-loop-sprint-grid-hats',
          'factory-loop-afterglow-bass',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 1,
        role: 'groove',
      },
      {
        description: 'A broader section with more motion and a lead layer for the hook.',
        label: 'Lift',
        loopIds: [
          'factory-loop-night-drive-kick',
          'factory-loop-pocket-clap-snare',
          'factory-loop-sprint-grid-hats',
          'factory-loop-afterglow-bass',
          'factory-loop-metro-hook-lead',
          'factory-loop-glass-bloom-pad',
        ],
        patternIndex: 2,
        role: 'lift',
      },
      {
        description: 'A leaner breakdown with melody and pad space left exposed.',
        label: 'Break',
        loopIds: [
          'factory-loop-glass-bloom-pad',
          'factory-loop-metro-hook-lead',
        ],
        patternIndex: 3,
        role: 'break',
      },
    ],
  },
  {
    defaultFormId: 'club-lift',
    description: 'A brighter performance bed with more top-end lift and a plucked harmony part ready for leads or vocals.',
    focus: 'Chorus lift and motion',
    id: 'starlight-band',
    label: 'Starlight Band',
    patternDecks: [
      {
        description: 'A bright opening with harmonic sparkle before the full rhythm lane arrives.',
        label: 'Intro',
        loopIds: [
          'factory-loop-glass-bloom-pad',
          'factory-loop-starlight-pluck',
        ],
        patternIndex: 0,
        role: 'intro',
      },
      {
        description: 'The central pocket with glossy hats and enough bass to support topline writing.',
        label: 'Groove',
        loopIds: [
          'factory-loop-night-drive-kick',
          'factory-loop-pocket-clap-snare',
          'factory-loop-runway-hats',
          'factory-loop-metro-pulse-bass',
          'factory-loop-starlight-pluck',
        ],
        patternIndex: 1,
        role: 'groove',
      },
      {
        description: 'The chorus deck with denser hats and a lead phrase layered over the pluck rhythm.',
        label: 'Lift',
        loopIds: [
          'factory-loop-night-drive-kick',
          'factory-loop-pocket-clap-snare',
          'factory-loop-sprint-grid-hats',
          'factory-loop-metro-pulse-bass',
          'factory-loop-metro-hook-lead',
          'factory-loop-starlight-pluck',
        ],
        patternIndex: 2,
        role: 'lift',
      },
      {
        description: 'A stripped breakdown with only enough rhythm to keep momentum before the return.',
        label: 'Break',
        loopIds: [
          'factory-loop-runway-hats',
          'factory-loop-glass-bloom-pad',
          'factory-loop-starlight-pluck',
        ],
        patternIndex: 3,
        role: 'break',
      },
    ],
  },
];

export const buildSessionPlayerPatternDecks = (profileId: string): SessionPlayerPatternDeck[] => {
  const profile = SESSION_PLAYER_PROFILES.find((entry) => entry.id === profileId);
  if (!profile) {
    return [];
  }

  return profile.patternDecks.map((deck) => resolveDeck(deck));
};

export const buildSessionPlayerSegments = (profileId: string): LoopBrowserEntry[] => {
  const decks = buildSessionPlayerPatternDecks(profileId);

  return decks.find((deck) => deck.role === 'groove')?.segments ?? decks[0]?.segments ?? [];
};

export const getSessionPlayerTrackTypes = (profileId: string): InstrumentType[] => {
  const uniqueTypes = new Set<InstrumentType>();

  buildSessionPlayerPatternDecks(profileId).forEach((deck) => {
    deck.segments.forEach((segment) => {
      uniqueTypes.add(segment.sourceTrackType);
    });
  });

  return [...uniqueTypes];
};