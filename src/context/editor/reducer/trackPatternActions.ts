import type { EditorAction, EditorState } from '../editorTypes';
import { handleTrackAutomationAction } from './trackAutomationActions';
import { handleTrackClipPatternAction } from './trackClipPatternActions';
import { handleTrackNoteAction } from './trackNoteActions';
import { handleTrackTransformAction } from './trackTransformActions';

export const handleTrackPatternAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const handlers = [
    handleTrackNoteAction,
    handleTrackClipPatternAction,
    handleTrackAutomationAction,
    handleTrackTransformAction,
  ] as const satisfies ReadonlyArray<(candidateState: EditorState, candidateAction: EditorAction) => EditorState | null>;

  for (const handler of handlers) {
    const nextState = handler(state, action);
    if (nextState !== null) {
      return nextState;
    }
  }

  return null;
};
