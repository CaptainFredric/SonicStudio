export type MotionMode = 'fluid' | 'focus' | 'still';
export type AccentColor = 'aqua' | 'violet' | 'amber' | 'rose' | 'mint';
export type Density = 'comfortable' | 'compact';

export interface StudioPreferences {
  motionMode: MotionMode;
  uiSoundsEnabled: boolean;
  accentColor: AccentColor;
  density: Density;
}

const STUDIO_PREFERENCES_KEY = 'sonicstudio:preferences:v1';

export const DEFAULT_STUDIO_PREFERENCES: StudioPreferences = {
  motionMode: 'fluid',
  uiSoundsEnabled: true,
  accentColor: 'aqua',
  density: 'comfortable',
};

export interface AccentTokenSet {
  accent: string;
  accentStrong: string;
  accentMuted: string;
  chromeLine: string;
}

export const ACCENT_PRESETS: Record<AccentColor, AccentTokenSet & { label: string; description: string }> = {
  aqua: {
    label: 'Aqua',
    description: 'Cool neon blue — the SonicStudio default.',
    accent: '#72d9ff',
    accentStrong: '#dff6ff',
    accentMuted: 'rgba(114, 217, 255, 0.1)',
    chromeLine: 'rgba(114, 217, 255, 0.05)',
  },
  violet: {
    label: 'Violet',
    description: 'Late-night studio — purple with cool highlights.',
    accent: '#c5a8ff',
    accentStrong: '#ece1ff',
    accentMuted: 'rgba(197, 168, 255, 0.12)',
    chromeLine: 'rgba(197, 168, 255, 0.06)',
  },
  amber: {
    label: 'Amber',
    description: 'Warm desk lamp — golden tape-room glow.',
    accent: '#f5c66c',
    accentStrong: '#fbeac1',
    accentMuted: 'rgba(245, 198, 108, 0.12)',
    chromeLine: 'rgba(245, 198, 108, 0.06)',
  },
  rose: {
    label: 'Rose',
    description: 'Sunset synthwave — coral pink accent.',
    accent: '#ffa1bb',
    accentStrong: '#ffd9e2',
    accentMuted: 'rgba(255, 161, 187, 0.12)',
    chromeLine: 'rgba(255, 161, 187, 0.06)',
  },
  mint: {
    label: 'Mint',
    description: 'Clean room — soft green for long sessions.',
    accent: '#86efac',
    accentStrong: '#dcfce7',
    accentMuted: 'rgba(134, 239, 172, 0.12)',
    chromeLine: 'rgba(134, 239, 172, 0.06)',
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isAccentColor = (value: unknown): value is AccentColor => (
  value === 'aqua' || value === 'violet' || value === 'amber' || value === 'rose' || value === 'mint'
);

const isDensity = (value: unknown): value is Density => (
  value === 'comfortable' || value === 'compact'
);

export const normalizeStudioPreferences = (value: unknown): StudioPreferences => {
  const candidate = isRecord(value) ? value : {};

  return {
    motionMode: candidate.motionMode === 'focus' || candidate.motionMode === 'still'
      ? candidate.motionMode
      : 'fluid',
    uiSoundsEnabled: typeof candidate.uiSoundsEnabled === 'boolean'
      ? candidate.uiSoundsEnabled
      : true,
    accentColor: isAccentColor(candidate.accentColor) ? candidate.accentColor : 'aqua',
    density: isDensity(candidate.density) ? candidate.density : 'comfortable',
  };
};

export const loadStudioPreferences = (): StudioPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_STUDIO_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STUDIO_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_STUDIO_PREFERENCES;
    }

    return normalizeStudioPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_STUDIO_PREFERENCES;
  }
};

export const persistStudioPreferences = (preferences: StudioPreferences): StudioPreferences => {
  const normalized = normalizeStudioPreferences(preferences);

  if (typeof window === 'undefined') {
    return normalized;
  }

  try {
    window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
};
