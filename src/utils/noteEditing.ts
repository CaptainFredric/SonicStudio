export const NOTE_GATE_MIN = 0.125;
export const NOTE_GATE_MAX = 8;
export const NOTE_GATE_FINE_STEP = 0.01;
export const NOTE_GATE_MEDIUM_STEP = 0.05;
export const NOTE_GATE_COARSE_STEP = 0.25;
export const NOTE_GATE_JUMP_STEP = 1;
export const NOTE_GATE_GRID_STEP = 0.125;
export const NOTE_GATE_PRESETS = [0.25, 0.5, 1, 2, 4, 8] as const;

export const clampNoteGate = (value: number) => (
  Math.max(NOTE_GATE_MIN, Math.min(NOTE_GATE_MAX, value))
);

export const snapNoteGate = (value: number, step: number) => (
  clampNoteGate(Math.round(value / step) * step)
);

// Build a stable, unique pitch window even when its center sits against the
// supported MIDI limits. Shifting the window prevents repeated top or bottom
// rows such as several C7 cells that all edit the same note.
export const buildMidiWindow = (
  center: number,
  radius: number,
  min = 24,
  max = 96,
): number[] => {
  const safeRadius = Math.max(0, Math.floor(radius));
  const span = Math.min(max - min, safeRadius * 2);
  const clampedCenter = Math.max(min, Math.min(max, Math.round(center)));
  const low = Math.max(min, Math.min(clampedCenter - safeRadius, max - span));
  const high = Math.min(max, low + span);
  return Array.from({ length: high - low + 1 }, (_, index) => high - index);
};
