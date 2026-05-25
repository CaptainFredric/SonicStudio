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
} from '../project/schema';

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
}

const songLengthInSteps = (project: ReturnType<typeof createProjectFromTemplate>) => (
  project.arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  )
);

const computePreview = (templateId: SessionTemplateId): TemplatePreview => {
  const project = createProjectFromTemplate(templateId);
  const lengthSteps = songLengthInSteps(project);
  const bars = Math.max(1, Math.round(lengthSteps / project.transport.stepsPerPattern));

  return {
    bars,
    bpm: Math.round(project.transport.bpm),
    instruments: project.tracks.map((track) => ({
      color: track.color,
      name: track.name,
      type: track.type,
    })),
    trackCount: project.tracks.length,
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
