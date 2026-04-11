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
    score: 74,
    rationale: 'The rack is expressive, more focused, and now supports real sample window shaping, reusable slice memory, and pitched versus one-shot sample behavior, but it still lacks deeper slicing and stronger mixing tools.',
  },
  {
    label: 'Editing ergonomics',
    score: 79,
    rationale: 'The main edit loop is substantially better now because clip focus persists, phrase transforms are one action away, and composing from song view requires far less context switching.',
  },
  {
    label: 'Audio output',
    score: 52,
    rationale: 'WAV bounce and stem export are real, but offline rendering, stronger mastering flow, and broader export options are still missing.',
  },
  {
    label: 'Product finish',
    score: 53,
    rationale: 'Focus handling and song navigation read more clearly now, but onboarding, trust cues, collaboration, and account level product features are still early.',
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
