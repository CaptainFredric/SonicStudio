export type StudioPanelId = 'desk' | 'notes' | 'arrangement';

export const resolveInitialStudioPanel = ({
  arrangementVisible,
  deskVisible,
  notesOpen,
}: {
  arrangementVisible: boolean;
  deskVisible: boolean;
  notesOpen: boolean;
}): StudioPanelId | null => {
  if (notesOpen) return 'notes';
  if (deskVisible) return 'desk';
  if (arrangementVisible) return 'arrangement';
  return null;
};

export const resolveNextStudioPanel = (
  current: StudioPanelId | null,
  requested: StudioPanelId,
): StudioPanelId | null => current === requested ? null : requested;
