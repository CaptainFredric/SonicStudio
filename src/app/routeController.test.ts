import { describe, expect, it } from 'vitest';

import { createSessionFromTemplate } from '../project/storage';
import { applyStudioRouteToSession, resolveStudioRoute } from './routeController';

describe('routeController', () => {
  it('opens the launchpad on first run and preserves default workspace tab', () => {
    expect(resolveStudioRoute('', false)).toEqual({
      requestedTemplate: null,
      requestedSettingsTab: 'WORKSPACE',
      requestedView: null,
      showGuide: false,
      showLaunchpad: true,
      shouldOpenSettings: false,
    });
  });

  it('resolves deep-link setup and view directives explicitly', () => {
    expect(resolveStudioRoute('?setup=output&view=notes', true)).toEqual({
      requestedTemplate: null,
      requestedSettingsTab: 'OUTPUT',
      requestedView: 'PIANO_ROLL',
      showGuide: false,
      showLaunchpad: false,
      shouldOpenSettings: true,
    });
  });

  it('treats workspace setup as an explicit settings route', () => {
    expect(resolveStudioRoute('?setup=workspace&view=song', true)).toEqual({
      requestedTemplate: null,
      requestedSettingsTab: 'WORKSPACE',
      requestedView: 'ARRANGER',
      showGuide: false,
      showLaunchpad: false,
      shouldOpenSettings: true,
    });
  });

  it('treats demo links as explicit entry routes that load a starter session directly', () => {
    expect(resolveStudioRoute('?demo=night-transit&view=song', false)).toEqual({
      requestedTemplate: 'night-transit',
      requestedSettingsTab: 'WORKSPACE',
      requestedView: 'ARRANGER',
      showGuide: false,
      showLaunchpad: false,
      shouldOpenSettings: false,
    });
  });

  it('recognizes guide links without reopening the launchpad for explicit demos', () => {
    expect(resolveStudioRoute('?demo=night-transit&view=song&guide=1', false)).toEqual({
      requestedTemplate: 'night-transit',
      requestedSettingsTab: 'WORKSPACE',
      requestedView: 'ARRANGER',
      showGuide: true,
      showLaunchpad: false,
      shouldOpenSettings: false,
    });
  });

  it('recognizes additional starter-scene aliases', () => {
    expect(resolveStudioRoute('?demo=club&view=song', false)).toEqual({
      requestedTemplate: 'club-horizon',
      requestedSettingsTab: 'WORKSPACE',
      requestedView: 'ARRANGER',
      showGuide: false,
      showLaunchpad: false,
      shouldOpenSettings: false,
    });
  });

  it('lets explicit deep links bypass the default first-run launch surface', () => {
    expect(resolveStudioRoute('?setup=output&view=notes', false).showLaunchpad).toBe(false);
  });

  it('applies route directives to a session without disturbing selection state', () => {
    const session = createSessionFromTemplate('night-transit');

    const routed = applyStudioRouteToSession(session, {
      requestedTemplate: null,
      requestedSettingsTab: 'TRACK',
      requestedView: 'MIXER',
      showGuide: false,
      showLaunchpad: false,
      shouldOpenSettings: true,
    });

    expect(routed.ui.activeView).toBe('MIXER');
    expect(routed.ui.isSettingsOpen).toBe(true);
    expect(routed.ui.selectedTrackId).toBe(session.ui.selectedTrackId);
    expect(routed.ui.selectedArrangerClipId).toBe(session.ui.selectedArrangerClipId);
  });
});
