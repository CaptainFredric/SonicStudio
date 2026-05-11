import React from 'react';
import {
  Activity,
  CircleDot,
  Cloud,
  Drum,
  Music2,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';

import type { InstrumentType } from '../project/schema';

export interface TrackPersonality {
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
  family: 'drum' | 'low' | 'voice' | 'air' | 'spark';
}

const PERSONALITIES: Record<InstrumentType, TrackPersonality> = {
  kick: {
    icon: CircleDot,
    blurb: 'Sits forward in the mix and locks the grid.',
    family: 'drum',
  },
  snare: {
    icon: Drum,
    blurb: 'Hits the backbeat. Usually on 2 and 4.',
    family: 'drum',
  },
  hihat: {
    icon: Activity,
    blurb: 'Drives the eighth or sixteenth notes on top.',
    family: 'drum',
  },
  bass: {
    icon: Waves,
    blurb: 'Anchors the harmony from the low end.',
    family: 'low',
  },
  lead: {
    icon: Music2,
    blurb: 'Carries the melody or hook.',
    family: 'voice',
  },
  pad: {
    icon: Cloud,
    blurb: 'Holds the chords underneath everything else.',
    family: 'air',
  },
  pluck: {
    icon: Sparkles,
    blurb: 'Short, bright notes for accents and counter-lines.',
    family: 'voice',
  },
  fx: {
    icon: Zap,
    blurb: 'Risers, sweeps, and transitions.',
    family: 'spark',
  },
};

const FALLBACK: TrackPersonality = PERSONALITIES.lead;

export const getTrackPersonality = (type: InstrumentType | string): TrackPersonality => (
  PERSONALITIES[type as InstrumentType] ?? FALLBACK
);

export const TrackIcon = ({
  type,
  className = 'h-4 w-4',
}: {
  type: InstrumentType | string;
  className?: string;
}) => {
  const Icon = getTrackPersonality(type).icon;
  return <Icon className={className} />;
};
