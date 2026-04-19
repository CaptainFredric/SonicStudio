import { describe, expect, it } from 'vitest';

import { createSessionFromTemplate } from '../project/storage';
import { applyStudioRouteToSession, resolveStudioRoute } from './routeController';

describe('routeController', () => {
  it('opens the launchpad on first run and preserves default workspace tab', () => {
    expect(resolveStudioRoute('', false)).toEqual({
      requestedSettingsTab: 'WORKSPACE',
      requestedView: null,
      showLaunchpad: true,
      shouldOpenSettings: false,
    });
  });

  it('resolves deep-link setup and view directives explicitly', () => {
    expect(resolveStudioRoute('?setup=output&view=notes', true)).toEqual({
      requestedSettingsTab: 'OUTPUT',
      requestedView: 'PIANO_ROLL',
      showLaunchpad: false,
      shouldOpenSettings: true,
    });
  });

  it('treats workspace setup as an explicit settings route', () => {
    expect(resolveStudioRoute('?setup=workspace&view=song', true)).toEqual({
      requestedSettingsTab: 'WORKSPACE',
      requestedView: 'ARRANGER',
      showLaunchpad: false,
      shouldOpenSettings: true,
    });
  });

  it('lets explicit deep links bypass the default first-run launch surface', () => {
    expect(resolveStudioRoute('?setup=output&view=notes', false).showLaunchpad).toBe(false);
  });

  it('applies route directives to a session without disturbing selection state', () => {
    const session = createSessionFromTemplate('night-transit');

    const routed = applyStudioRouteToSession(session, {
      requestedSettingsTab: 'TRACK',
      requestedView: 'MIXER',
      showLaunchpad: false,
      shouldOpenSettings: true,
    });

    expect(routed.ui.activeView).toBe('MIXER');
    expect(routed.ui.isSettingsOpen).toBe(true);
    expect(routed.ui.selectedTrackId).toBe(session.ui.selectedTrackId);
    expect(routed.ui.selectedArrangerClipId).toBe(session.ui.selectedArrangerClipId);
  });
});
