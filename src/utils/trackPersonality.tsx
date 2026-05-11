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
    blurb: 'Foundation thump — sits forward and locks the grid.',
    family: 'drum',
  },
  snare: {
    icon: Drum,
    blurb: 'Backbeat snap — defines the groove’s shoulders.',
    family: 'drum',
  },
  hihat: {
    icon: Activity,
    blurb: 'Top-end shimmer — moves the air between hits.',
    family: 'drum',
  },
  bass: {
    icon: Waves,
    blurb: 'Low-end engine — anchors the harmony and pulse.',
    family: 'low',
  },
  lead: {
    icon: Music2,
    blurb: 'The voice up front — phrasing, hook, and motion.',
    family: 'voice',
  },
  pad: {
    icon: Cloud,
    blurb: 'Sustained air — the cushion every other lane sits inside.',
    family: 'air',
  },
  pluck: {
    icon: Sparkles,
    blurb: 'Quick articulation — punctuates space without crowding it.',
    family: 'voice',
  },
  fx: {
    icon: Zap,
    blurb: 'Texture and lift — transitions, risers, ear-candy.',
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
