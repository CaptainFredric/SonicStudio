import type { AppView, StudioSession } from '../project/schema';

export type SettingsTab = 'WORKSPACE' | 'TRACK' | 'OUTPUT';

export interface StudioRouteState {
  requestedSettingsTab: SettingsTab;
  requestedView: AppView | null;
  showLaunchpad: boolean;
  shouldOpenSettings: boolean;
}

const SETTINGS_TABS: SettingsTab[] = ['WORKSPACE', 'TRACK', 'OUTPUT'];
const VIEW_ALIASES: Record<string, AppView> = {
  arrange: 'ARRANGER',
  arranger: 'ARRANGER',
  grid: 'SEQUENCER',
  mix: 'MIXER',
  mixer: 'MIXER',
  notes: 'PIANO_ROLL',
  'piano-roll': 'PIANO_ROLL',
  roll: 'PIANO_ROLL',
  seq: 'SEQUENCER',
  sequencer: 'SEQUENCER',
  song: 'ARRANGER',
};

const normalizeSettingsTab = (value: string | null): SettingsTab => {
  const candidate = value?.toUpperCase();
  return SETTINGS_TABS.includes(candidate as SettingsTab) ? candidate as SettingsTab : 'WORKSPACE';
};

const isSettingsTab = (value: string | null): value is SettingsTab => (
  SETTINGS_TABS.includes((value?.toUpperCase() ?? '') as SettingsTab)
);

const normalizeView = (value: string | null): AppView | null => {
  if (!value) {
    return null;
  }

  return VIEW_ALIASES[value.toLowerCase()] ?? null;
};

export const resolveStudioRoute = (
  search: string,
  hasPersistedSession: boolean,
): StudioRouteState => {
  const params = new URLSearchParams(search);
  const rawSetup = params.get('setup');
  const requestedSettingsTab = normalizeSettingsTab(rawSetup);
  const requestedView = normalizeView(params.get('view'));

  return {
    requestedSettingsTab,
    requestedView,
    showLaunchpad: params.get('launch') === '1' || (!hasPersistedSession && !requestedView && !isSettingsTab(rawSetup)),
    shouldOpenSettings: isSettingsTab(rawSetup),
  };
};

export const applyStudioRouteToSession = (
  session: StudioSession,
  routeState: StudioRouteState | undefined,
): StudioSession => {
  if (!routeState) {
    return session;
  }

  return {
    ...session,
    ui: {
      ...session.ui,
      activeView: routeState.requestedView ?? session.ui.activeView,
      isSettingsOpen: routeState.shouldOpenSettings,
    },
  };
};
