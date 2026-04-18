import type { EditorAction, EditorState } from '../editorTypes';
import { handleArrangerAction } from './arrangerActions';
import { handleHistoryAction } from './historyActions';
import { handleProjectAction } from './projectActions';
import { handleTrackAction } from './trackActions';
import { handleUiAction } from './uiActions';

const reducerHandlers = [
  handleUiAction,
  handleProjectAction,
  handleTrackAction,
  handleArrangerAction,
  handleHistoryAction,
] as const satisfies ReadonlyArray<(state: EditorState, action: EditorAction) => EditorState | null>;

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  for (const reducerHandler of reducerHandlers) {
    const nextState = reducerHandler(state, action);
    if (nextState !== null) {
      return nextState;
    }
  }

  return state;
};
