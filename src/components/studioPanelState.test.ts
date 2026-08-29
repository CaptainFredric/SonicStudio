import { describe, expect, it } from 'vitest';

import { resolveInitialStudioPanel, resolveNextStudioPanel } from './studioPanelState';

describe('studio panel state', () => {
  it('gives the Piano roll priority over the sound desk', () => {
    expect(resolveInitialStudioPanel({
      deskVisible: true,
      notesOpen: true,
    })).toBe('notes');
    expect(resolveInitialStudioPanel({
      deskVisible: true,
      notesOpen: false,
    })).toBe('desk');
  });

  it('opens a requested panel and closes it when selected again', () => {
    expect(resolveNextStudioPanel(null, 'notes')).toBe('notes');
    expect(resolveNextStudioPanel('desk', 'notes')).toBe('notes');
    expect(resolveNextStudioPanel('notes', 'notes')).toBeNull();
  });
});
