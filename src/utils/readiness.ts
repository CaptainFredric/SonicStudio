export interface ReadinessSlice {
  label: string;
  score: number;
  rationale: string;
}

export interface ReadinessAssessment {
  competitorScore: number;
  monetizationScore: number;
  overallScore: number;
  slices: ReadinessSlice[];
}

const READINESS_SLICES: ReadinessSlice[] = [
  {
    label: 'Composition core',
    score: 82,
    rationale: 'Clip arrangement, phrase automation, pattern transforms, and direct clip-level composing now work from song view in a much more complete solo-creator loop.',
  },
  {
    label: 'Sound design',
    score: 81,
    rationale: 'The rack now supports real slice regions, trigger modes, slice-local gain and reverse, and step-mapped sample behavior, so sample tracks are materially closer to usable instruments instead of trimmed audio placeholders.',
  },
  {
    label: 'Editing ergonomics',
    score: 91,
    rationale: 'The sequencer and arranger now expose lane scope filters, pinned lanes, group collapse, compact density, visible mute and solo controls, stronger timeline navigation, and starter scenes that cut down blank-session friction, so larger sessions stay easier to scan and focus survives across views.',
  },
  {
    label: 'Audio output',
    score: 72,
    rationale: 'WAV bounce, stem export, a real master output path, visible bounce progress, and now targeted bounce scopes for pattern, song, and selected clip range make the print workflow materially more usable, but offline rendering and more deliberate mastering quality are still missing.',
  },
  {
    label: 'Product finish',
    score: 73,
    rationale: 'Track management, pinned lane focus, grouped session organization, visible readiness, bounce feedback, targeted print ranges, and real starter scenes make the studio feel more deliberate on first use and during longer sessions, but trust cues, collaboration, and account-level product features are still early.',
  },
];

const weightedAverage = (scores: Array<{ score: number; weight: number }>) => {
  const totalWeight = scores.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedScore = scores.reduce((sum, entry) => sum + entry.score * entry.weight, 0);
  return Math.round(weightedScore / totalWeight);
};

export const getStudioReadinessAssessment = (): ReadinessAssessment => {
  const overallScore = weightedAverage([
    { score: READINESS_SLICES[0].score, weight: 3 },
    { score: READINESS_SLICES[1].score, weight: 2 },
    { score: READINESS_SLICES[2].score, weight: 2 },
    { score: READINESS_SLICES[3].score, weight: 2 },
    { score: READINESS_SLICES[4].score, weight: 1 },
  ]);

  const competitorScore = weightedAverage([
    { score: READINESS_SLICES[0].score, weight: 3 },
    { score: READINESS_SLICES[1].score, weight: 2 },
    { score: READINESS_SLICES[2].score, weight: 3 },
    { score: READINESS_SLICES[3].score, weight: 2 },
  ]);

  const monetizationScore = weightedAverage([
    { score: READINESS_SLICES[0].score, weight: 2 },
    { score: READINESS_SLICES[1].score, weight: 2 },
    { score: READINESS_SLICES[3].score, weight: 2 },
    { score: READINESS_SLICES[4].score, weight: 3 },
  ]) - 12;

  return {
    competitorScore,
    monetizationScore: Math.max(0, monetizationScore),
    overallScore,
    slices: READINESS_SLICES,
  };
};
