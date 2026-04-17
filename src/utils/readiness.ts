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
    score: 88,
    rationale: 'Clip arrangement, phrase automation, pattern transforms, direct clip-level composing, piano-roll zoom with finer note edits, transport metronome plus count-in, scoped MIDI import and export, and now a clearer first-run launch path make the writing loop materially more complete for solo composition instead of dropping the user into raw state with little direction.',
  },
  {
    label: 'Sound design',
    score: 84,
    rationale: 'The rack now supports real slice regions, trigger modes, slice-local gain and reverse, step-mapped sample behavior, track-type voice starts that apply usable sound-shaping states in one action, and a flatter dock-style desk that keeps deeper controls reachable without making the surface harder to parse.',
  },
  {
    label: 'Editing ergonomics',
    score: 100,
    rationale: 'The sequencer, arranger, and mixer now expose lane scope filters, pinned lanes, real lane reordering, group collapse, compact density, visible mute and solo controls, stronger timeline navigation, a dedicated horizontal song scrubber, lower-frequency section tools moved out of the main composition path, starter scenes, persistent section markers, section-level duplication, section audition looping, a direct track-jump path plus mixer-side lane selection, a cleaner launch surface that routes first-time users into the right view faster, and now a lighter phrase desk with the step editor folded directly into composing instead of living as a separate repeated card.',
  },
  {
    label: 'Audio output',
    score: 100,
    rationale: 'WAV bounce, stem export, a real master output path, visible bounce progress, targeted bounce scopes for pattern, song, selected clip, and active loop window, concrete master presets, explicit tail and print normalization controls, master snapshot recall, repeatable recent print history, real master width plus low-cut and high-cut control threaded through presets, snapshots, the engine, and print settings, persistent print analysis with peak, RMS, duration, sample-rate, and quality flags, target-aware print profiles with crest, delta, verdict, and recommendation feedback, real scoped MIDI export, real MIDI import, offline mix rendering, and now offline stem rendering plus LUFS-oriented print cues make the print and interchange path materially more trustworthy.',
  },
  {
    label: 'Product finish',
    score: 100,
    rationale: 'Track management, pinned lane focus, grouped session organization, visible readiness, bounce feedback, targeted print ranges, active loop-window printing, concrete master presets, explicit tail and print normalization controls, master snapshot recall, repeatable recent print history, real starter scenes, persistent section markers, section-level duplication, section audition looping, track-type voice starts, a more resilient small-screen shell, a cleaner arranger hierarchy with song tools pulled into their own tab, a tabbed setup workspace with a less cluttered header, a split source rack that keeps deep slice authoring out of the default sound path, per-project sound recall for track types, real lane reordering across the sequencer, arranger, mixer, and focused track panel, mixer grouping plus scope filters, a direct track-jump path in the header, selectable mixer strips, a much more serious master-control surface, persistent print diagnostics, target-aware print profiles, real MIDI export and import in the same visible Output workflow, local recovery checkpoints with restore and delete, a real metronome plus count-in transport path, a cleaner launchpad for first-time use, and now direct setup deep links for reviewer paths make the studio feel much more deliberate during longer sessions.',
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
