import { describe, expect, it, vi } from 'vitest';

import { APP_VIEW_ORDER, type AppView, type Project } from '../../project/schema';
import type { EditorAction } from './editorTypes';
import { createKeyboardShortcutHandler } from './keyboardShortcuts';

const makeHandler = () => {
  const dispatch = vi.fn<(action: EditorAction) => void>();
  const handler = createKeyboardShortcutHandler({
    dispatch,
    isSettingsOpen: false,
    project: {} as Project,
    saveProject: vi.fn(),
    setSuperSonicMode: vi.fn(),
    superSonicMode: false,
    togglePlay: vi.fn().mockResolvedValue(undefined),
    toggleRecording: vi.fn().mockResolvedValue(undefined),
  });
  return { handler, dispatch };
};

// Build a minimal keydown-like event with just the fields the handler reads,
// so the test does not depend on a DOM environment.
const altDigit = (digit: number): KeyboardEvent => ({
  code: `Digit${digit}`,
  key: String(digit),
  altKey: true,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  target: null,
  preventDefault: () => {},
}) as unknown as KeyboardEvent;

const viewsFrom = (dispatch: ReturnType<typeof makeHandler>['dispatch']): AppView[] => (
  dispatch.mock.calls
    .map(([action]) => action)
    .filter((action): action is Extract<EditorAction, { type: 'SET_ACTIVE_VIEW' }> => action.type === 'SET_ACTIVE_VIEW')
    .map((action) => action.view)
);

describe('Alt+digit view shortcuts', () => {
  it('follows the on-screen tab order for Alt+1 through Alt+4', async () => {
    const { handler, dispatch } = makeHandler();
    for (let digit = 1; digit <= 4; digit += 1) {
      await handler(altDigit(digit));
    }
    expect(viewsFrom(dispatch)).toEqual([...APP_VIEW_ORDER]);
  });

  it('lands Alt+2 on the Piano Roll, the second visible tab', async () => {
    const { handler, dispatch } = makeHandler();
    await handler(altDigit(2));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_VIEW', view: 'PIANO_ROLL' });
  });

  it('keeps a canonical order that covers every view exactly once', () => {
    const everyView: AppView[] = ['SEQUENCER', 'PIANO_ROLL', 'MIXER', 'ARRANGER'];
    expect([...APP_VIEW_ORDER].sort()).toEqual([...everyView].sort());
    expect(APP_VIEW_ORDER[0]).toBe('SEQUENCER');
  });
});
