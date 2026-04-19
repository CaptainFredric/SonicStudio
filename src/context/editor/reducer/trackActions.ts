import type { EditorAction, EditorState } from '../editorTypes';
import { handleTrackPatternAction } from './trackPatternActions';
import { handleTrackSourceAction } from './trackSourceActions';
import { handleTrackStructureAction } from './trackStructureActions';

const trackHandlers = [
  handleTrackSourceAction,
  handleTrackPatternAction,
  handleTrackStructureAction,
] as const satisfies ReadonlyArray<(state: EditorState, action: EditorAction) => EditorState | null>;

export const handleTrackAction = (state: EditorState, action: EditorAction): EditorState | null => {
  for (const handler of trackHandlers) {
    const nextState = handler(state, action);
    if (nextState !== null) {
      return nextState;
    }
  }

  return null;
};
