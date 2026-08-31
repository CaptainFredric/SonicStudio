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
    patternCount: project.transport.patternCount,
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
    onManageSection: vi.fn(),
    onMoveSection: vi.fn(),
    onResizeSectionEnd: vi.fn(),
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

  it('keeps lane labels aligned when the timeline scrolls vertically', () => {
    const { container } = renderGrid();
    const scroller = container.querySelector('[data-song-timeline-scroll="true"]');
    const gutterList = container.querySelector('[data-song-track-gutter-list="true"]');
    if (!(scroller instanceof HTMLElement) || !(gutterList instanceof HTMLElement)) {
      throw new Error('Expected the song timeline and track gutter');
    }

    fireEvent.scroll(scroller, { target: { scrollTop: 72 } });

    expect(gutterList.style.transform).toBe('translateY(-72px)');
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

  it('uses a continuous bar ruler for navigation', () => {
    const { getByRole, props } = renderGrid({ songLengthInBeats: 48 });

    fireEvent.click(getByRole('button', { name: 'Jump to bar 2' }));

    expect(props.onSeek).toHaveBeenCalledWith(16);
    expect(getByRole('button', { name: 'Jump to bar 3' })).toBeTruthy();
  });

  it('labels the empty runway as an extension instead of another finished bar', () => {
    const { getByLabelText, queryByRole } = renderGrid();

    expect(getByLabelText('Add bar 2').textContent).toBe('Add bar 2');
    expect(queryByRole('button', { name: 'Jump to bar 2' })).toBeNull();
  });

  it('keeps legacy named section controls out of the song canvas', () => {
    const markers = [
      { beat: 0, id: 'marker_intro', name: 'Intro' },
      { beat: 16, id: 'marker_verse', name: 'Verse' },
      { beat: 32, id: 'marker_hook', name: 'Hook' },
    ];
    const { queryByRole } = renderGrid({ songLengthInBeats: 48, songMarkers: markers });

    expect(queryByRole('button', { name: 'Move Intro' })).toBeNull();
    expect(queryByRole('slider', { name: 'Resize the end of Intro' })).toBeNull();
  });

  it('keeps note cells editable while clip handles are available', () => {
    const { cell, project, props } = renderGrid({ clipEditing: true });
    const emptyStep = cell(project.tracks[0].id, 1);

    expect((emptyStep as HTMLButtonElement).disabled).toBe(false);
    expect(emptyStep.getAttribute('aria-hidden')).toBeNull();
    fireEvent.pointerDown(emptyStep, { button: 0 });
    expect(props.onToggleStep).toHaveBeenCalledWith(project.tracks[0].id, 0, 1);
  });

  it('moves a selected clip on the four-step grid from the keyboard', () => {
    const view = renderGrid({
      clipEditing: true,
      onMoveClip: vi.fn(),
      onSelectClip: vi.fn(),
    });
    const { getByRole, project, props } = view;
    const clip = project.arrangerClips[0];
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId)!;
    const clipButton = getByRole('button', {
      name: `Move Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    });

    fireEvent.focus(clipButton);
    fireEvent.keyDown(clipButton, { key: 'ArrowRight' });

    expect(props.onSelectClip).toHaveBeenCalledWith(clip.id);
    expect(props.onMoveClip).toHaveBeenCalledWith(clip.id, clip.trackId, clip.startBeat + 4);
  });

  it('drags a clip in time and onto another lane', () => {
    const view = renderGrid({
      clipEditing: true,
      onMoveClip: vi.fn(),
      onSelectClip: vi.fn(),
    });
    const { container, getByRole, project, props } = view;
    const clip = project.arrangerClips[0];
    const sourceTrack = project.tracks.find((candidate) => candidate.id === clip.trackId)!;
    const targetTrack = project.tracks[1];
    const scroller = container.querySelector('[data-song-timeline-scroll="true"]');
    if (!(scroller instanceof HTMLElement)) throw new Error('Expected the song timeline scroller');
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const clipButton = getByRole('button', {
      name: `Move Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${sourceTrack.name}`,
    });

    fireEvent.pointerDown(clipButton, { button: 0, clientX: 10, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 90, clientY: 90 });
    fireEvent.pointerUp(window);

    expect(props.onMoveClip).toHaveBeenCalledWith(clip.id, targetTrack.id, 4);
  });

  it('opens note editing when the clip handle is double-clicked', () => {
    const view = renderGrid({
      clipEditing: true,
      onEditClipNotes: vi.fn(),
    });
    const { getByRole, project, props } = view;
    const clip = project.arrangerClips[0];
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId)!;

    fireEvent.doubleClick(getByRole('button', {
      name: `Move Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    }));

    expect(props.onEditClipNotes).toHaveBeenCalledWith(clip.id);
  });

  it('offers direct note editing, independence, duplicate, split, and delete actions for a selected clip', () => {
    const onMakeClipUnique = vi.fn();
    const view = renderGrid({
      clipEditing: true,
      onDeleteClip: vi.fn(),
      onDuplicateClip: vi.fn(),
      onEditClipNotes: vi.fn(),
      onMakeClipUnique,
      onSplitClip: vi.fn(),
    });
    const { getByRole, project, props, rerender } = view;
    const clip = project.arrangerClips[0];
    const linkedClip = {
      ...clip,
      id: `${clip.id}_linked`,
      startBeat: clip.startBeat + clip.beatLength,
    };
    rerender(
      <SongTimelineGrid
        {...props}
        arrangerClips={[...project.arrangerClips, linkedClip]}
        selectedClipId={clip.id}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Edit notes in selected clip' }));
    fireEvent.click(getByRole('button', { name: 'Make selected clip independent' }));
    fireEvent.click(getByRole('button', { name: 'Duplicate selected clip' }));
    fireEvent.click(getByRole('button', { name: 'Split selected clip at the playhead' }));
    fireEvent.click(getByRole('button', { name: 'Delete selected clip' }));

    expect(props.onEditClipNotes).toHaveBeenCalledWith(clip.id);
    expect(onMakeClipUnique).toHaveBeenCalledWith(clip.id);
    expect(getByRole('status').textContent).toContain('clip is now independent');
    expect(props.onDuplicateClip).toHaveBeenCalledWith(clip.id);
    expect(props.onSplitClip).toHaveBeenCalledWith(clip.id, clip.startBeat + 8);
    expect(props.onDeleteClip).toHaveBeenCalledWith(clip.id);
  });

  it('keeps clip regions subtle so their notes remain visually dominant', () => {
    const view = renderGrid({ clipEditing: true });
    const { container, project, props, rerender } = view;
    const clip = project.arrangerClips[0];
    const region = container.querySelector(`[data-arranger-clip="${clip.id}"]`);
    if (!(region instanceof HTMLElement)) throw new Error('Expected a clip region');

    expect(region.style.background).toBe('transparent');
    rerender(<SongTimelineGrid {...props} selectedClipId={clip.id} />);
    expect(region.style.background).toMatch(/rgba\(.+, 0\.04\)/);
  });

  it('trims a selected clip with magnetic four-step snapping', () => {
    const view = renderGrid({
      clipEditing: true,
      onResizeClip: vi.fn(),
    });
    const { container, getByRole, project, props, rerender } = view;
    const clip = project.arrangerClips[0];
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId)!;
    rerender(<SongTimelineGrid {...props} selectedClipId={clip.id} />);
    const scroller = container.querySelector('[data-song-timeline-scroll="true"]');
    if (!(scroller instanceof HTMLElement)) throw new Error('Expected the song timeline scroller');
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = getByRole('slider', {
      name: `Trim the end of Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    });

    fireEvent.pointerDown(handle, { button: 0, clientX: 320 });
    fireEvent.pointerMove(window, { clientX: 150 });
    expect(container.querySelector('[data-resizing="true"]')).not.toBeNull();
    fireEvent.pointerUp(window);

    expect(props.onResizeClip).toHaveBeenCalledTimes(1);
    expect(props.onResizeClip).toHaveBeenCalledWith(clip.id, { beatLength: 8 });
  });

  it('trims the left edge without changing which notes play at the new start', () => {
    const view = renderGrid({
      clipEditing: true,
      onResizeClip: vi.fn(),
    });
    const { container, getByRole, project, props, rerender } = view;
    const clip = project.arrangerClips[0];
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId)!;
    rerender(<SongTimelineGrid {...props} selectedClipId={clip.id} />);
    const scroller = container.querySelector('[data-song-timeline-scroll="true"]');
    if (!(scroller instanceof HTMLElement)) throw new Error('Expected the song timeline scroller');
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = getByRole('slider', {
      name: `Trim the start of Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    });

    fireEvent.pointerDown(handle, { button: 0, clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 150 });
    expect(container.querySelector('[data-resizing="true"]')).not.toBeNull();
    fireEvent.pointerUp(window);

    expect(props.onResizeClip).toHaveBeenCalledWith(clip.id, {
      beatLength: 8,
      patternOffset: 8,
      startBeat: 8,
    });
  });

  it('resizes either clip edge from the keyboard in steps or full bars', () => {
    const view = renderGrid({
      clipEditing: true,
      onResizeClip: vi.fn(),
    });
    const { getByRole, project, props, rerender } = view;
    const clip = project.arrangerClips[0];
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId)!;
    rerender(<SongTimelineGrid {...props} selectedClipId={clip.id} />);
    const endHandle = getByRole('slider', {
      name: `Trim the end of Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    });
    const startHandle = getByRole('slider', {
      name: `Trim the start of Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`,
    });

    fireEvent.keyDown(endHandle, { key: 'ArrowLeft' });
    fireEvent.keyDown(endHandle, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(startHandle, { key: 'ArrowRight' });

    expect(props.onResizeClip).toHaveBeenNthCalledWith(1, clip.id, { beatLength: 15 });
    expect(props.onResizeClip).toHaveBeenNthCalledWith(2, clip.id, { beatLength: 32 });
    expect(props.onResizeClip).toHaveBeenNthCalledWith(3, clip.id, {
      beatLength: 15,
      patternOffset: 1,
      startBeat: 1,
    });
  });

});
