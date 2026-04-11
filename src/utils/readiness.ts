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
    score: 75,
    rationale: 'Pattern editing, clip arrangement, phrase automation, and sample or synth sources are all present, with faster sequencing and clearer track focus.',
  },
  {
    label: 'Sound design',
    score: 67,
    rationale: 'The rack is expressive and now more focused, but it still lacks richer instrument depth, sample slicing, and stronger mixing tools.',
  },
  {
    label: 'Editing ergonomics',
    score: 70,
    rationale: 'The main edit loop is materially clearer now, especially in the sequencer, but advanced note editing, drag operations, and dense session navigation still trail mature DAWs.',
  },
  {
    label: 'Audio output',
    score: 52,
    rationale: 'WAV bounce and stem export are real, but offline rendering, stronger mastering flow, and broader export options are still missing.',
  },
  {
    label: 'Product finish',
    score: 50,
    rationale: 'The shell is more stable and easier to read, but onboarding, trust cues, collaboration, and account level product features are still early.',
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
