import type { EditorAction, EditorState } from '../editorTypes';
import { handleTrackClipPatternEventAction } from './trackClipPatternEventActions';
import { handleTrackClipPatternStepAction } from './trackClipPatternStepActions';

export const handleTrackClipPatternAction = (state: EditorState, action: EditorAction): EditorState | null => {
  return handleTrackClipPatternStepAction(state, action)
    ?? handleTrackClipPatternEventAction(state, action);
};
