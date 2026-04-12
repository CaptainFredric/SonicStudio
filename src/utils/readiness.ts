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
    score: 83,
    rationale: 'The rack now supports real slice regions, trigger modes, slice-local gain and reverse, step-mapped sample behavior, and now track-type voice starts that apply usable sound-shaping states in one action, so sample and synth tracks are materially closer to usable instruments instead of raw placeholders.',
  },
  {
    label: 'Editing ergonomics',
    score: 96,
    rationale: 'The sequencer and arranger now expose lane scope filters, pinned lanes, real lane reordering, group collapse, compact density, visible mute and solo controls, stronger timeline navigation, a dedicated horizontal song scrubber, lower-frequency section tools moved out of the main composition path, starter scenes, persistent section markers, section-level duplication, and section audition looping, so larger sessions stay easier to scan, restructure, and rehearse without losing focus.',
  },
  {
    label: 'Audio output',
    score: 80,
    rationale: 'WAV bounce, stem export, a real master output path, visible bounce progress, targeted bounce scopes for pattern, song, selected clip, and active loop window, concrete master presets, explicit tail and peak-safe print controls, master snapshot recall, and now repeatable recent print history make the print workflow materially more usable, but offline rendering and more deliberate mastering quality are still missing.',
  },
  {
    label: 'Product finish',
    score: 91,
    rationale: 'Track management, pinned lane focus, grouped session organization, visible readiness, bounce feedback, targeted print ranges, active loop-window printing, concrete master presets, explicit tail and peak-safe print controls, master snapshot recall, repeatable recent print history, real starter scenes, persistent section markers, section-level duplication, section audition looping, track-type voice starts, a more resilient small-screen shell, a cleaner arranger hierarchy with song tools pulled into their own tab, a tabbed setup workspace with a less cluttered header, a split source rack that keeps deep slice authoring out of the default sound path, per-project sound recall for track types, and now real lane reordering across the sequencer, arranger, mixer, and focused track panel make the studio feel more deliberate on first use and during longer sessions, but trust cues, collaboration, and account-level product features are still early.',
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
