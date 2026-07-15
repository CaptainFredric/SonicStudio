import { describe, expect, it } from 'vitest';

import { resolveInitialStudioPanel, resolveNextStudioPanel } from './studioPanelState';

describe('studio panel state', () => {
  it('restores only one panel when legacy visibility flags overlap', () => {
    expect(resolveInitialStudioPanel({
      arrangementVisible: true,
      deskVisible: true,
      notesOpen: true,
    })).toBe('notes');
    expect(resolveInitialStudioPanel({
      arrangementVisible: true,
      deskVisible: true,
      notesOpen: false,
    })).toBe('desk');
  });

  it('opens a requested panel and closes it when selected again', () => {
    expect(resolveNextStudioPanel(null, 'arrangement')).toBe('arrangement');
    expect(resolveNextStudioPanel('desk', 'arrangement')).toBe('arrangement');
    expect(resolveNextStudioPanel('arrangement', 'arrangement')).toBeNull();
  });
});
