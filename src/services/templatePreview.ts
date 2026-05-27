// Compact "at a glance" stats for the starter scene cards in Studio
// Settings. The actual project blueprint each template produces is
// already authored in schema.ts; this module just pulls a few summary
// numbers and the instrument lineup out so the picker can show them
// before the user commits to a load.
//
// All previews are computed once at module load — createProjectFromTemplate
// is pure, the inputs are static, and there are only ~10 templates, so
// caching the results keeps the panel render-cheap.

import {
  createProjectFromTemplate,
  SESSION_TEMPLATE_DEFINITIONS,
  type InstrumentType,
  type SessionTemplateId,
  type Track,
} from '../project/schema';

import type { CapturedNoteToken } from './noteStringLibrary';

export interface TemplateInstrumentBadge {
  color: string;
  name: string;
  type: InstrumentType;
}

export interface TemplatePreview {
  bars: number;
  bpm: number;
  instruments: TemplateInstrumentBadge[];
  trackCount: number;
  /** Type of the lane the audition will play through. */
  auditionType: InstrumentType | null;
  /** Notes to schedule when the user hovers / long-presses the card. */
  auditionTokens: CapturedNoteToken[];
}

const songLengthInSteps = (project: ReturnType<typeof createProjectFromTemplate>) => (
  project.arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  )
);

// Order matters: the audition picks the first matching lane so the
// most melodic / characterful voice plays. Drums are deprioritized.
const AUDITION_LANE_PREFERENCE: InstrumentType[] = [
  'violin', 'piano', 'lead', 'pluck', 'bell', 'pad', 'bass', 'fx', 'kick', 'snare', 'hihat',
];

export interface SessionAuditionTokens {
  type: InstrumentType | null;
  tokens: CapturedNoteToken[];
}

export const pickAuditionLane = (tracks: Track[]): Track | null => {
  for (const type of AUDITION_LANE_PREFERENCE) {
    const candidate = tracks.find((track) => (
      track.type === type
      && Object.values(track.patterns).some((pattern) => pattern.some((step) => step.length > 0))
    ));
    if (candidate) return candidate;
  }
  // Fall back to any track with content if no preferred type matches.
  return tracks.find((track) => (
    Object.values(track.patterns).some((pattern) => pattern.some((step) => step.length > 0))
  )) ?? null;
};

export const buildAuditionTokens = (track: Track | null, stepsPerPattern: number): CapturedNoteToken[] => {
  if (!track) return [];
  const tokens: CapturedNoteToken[] = [];
  const pattern = track.patterns[0] ?? [];
  // Limit to one bar's worth of steps and cap total notes so the
  // audition stays short even for long patterns.
  const limit = Math.min(stepsPerPattern, 16);
  let cursor = 0;
  while (cursor < limit && tokens.length < 8) {
    const step = pattern[cursor];
    if (step && step.length > 0) {
      // Take the highest-pitched event so the audition lands as the
      // lane's melody line, not a chord stack underneath it.
      const lead = [...step].sort((a, b) => a.note.localeCompare(b.note)).pop() ?? step[0];
      tokens.push({
        note: lead.note,
        gate: Math.max(1, Math.min(4, Math.round(lead.gate))),
        velocity: Math.max(0.4, Math.min(0.9, lead.velocity)),
      });
      cursor += Math.max(1, Math.round(lead.gate));
    } else {
      cursor += 1;
    }
  }
  return tokens;
};

const computePreview = (templateId: SessionTemplateId): TemplatePreview => {
  const project = createProjectFromTemplate(templateId);
  const lengthSteps = songLengthInSteps(project);
  const bars = Math.max(1, Math.round(lengthSteps / project.transport.stepsPerPattern));
  const auditionLane = pickAuditionLane(project.tracks);
  const auditionTokens = buildAuditionTokens(auditionLane, project.transport.stepsPerPattern);

  return {
    bars,
    bpm: Math.round(project.transport.bpm),
    instruments: project.tracks.map((track) => ({
      color: track.color,
      name: track.name,
      type: track.type,
    })),
    trackCount: project.tracks.length,
    auditionType: auditionLane?.type ?? null,
    auditionTokens,
  };
};

const PREVIEW_CACHE: Record<SessionTemplateId, TemplatePreview> = SESSION_TEMPLATE_DEFINITIONS
  .reduce((acc, template) => {
    acc[template.id] = computePreview(template.id);
    return acc;
  }, {} as Record<SessionTemplateId, TemplatePreview>);

/**
 * Get the cached preview for a template. Safe to call from render —
 * the work is already done at module load.
 */
export const getTemplatePreview = (templateId: SessionTemplateId): TemplatePreview => (
  PREVIEW_CACHE[templateId]
);

/**
 * Same audition-extraction routine the starter scenes use, but
 * generalised so any session (e.g. a saved scoresheet) can be
 * previewed without a template id.
 */
export const buildSessionAudition = (
  tracks: Track[],
  stepsPerPattern: number,
): SessionAuditionTokens => {
  const lane = pickAuditionLane(tracks);
  return {
    type: lane?.type ?? null,
    tokens: buildAuditionTokens(lane, stepsPerPattern),
  };
};
