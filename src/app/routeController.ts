import type { AppView, SessionTemplateId, StudioSession } from '../project/schema';

export type SettingsTab = 'WORKSPACE' | 'TRACK' | 'OUTPUT';

export interface StudioRouteState {
  requestedSettingsTab: SettingsTab;
  requestedTemplate: SessionTemplateId | null;
  requestedView: AppView | null;
  showGuide: boolean;
  showLaunchpad: boolean;
  shouldOpenSettings: boolean;
}

const SETTINGS_TABS: SettingsTab[] = ['WORKSPACE', 'TRACK', 'OUTPUT'];
const VIEW_ALIASES: Record<string, AppView> = {
  arrange: 'ARRANGER',
  arranger: 'ARRANGER',
  compose: 'COMPOSE',
  composer: 'COMPOSE',
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

const TEMPLATE_ALIASES: Record<string, SessionTemplateId> = {
  ambient: 'ambient-drift',
  'ambient-drift': 'ambient-drift',
  beat: 'beat-lab',
  'beat-lab': 'beat-lab',
  beatlab: 'beat-lab',
  blank: 'blank-grid',
  'blank-grid': 'blank-grid',
  blankgrid: 'blank-grid',
  club: 'club-horizon',
  'club-horizon': 'club-horizon',
  horizon: 'club-horizon',
  'lo-fi': 'lofi-sunday',
  lofi: 'lofi-sunday',
  'lofi-sunday': 'lofi-sunday',
  night: 'night-transit',
  'night-transit': 'night-transit',
  starlight: 'starlight-parade',
  'starlight-parade': 'starlight-parade',
  synthwave: 'synthwave-drive',
  'synthwave-drive': 'synthwave-drive',
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

const normalizeTemplate = (params: URLSearchParams): SessionTemplateId | null => {
  const rawValue = params.get('demo') ?? params.get('template');
  if (!rawValue) {
    return null;
  }

  return TEMPLATE_ALIASES[rawValue.toLowerCase()] ?? null;
};

export const resolveStudioRoute = (
  search: string,
  hasPersistedSession: boolean,
): StudioRouteState => {
  const params = new URLSearchParams(search);
  const rawSetup = params.get('setup');
  const requestedTemplate = normalizeTemplate(params);
  const requestedSettingsTab = normalizeSettingsTab(rawSetup);
  const requestedView = normalizeView(params.get('view'));
  const showGuide = params.get('guide') === '1' || params.get('guide') === 'true';
  const hasExplicitEntry = requestedTemplate !== null || requestedView !== null || isSettingsTab(rawSetup);

  return {
    requestedSettingsTab,
    requestedTemplate,
    requestedView,
    showGuide,
    showLaunchpad: params.get('launch') === '1' || (!hasPersistedSession && !hasExplicitEntry),
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
