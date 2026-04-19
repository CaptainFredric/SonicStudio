import type { EditorAction, EditorState } from '../editorTypes';
import { handleTrackNoteEventAction } from './trackNoteEventActions';
import { handleTrackNotePatternAction } from './trackNotePatternActions';

export const handleTrackNoteAction = (state: EditorState, action: EditorAction): EditorState | null => {
  return handleTrackNoteEventAction(state, action)
    ?? handleTrackNotePatternAction(state, action);
};
