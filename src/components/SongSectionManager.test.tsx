// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SongSectionManagerContent, type SongSectionManagerContentProps } from './SongSectionManager';

afterEach(cleanup);

const createProps = (): SongSectionManagerContentProps => ({
  currentPatternCount: 4,
  currentStep: 16,
  loopRangeEndBeat: null,
  loopRangeStartBeat: null,
  onClearSection: vi.fn(),
  onCreateMarker: vi.fn(),
  onDeleteSavedSection: vi.fn(),
  onDeleteSection: vi.fn(),
  onDuplicateSection: vi.fn(),
  onInsertBlankSection: vi.fn(),
  onInsertSavedSection: vi.fn(),
  onJumpToSection: vi.fn(),
  onMoveMarker: vi.fn(),
  onRemoveMarker: vi.fn(),
  onRenameMarker: vi.fn(),
  onRenameSavedSection: vi.fn(),
  onSaveSection: vi.fn(),
  onSetLoopRange: vi.fn(),
  savedSections: [],
  sectionRanges: [
    { clipCount: 3, endBeat: 16, id: 'intro', label: 'Intro', startBeat: 0 },
    { clipCount: 5, endBeat: 32, id: 'hook', label: 'Hook', startBeat: 16 },
  ],
  songLengthInBeats: 32,
});

describe('SongSectionManagerContent', () => {
  it('makes clear, unmark, and delete-time removal separate actions', () => {
    const props = createProps();
    render(<SongSectionManagerContent {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove options for Hook' }));
    fireEvent.click(screen.getByRole('button', { name: /delete time/i }));

    expect(props.onDeleteSection).toHaveBeenCalledWith(16, 32);
    expect(props.onClearSection).not.toHaveBeenCalled();
    expect(props.onRemoveMarker).not.toHaveBeenCalled();
  });

  it('saves a frozen section and can move its boundary without moving music', () => {
    const props = createProps();
    render(<SongSectionManagerContent {...props} />);

    const hookCard = screen.getByLabelText('Rename Hook').closest('article');
    expect(hookCard).not.toBeNull();
    fireEvent.click(within(hookCard as HTMLElement).getByRole('button', { name: 'Save' }));
    const boundary = screen.getByRole('spinbutton', { name: 'Start step for Hook' });
    fireEvent.change(boundary, { target: { value: '13' } });
    fireEvent.blur(boundary);

    expect(props.onSaveSection).toHaveBeenCalledWith(16, 32, 'Hook');
    expect(props.onMoveMarker).toHaveBeenCalledWith('hook', 12);
  });

  it('inserts a named blank section as real song time', () => {
    const props = createProps();
    render(<SongSectionManagerContent {...props} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'New section name' }), { target: { value: 'Bridge' } });
    fireEvent.click(screen.getByRole('button', { name: /2 bars/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to end/i }));

    expect(props.onInsertBlankSection).toHaveBeenCalledWith(32, 32, 'Bridge');
  });
});
