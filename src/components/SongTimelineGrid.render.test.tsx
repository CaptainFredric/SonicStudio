// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createProjectFromTemplate } from '../project/schema';
import { SongTimelineGrid } from './SongTimelineGrid';

// The grid only reads the engine's current step for the playhead poll.
vi.mock('../audio/ToneEngine', () => ({ engine: { currentStep: 0 } }));

beforeAll(() => {
  // jsdom has no ResizeObserver and reports clientWidth as 0; pin the viewport
  // to 800px so the step-window virtualization renders every Palm Hour cell.
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 800,
  });
});

afterEach(() => {
  // End any drag a test left open so state never leaks across tests.
  fireEvent.pointerUp(window);
  cleanup();
});

/** Render the grid with a real template project and spy callbacks. Midnight
 * Trap stays a single 16-step bar (kick on 0, 6, 10; snare on 8), which keeps
 * the cell math here simple. */
const renderGrid = (overrides: Partial<Parameters<typeof SongTimelineGrid>[0]> = {}) => {
  const project = createProjectFromTemplate('midnight-trap');
  const props = {
    tracks: project.tracks,
    arrangerClips: project.arrangerClips,
    stepsPerPattern: project.transport.stepsPerPattern,
    songLengthInBeats: 16,
    songMarkers: project.markers,
    selectedTrackId: project.tracks[0].id,
    superSonicMode: false,
    onSelectTrack: vi.fn(),
    onToggleStep: vi.fn(),
    onPlaceNote: vi.fn(),
    onAddSongNote: vi.fn(),
    onEraseStep: vi.fn(),
    onSeek: vi.fn(),
    onRenameSection: vi.fn(),
    onRemoveSection: vi.fn(),
    onReorderTrack: vi.fn(),
    onDeleteTrack: vi.fn(),
    ...overrides,
  };
  const view = render(<SongTimelineGrid {...props} />);
  const cell = (trackId: string, songStep: number) => {
    const found = view.container.querySelector(`[data-track-id="${trackId}"][data-song-step="${songStep}"]`);
    if (!(found instanceof HTMLElement)) {
      throw new Error(`Expected a cell for track ${trackId} step ${songStep}`);
    }
    return found;
  };
  return { ...view, cell, project, props };
};

describe('SongTimelineGrid', () => {
  it('renders a cell for every song step plus the trailing extend zone, per lane', () => {
    const { container, project } = renderGrid();
    const cells = container.querySelectorAll('[data-song-cell="true"]');
    // 16 song steps + two trailing bars (32 steps) across every lane.
    expect(cells.length).toBe(project.tracks.length * 48);
  });

  it('erases a filled cell on press without toggling it back on the click', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    const filled = cell(kick.id, 0);
    fireEvent.pointerDown(filled, { button: 0 });
    fireEvent.click(filled);
    expect(props.onEraseStep).toHaveBeenCalledTimes(1);
    expect(props.onEraseStep).toHaveBeenCalledWith(kick.id, 0, 0);
    expect(props.onToggleStep).not.toHaveBeenCalled();
  });

  it('paints an empty covered cell on press', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    fireEvent.pointerDown(cell(kick.id, 1), { button: 0 });
    expect(props.onToggleStep).toHaveBeenCalledWith(kick.id, 0, 1);
    expect(props.onAddSongNote).not.toHaveBeenCalled();
  });

  it('starts a clip when pressing the trailing zone past the song end', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    fireEvent.pointerDown(cell(kick.id, 20), { button: 0 });
    expect(props.onAddSongNote).toHaveBeenCalledWith(kick.id, 20);
    expect(props.onToggleStep).not.toHaveBeenCalled();
  });

  it('erase drag clears filled cells it crosses and skips the gaps', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    fireEvent.pointerDown(cell(kick.id, 0), { button: 0 });
    fireEvent.pointerOver(cell(kick.id, 1)); // empty gap: skipped
    fireEvent.pointerOver(cell(kick.id, 6)); // filled: erased
    expect(props.onEraseStep).toHaveBeenCalledTimes(2);
    expect(props.onEraseStep).toHaveBeenNthCalledWith(2, kick.id, 0, 6);
    expect(props.onToggleStep).not.toHaveBeenCalled();
  });

  it('paint drag fills empty cells it crosses and leaves existing notes alone', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    fireEvent.pointerDown(cell(kick.id, 1), { button: 0 });
    fireEvent.pointerOver(cell(kick.id, 2)); // empty: painted
    fireEvent.pointerOver(cell(kick.id, 6)); // filled: left alone
    expect(props.onToggleStep).toHaveBeenCalledTimes(2);
    expect(props.onToggleStep).toHaveBeenNthCalledWith(2, kick.id, 0, 2);
    expect(props.onEraseStep).not.toHaveBeenCalled();
  });

  it('keeps a drag on the lane it started in', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    const snare = project.tracks[1];
    fireEvent.pointerDown(cell(kick.id, 0), { button: 0 });
    fireEvent.pointerOver(cell(snare.id, 8)); // snare's backbeat: another lane, untouched
    expect(props.onEraseStep).toHaveBeenCalledTimes(1);
  });

  it('a released drag does not swallow the next plain click', () => {
    const { cell, project, props } = renderGrid();
    const kick = project.tracks[0];
    fireEvent.pointerDown(cell(kick.id, 0), { button: 0 });
    fireEvent.pointerUp(window); // drag ends off-cell, no click fires
    fireEvent.pointerDown(cell(kick.id, 6), { button: 0 });
    expect(props.onEraseStep).toHaveBeenCalledTimes(2);
  });
});
