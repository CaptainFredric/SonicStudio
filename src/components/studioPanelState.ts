export type StudioPanelId = 'desk' | 'notes';

export const resolveInitialStudioPanel = ({
  deskVisible,
  notesOpen,
}: {
  deskVisible: boolean;
  notesOpen: boolean;
}): StudioPanelId | null => {
  if (notesOpen) return 'notes';
  if (deskVisible) return 'desk';
  return null;
};

export const resolveNextStudioPanel = (
  current: StudioPanelId | null,
  requested: StudioPanelId,
): StudioPanelId | null => current === requested ? null : requested;
