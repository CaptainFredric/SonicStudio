export type MotionMode = 'fluid' | 'focus' | 'still';
export type AccentColor = 'aqua' | 'violet' | 'amber' | 'rose' | 'mint';
export type Density = 'comfortable' | 'compact';
export type DefaultWorkspace = 'compose' | 'arranger' | 'piano-roll' | 'mixer' | 'sequencer';
export type CaptureAnalysisProfile = 'quick' | 'balanced' | 'steady';
export type CaptureSuggestionCount = 1 | 2 | 3;
export type SuperSonicWaveIntensity = 'off' | 'faint' | 'flow';

export interface CapturePreferences {
  analysisProfile: CaptureAnalysisProfile;
  autoPreviewMatch: boolean;
  keepShelfBetweenTakes: boolean;
  liveSuggestionCount: CaptureSuggestionCount;
}

export interface SuperSonicPreferences {
  guidanceBadges: boolean;
  waveIntensity: SuperSonicWaveIntensity;
}

export interface StudioPreferences {
  motionMode: MotionMode;
  uiSoundsEnabled: boolean;
  accentColor: AccentColor;
  density: Density;
  defaultWorkspace: DefaultWorkspace;
  superSonicMode: boolean;
  capture: CapturePreferences;
  superSonic: SuperSonicPreferences;
}

const STUDIO_PREFERENCES_KEY = 'sonicstudio:preferences:v1';

export const DEFAULT_STUDIO_PREFERENCES: StudioPreferences = {
  motionMode: 'fluid',
  uiSoundsEnabled: true,
  accentColor: 'aqua',
  density: 'comfortable',
  defaultWorkspace: 'piano-roll',
  superSonicMode: false,
  capture: {
    analysisProfile: 'balanced',
    autoPreviewMatch: false,
    keepShelfBetweenTakes: true,
    liveSuggestionCount: 3,
  },
  superSonic: {
    guidanceBadges: true,
    waveIntensity: 'faint',
  },
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
    description: 'Default blue.',
    accent: '#72d9ff',
    accentStrong: '#dff6ff',
    accentMuted: 'rgba(114, 217, 255, 0.1)',
    chromeLine: 'rgba(114, 217, 255, 0.05)',
  },
  violet: {
    label: 'Violet',
    description: 'Purple.',
    accent: '#c5a8ff',
    accentStrong: '#ece1ff',
    accentMuted: 'rgba(197, 168, 255, 0.12)',
    chromeLine: 'rgba(197, 168, 255, 0.06)',
  },
  amber: {
    label: 'Amber',
    description: 'Warm yellow.',
    accent: '#f5c66c',
    accentStrong: '#fbeac1',
    accentMuted: 'rgba(245, 198, 108, 0.12)',
    chromeLine: 'rgba(245, 198, 108, 0.06)',
  },
  rose: {
    label: 'Rose',
    description: 'Coral pink.',
    accent: '#ffa1bb',
    accentStrong: '#ffd9e2',
    accentMuted: 'rgba(255, 161, 187, 0.12)',
    chromeLine: 'rgba(255, 161, 187, 0.06)',
  },
  mint: {
    label: 'Mint',
    description: 'Soft green.',
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

const isDefaultWorkspace = (value: unknown): value is DefaultWorkspace => (
  value === 'compose' || value === 'arranger' || value === 'piano-roll' || value === 'mixer' || value === 'sequencer'
);

const isCaptureAnalysisProfile = (value: unknown): value is CaptureAnalysisProfile => (
  value === 'quick' || value === 'balanced' || value === 'steady'
);

const isCaptureSuggestionCount = (value: unknown): value is CaptureSuggestionCount => (
  value === 1 || value === 2 || value === 3
);

const isSuperSonicWaveIntensity = (value: unknown): value is SuperSonicWaveIntensity => (
  value === 'off' || value === 'faint' || value === 'flow'
);

export const normalizeStudioPreferences = (value: unknown): StudioPreferences => {
  const candidate = isRecord(value) ? value : {};
  const captureCandidate = isRecord(candidate.capture) ? candidate.capture : {};
  const superSonicCandidate = isRecord(candidate.superSonic) ? candidate.superSonic : {};

  return {
    motionMode: candidate.motionMode === 'focus' || candidate.motionMode === 'still'
      ? candidate.motionMode
      : 'fluid',
    uiSoundsEnabled: typeof candidate.uiSoundsEnabled === 'boolean'
      ? candidate.uiSoundsEnabled
      : true,
    accentColor: isAccentColor(candidate.accentColor) ? candidate.accentColor : 'aqua',
    density: isDensity(candidate.density) ? candidate.density : 'comfortable',
    defaultWorkspace: isDefaultWorkspace(candidate.defaultWorkspace) ? candidate.defaultWorkspace : 'piano-roll',
    superSonicMode: typeof candidate.superSonicMode === 'boolean' ? candidate.superSonicMode : false,
    capture: {
      analysisProfile: isCaptureAnalysisProfile(captureCandidate.analysisProfile)
        ? captureCandidate.analysisProfile
        : DEFAULT_STUDIO_PREFERENCES.capture.analysisProfile,
      autoPreviewMatch: typeof captureCandidate.autoPreviewMatch === 'boolean'
        ? captureCandidate.autoPreviewMatch
        : DEFAULT_STUDIO_PREFERENCES.capture.autoPreviewMatch,
      keepShelfBetweenTakes: typeof captureCandidate.keepShelfBetweenTakes === 'boolean'
        ? captureCandidate.keepShelfBetweenTakes
        : DEFAULT_STUDIO_PREFERENCES.capture.keepShelfBetweenTakes,
      liveSuggestionCount: isCaptureSuggestionCount(captureCandidate.liveSuggestionCount)
        ? captureCandidate.liveSuggestionCount
        : DEFAULT_STUDIO_PREFERENCES.capture.liveSuggestionCount,
    },
    superSonic: {
      guidanceBadges: typeof superSonicCandidate.guidanceBadges === 'boolean'
        ? superSonicCandidate.guidanceBadges
        : DEFAULT_STUDIO_PREFERENCES.superSonic.guidanceBadges,
      waveIntensity: isSuperSonicWaveIntensity(superSonicCandidate.waveIntensity)
        ? superSonicCandidate.waveIntensity
        : DEFAULT_STUDIO_PREFERENCES.superSonic.waveIntensity,
    },
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
