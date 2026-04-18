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
