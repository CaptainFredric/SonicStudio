import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, CopyPlus, GripVertical, MoreHorizontal, Music2, Trash2 } from 'lucide-react';
import type React from 'react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import { SUPERSONIC_NOTE_OFFSETS, getTrackAnchorNote, pitchRank, shiftPitch } from '../utils/notePlacement';
import { snapSectionLength } from '../utils/sectionResizeSnapping';
import { TrackIcon } from '../utils/trackPersonality';
import { MAX_ARRANGER_BEAT_POSITION, MIN_ARRANGEMENT_STEPS, type ArrangementClip, type SongMarker, type Track } from '../project/schema';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const RULER_HEIGHT = 36;
const GUTTER_WIDTH = 156;
const MIN_SECTION_STEPS = 4;

const OVERSCAN = 8;

interface SectionMoveGesture {
  end: number;
  moved: boolean;
  name: string;
  originClientX: number;
  sectionId: string;
  start: number;
  targetBeat: number;
}

interface ClipMoveGesture {
  clipId: string;
  moved: boolean;
  originClientX: number;
  originClientY: number;
  pointerBeatOffset: number;
  previewStartBeat: number;
  previewTrackId: string;
  sourceStartBeat: number;
  sourceTrackId: string;
}

interface SongTimelineGridProps {
  tracks: Track[];
  arrangerClips: ArrangementClip[];
  stepsPerPattern: number;
  songLengthInBeats: number;
  songMarkers: SongMarker[];
  cellWidth?: number;
  compactLanes?: boolean;
  clipEditing?: boolean;
  selectedClipId?: string | null;
  selectedTrackId: string | null;
  superSonicMode?: boolean;
  onSelectTrack: (trackId: string) => void;
  onToggleStep: (trackId: string, patternIndex: number, localStep: number) => void;
  onPlaceNote?: (trackId: string, patternIndex: number, localStep: number, note: string) => void;
  onAddSongNote?: (trackId: string, songStep: number, note?: string) => void;
  onEraseStep?: (trackId: string, patternIndex: number, localStep: number) => void;
  onSeek?: (beat: number) => void;
  onRenameSection?: (markerId: string, name: string) => void;
  onManageSection?: (markerId: string) => void;
  onMoveSection?: (sectionId: string, startBeat: number, endBeat: number, targetBeat: number) => void;
  onResizeSectionEnd?: (sectionId: string, startBeat: number, currentEndBeat: number, nextEndBeat: number) => void;
  onReorderTrack?: (trackId: string, toIndex: number) => void;
  onDeleteTrack?: (trackId: string) => void;
  onSelectClip?: (clipId: string) => void;
  onMoveClip?: (clipId: string, trackId: string, startBeat: number) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
}

// A flattened, scrollable view of the whole arrangement: one lane per track with
// a cell for every step of the song, so every note that plays is visible (not
// just the current 16-step pattern). Editing lands on the pattern the
// arrangement loops there. The section ruler is editable and lanes can be
// dragged to reorder. In SuperSonic mode the cells grow and an empty cell shows
// the pitch ladder on hover, so you can drop a specific pitch straight from the
// whole-song view (the same placement the per-pattern grid offers). Cells are
// virtualized to a window so a long song stays smooth.
export const SongTimelineGrid = ({
  tracks,
  arrangerClips,
  stepsPerPattern,
  songLengthInBeats,
  songMarkers,
  cellWidth,
  compactLanes = false,
  clipEditing = false,
  selectedClipId,
  selectedTrackId,
  superSonicMode = false,
  onSelectTrack,
  onToggleStep,
  onPlaceNote,
  onAddSongNote,
  onEraseStep,
  onSeek,
  onRenameSection,
  onManageSection,
  onMoveSection,
  onResizeSectionEnd,
  onReorderTrack,
  onDeleteTrack,
  onSelectClip,
  onMoveClip,
  onDuplicateClip,
  onDeleteClip,
}: SongTimelineGridProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [availableHeight, setAvailableHeight] = useState(0);
  // Whether the view auto-scrolls to keep the playhead in sight. A manual scroll
  // turns this off so the user can look around without being yanked back; the
  // "Follow" pill re-engages it. Mirrored to a ref so the rAF loop reads it
  // without going stale.
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  // Set right before we scroll programmatically, so the resulting scroll event
  // is not mistaken for the user scrolling away.
  const programmaticScrollRef = useRef(false);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The track gutter slides shut to a thin icon strip so a long song gets the
  // full width, then back open on toggle.
  const [gutterCollapsed, setGutterCollapsed] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches
  ));
  // Which empty, placeable cell the pointer is over, so the SuperSonic pitch
  // ladder shows inline in just that cell.
  const [hoverCell, setHoverCell] = useState<{ trackId: string; step: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    draftEnd: number;
    maximumEnd: number;
    minimumEnd: number;
    name: string;
    originalEnd: number;
    sectionId: string;
    start: number;
  } | null>(null);
  const resizeGestureRef = useRef<typeof resizePreview>(null);
  const resizeCallbackRef = useRef(onResizeSectionEnd);
  const [movePreview, setMovePreview] = useState<SectionMoveGesture | null>(null);
  const moveGestureRef = useRef<SectionMoveGesture | null>(null);
  const moveCallbackRef = useRef(onMoveSection);
  const suppressSectionClickRef = useRef(false);
  const [clipMovePreview, setClipMovePreview] = useState<ClipMoveGesture | null>(null);
  const clipMoveGestureRef = useRef<ClipMoveGesture | null>(null);

  useEffect(() => {
    resizeCallbackRef.current = onResizeSectionEnd;
  }, [onResizeSectionEnd]);

  useEffect(() => {
    moveCallbackRef.current = onMoveSection;
  }, [onMoveSection]);

  useEffect(() => {
    if (clipEditing) return;
    clipMoveGestureRef.current = null;
    setClipMovePreview(null);
  }, [clipEditing]);

  // Drag editing, decided by the starting cell: press a filled cell and drag to
  // erase every filled cell crossed (gaps are skipped), or press an empty cell
  // and drag to paint notes into the empty cells crossed (existing notes are
  // left alone). The drag stays on the lane it started in. A plain click still
  // toggles one cell. On touch, erase works too (filled cells allow vertical
  // panning only, so a sideways pull erases); painting stays mouse/pen, because
  // a touch drag from empty space is how the grid scrolls.
  const dragEditRef = useRef<{ mode: 'erase' | 'paint'; trackId: string } | null>(null);
  const lastDragCellRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  useEffect(() => {
    const end = () => {
      dragEditRef.current = null;
      lastDragCellRef.current = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  // SuperSonic mode is for precise placement, so the cells grow to fit the
  // pitch ladder; otherwise stay dense for the song overview.
  const cellW = Math.max(superSonicMode ? 30 : 12, Math.round(cellWidth ?? (superSonicMode ? 30 : 20)));
  const baseLaneHeight = superSonicMode ? 48 : compactLanes ? 28 : 36;
  const laneH = tracks.length === 0 || availableHeight <= RULER_HEIGHT
    ? baseLaneHeight
    : Math.max(
        baseLaneHeight,
        Math.min(112, Math.floor((availableHeight - RULER_HEIGHT) / tracks.length)),
      );
  const noteInset = Math.max(3, Math.min(18, Math.floor(laneH * 0.18)));
  const placementEnabled = superSonicMode && Boolean(onPlaceNote);

  const originalSongSteps = Math.max(MIN_ARRANGEMENT_STEPS, Math.round(songLengthInBeats));
  const resizeDelta = resizePreview ? resizePreview.draftEnd - resizePreview.originalEnd : 0;
  const songSteps = originalSongSteps + resizeDelta;
  // Render a couple of empty bars past the song's end so there is always
  // somewhere to add onto: clicking into this trailing zone drops a clip and
  // grows the song. This works for any loaded scene, so a library song can be
  // extended from the whole-song view without touching the arranger.
  const trailingSteps = stepsPerPattern * 2;
  const totalSteps = songSteps + trailingSteps;
  const totalWidth = totalSteps * cellW;

  useEffect(() => {
    let raf = 0;
    let lastBeat = -1;
    const tick = () => {
      const beat = engine.currentStep;
      if (beat !== lastBeat) {
        lastBeat = beat;
        const playX = beat * cellW;
        // Move the playhead imperatively so the whole grid does not re-render on
        // every step; that per-step churn is a real source of playback stutter.
        const ph = playheadRef.current;
        if (ph) {
          ph.style.transform = `translateX(${playX}px)`;
        }
        // Follow only while following is on, and only when the playhead drifts
        // near an edge. Flag the scroll as ours so onScroll does not read it as a
        // manual scroll and disengage follow.
        const el = scrollRef.current;
        if (el && followingRef.current) {
          if (playX < el.scrollLeft + 40 || playX > el.scrollLeft + el.clientWidth - 40) {
            programmaticScrollRef.current = true;
            el.scrollLeft = Math.max(0, playX - el.clientWidth / 2);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cellW]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => setAvailableHeight(root.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Plain mouse wheel scrolls the timeline sideways (this grid has no vertical
  // scroll of its own), so a mouse with no horizontal wheel can still move
  // across the song. At either end the event bubbles so the page can scroll.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey) return;
      if (node.scrollWidth <= node.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft >= node.scrollWidth - node.clientWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      event.preventDefault();
      node.scrollLeft += delta;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Drop the hovered cell when SuperSonic placement turns off.
  useEffect(() => {
    if (!placementEnabled) setHoverCell(null);
  }, [placementEnabled]);

  const arrangerClipsByTrack = useMemo(() => {
    const map: Record<string, ArrangementClip[]> = {};
    for (const clip of arrangerClips) {
      (map[clip.trackId] ??= []).push(clip);
    }
    return map;
  }, [arrangerClips]);

  const baseSections = useMemo(() => {
    const sorted = [...songMarkers].sort((a, b) => a.beat - b.beat);
    const fallback = {
      beat: 0,
      id: 'marker_fallback',
      name: sorted.length > 0 ? 'Opening' : 'Song',
    };
    const boundaries = sorted.length === 0
      ? [fallback]
      : sorted[0].beat > 0
        ? [fallback, ...sorted]
        : sorted;

    return boundaries.map((marker, index) => ({
      id: marker.id,
      name: marker.name,
      start: marker.beat,
      end: index < boundaries.length - 1 ? boundaries[index + 1].beat : originalSongSteps,
      color: SECTION_COLORS[index % SECTION_COLORS.length],
    })).filter((section) => section.end > section.start);
  }, [songMarkers, originalSongSteps]);

  const resizedSections = useMemo(() => {
    if (!resizePreview) return baseSections;
    const delta = resizePreview.draftEnd - resizePreview.originalEnd;
    return baseSections.map((section) => {
      if (section.id === resizePreview.sectionId) {
        return { ...section, end: resizePreview.draftEnd };
      }
      if (section.start >= resizePreview.originalEnd) {
        return { ...section, end: section.end + delta, start: section.start + delta };
      }
      return section;
    }).filter((section) => section.end > section.start);
  }, [baseSections, resizePreview]);

  const sections = useMemo(() => {
    if (!movePreview || movePreview.targetBeat >= movePreview.start && movePreview.targetBeat <= movePreview.end) {
      return resizedSections;
    }
    const sourceIndex = resizedSections.findIndex((section) => section.id === movePreview.sectionId);
    if (sourceIndex < 0) return resizedSections;
    const targetIndex = movePreview.targetBeat >= originalSongSteps
      ? resizedSections.length
      : resizedSections.findIndex((section) => section.start === movePreview.targetBeat);
    if (targetIndex < 0) return resizedSections;

    const reordered = [...resizedSections];
    const [moving] = reordered.splice(sourceIndex, 1);
    const insertionIndex = movePreview.targetBeat > movePreview.end ? targetIndex - 1 : targetIndex;
    reordered.splice(Math.max(0, insertionIndex), 0, moving);
    let cursor = 0;
    return reordered.map((section) => {
      const length = section.end - section.start;
      const positioned = { ...section, end: cursor + length, start: cursor };
      cursor += length;
      return positioned;
    });
  }, [movePreview, originalSongSteps, resizedSections]);

  const windowStart = Math.max(0, Math.floor(scrollLeft / cellW) - OVERSCAN);
  const windowEnd = Math.min(totalSteps, Math.ceil((scrollLeft + viewportWidth) / cellW) + OVERSCAN);
  const windowSteps: number[] = [];
  for (let step = windowStart; step < windowEnd; step += 1) {
    windowSteps.push(step);
  }

  const sourceStepForPreview = (songStep: number) => {
    if (movePreview && (movePreview.targetBeat < movePreview.start || movePreview.targetBeat > movePreview.end)) {
      const length = movePreview.end - movePreview.start;
      if (movePreview.targetBeat < movePreview.start) {
        if (songStep >= movePreview.targetBeat && songStep < movePreview.targetBeat + length) {
          return movePreview.start + (songStep - movePreview.targetBeat);
        }
        if (songStep >= movePreview.targetBeat + length && songStep < movePreview.end) {
          return songStep - length;
        }
      } else {
        const movedStart = movePreview.targetBeat - length;
        if (songStep >= movePreview.start && songStep < movedStart) {
          return songStep + length;
        }
        if (songStep >= movedStart && songStep < movePreview.targetBeat) {
          return movePreview.start + (songStep - movedStart);
        }
      }
    }
    if (!resizePreview) return songStep;
    if (resizeDelta > 0) {
      if (songStep >= resizePreview.originalEnd && songStep < resizePreview.draftEnd) return null;
      return songStep >= resizePreview.draftEnd ? songStep - resizeDelta : songStep;
    }
    return songStep >= resizePreview.draftEnd ? songStep - resizeDelta : songStep;
  };

  const resolveAt = (track: Track, songStep: number) => {
    const sourceStep = sourceStepForPreview(songStep);
    if (sourceStep === null) return null;
    return resolvePatternStepForPlayback({
      arrangerClipsByTrack,
      currentPattern: 0,
      songStep: sourceStep,
      stepsPerPattern,
      track,
      transportMode: 'SONG',
    });
  };

  // Apply the active drag to a cell. Resolves fresh (a paint drag may have just
  // created the clip that now covers this bar) and re-checks fill so revisiting
  // a cell mid-drag is a no-op: erase only clears filled cells, paint only fills
  // empty ones.
  const applyDragToCell = (track: Track, songStep: number) => {
    const drag = dragEditRef.current;
    if (!drag || drag.trackId !== track.id) return;
    const key = `${track.id}:${songStep}`;
    if (lastDragCellRef.current === key) return;
    lastDragCellRef.current = key;
    const resolved = resolveAt(track, songStep);
    const filled = Boolean(resolved && resolved.note.length > 0);
    if (drag.mode === 'erase' && resolved && filled) {
      (onEraseStep ?? onToggleStep)(track.id, resolved.patternIndex, resolved.stepIndex);
    } else if (drag.mode === 'paint' && !filled) {
      if (resolved) {
        onToggleStep(track.id, resolved.patternIndex, resolved.stepIndex);
      } else {
        onAddSongNote?.(track.id, songStep);
      }
    }
  };

  const commitRename = () => {
    if (editingMarkerId && onRenameSection) {
      onRenameSection(editingMarkerId, draftName.trim() || 'Section');
    }
    setEditingMarkerId(null);
  };

  const barLineEvery = stepsPerPattern;

  useEffect(() => {
    const finishResize = (commit: boolean) => {
      const gesture = resizeGestureRef.current;
      resizeGestureRef.current = null;
      setResizePreview(null);
      document.documentElement.style.removeProperty('cursor');
      document.documentElement.style.removeProperty('user-select');
      if (commit && gesture && gesture.draftEnd !== gesture.originalEnd) {
        resizeCallbackRef.current?.(
          gesture.sectionId,
          gesture.start,
          gesture.originalEnd,
          gesture.draftEnd,
        );
      }
    };
    const moveResize = (event: PointerEvent) => {
      const gesture = resizeGestureRef.current;
      const node = scrollRef.current;
      if (!gesture || !node) return;
      const rect = node.getBoundingClientRect();
      if (event.clientX > rect.right - 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft += Math.max(10, cellW);
      } else if (event.clientX < rect.left + 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft -= Math.max(10, cellW);
      }
      const rawStep = (event.clientX - rect.left + node.scrollLeft) / cellW;
      const snappedStep = gesture.start + snapSectionLength(
        rawStep - gesture.start,
        stepsPerPattern,
        event.shiftKey,
      );
      const draftEnd = Math.max(gesture.minimumEnd, Math.min(gesture.maximumEnd, snappedStep));
      if (draftEnd === gesture.draftEnd) return;
      const nextGesture = { ...gesture, draftEnd };
      resizeGestureRef.current = nextGesture;
      setResizePreview(nextGesture);
    };
    const cancelResize = () => finishResize(false);
    const commitResize = () => finishResize(true);
    const handleResizeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && resizeGestureRef.current) {
        event.preventDefault();
        cancelResize();
      }
    };
    window.addEventListener('pointermove', moveResize);
    window.addEventListener('pointerup', commitResize);
    window.addEventListener('pointercancel', cancelResize);
    window.addEventListener('keydown', handleResizeKey);
    return () => {
      window.removeEventListener('pointermove', moveResize);
      window.removeEventListener('pointerup', commitResize);
      window.removeEventListener('pointercancel', cancelResize);
      window.removeEventListener('keydown', handleResizeKey);
    };
  }, [cellW, stepsPerPattern]);

  useEffect(() => {
    const finishMove = (commit: boolean) => {
      const gesture = moveGestureRef.current;
      moveGestureRef.current = null;
      setMovePreview(null);
      document.documentElement.style.removeProperty('cursor');
      document.documentElement.style.removeProperty('user-select');
      if (
        commit
        && gesture?.moved
        && (gesture.targetBeat < gesture.start || gesture.targetBeat > gesture.end)
      ) {
        moveCallbackRef.current?.(
          gesture.sectionId,
          gesture.start,
          gesture.end,
          gesture.targetBeat,
        );
      }
    };
    const moveSection = (event: PointerEvent) => {
      const gesture = moveGestureRef.current;
      const node = scrollRef.current;
      if (!gesture || !node) return;
      const moved = gesture.moved || Math.abs(event.clientX - gesture.originClientX) >= 5;
      if (!moved) return;

      const rect = node.getBoundingClientRect();
      if (event.clientX > rect.right - 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft += Math.max(10, cellW);
      } else if (event.clientX < rect.left + 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft -= Math.max(10, cellW);
      }
      const rawBeat = (event.clientX - rect.left + node.scrollLeft) / cellW;
      const boundaries = [...baseSections.map((section) => section.start), originalSongSteps];
      const targetBeat = boundaries.reduce((closest, beat) => (
        Math.abs(beat - rawBeat) < Math.abs(closest - rawBeat) ? beat : closest
      ), boundaries[0] ?? gesture.start);
      const nextGesture = { ...gesture, moved: true, targetBeat };
      moveGestureRef.current = nextGesture;
      suppressSectionClickRef.current = true;
      followingRef.current = false;
      setFollowing(false);
      setMovePreview(nextGesture);
      document.documentElement.style.cursor = 'grabbing';
      document.documentElement.style.userSelect = 'none';
    };
    const cancelMove = () => finishMove(false);
    const commitMove = () => finishMove(true);
    const handleMoveKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && moveGestureRef.current?.moved) {
        event.preventDefault();
        cancelMove();
      }
    };
    window.addEventListener('pointermove', moveSection);
    window.addEventListener('pointerup', commitMove);
    window.addEventListener('pointercancel', cancelMove);
    window.addEventListener('keydown', handleMoveKey);
    return () => {
      window.removeEventListener('pointermove', moveSection);
      window.removeEventListener('pointerup', commitMove);
      window.removeEventListener('pointercancel', cancelMove);
      window.removeEventListener('keydown', handleMoveKey);
    };
  }, [baseSections, cellW, originalSongSteps]);

  useEffect(() => {
    const finishClipMove = (commit: boolean) => {
      const gesture = clipMoveGestureRef.current;
      clipMoveGestureRef.current = null;
      setClipMovePreview(null);
      document.documentElement.style.removeProperty('cursor');
      document.documentElement.style.removeProperty('user-select');
      if (
        commit
        && gesture?.moved
        && (
          gesture.previewStartBeat !== gesture.sourceStartBeat
          || gesture.previewTrackId !== gesture.sourceTrackId
        )
      ) {
        onMoveClip?.(gesture.clipId, gesture.previewTrackId, gesture.previewStartBeat);
      }
    };
    const moveClip = (event: PointerEvent) => {
      const gesture = clipMoveGestureRef.current;
      const node = scrollRef.current;
      if (!gesture || !node) return;
      const moved = gesture.moved
        || Math.abs(event.clientX - gesture.originClientX) >= 4
        || Math.abs(event.clientY - gesture.originClientY) >= 4;
      if (!moved) return;

      const rect = node.getBoundingClientRect();
      if (event.clientX > rect.right - 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft += Math.max(10, cellW);
      } else if (event.clientX < rect.left + 28) {
        programmaticScrollRef.current = true;
        node.scrollLeft -= Math.max(10, cellW);
      }
      const rawStart = ((event.clientX - rect.left + node.scrollLeft) / cellW) - gesture.pointerBeatOffset;
      const previewStartBeat = Math.max(0, Math.round(rawStart / 4) * 4);
      const laneIndex = Math.max(
        0,
        Math.min(
          tracks.length - 1,
          Math.floor((event.clientY - rect.top - RULER_HEIGHT) / laneH),
        ),
      );
      const previewTrackId = tracks[laneIndex]?.id ?? gesture.previewTrackId;
      const nextGesture = {
        ...gesture,
        moved: true,
        previewStartBeat,
        previewTrackId,
      };
      clipMoveGestureRef.current = nextGesture;
      setClipMovePreview(nextGesture);
      followingRef.current = false;
      setFollowing(false);
      document.documentElement.style.cursor = 'grabbing';
      document.documentElement.style.userSelect = 'none';
    };
    const cancelClipMove = () => finishClipMove(false);
    const commitClipMove = () => finishClipMove(true);
    const handleClipMoveKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && clipMoveGestureRef.current) {
        event.preventDefault();
        cancelClipMove();
      }
    };
    window.addEventListener('pointermove', moveClip);
    window.addEventListener('pointerup', commitClipMove);
    window.addEventListener('pointercancel', cancelClipMove);
    window.addEventListener('keydown', handleClipMoveKey);
    return () => {
      window.removeEventListener('pointermove', moveClip);
      window.removeEventListener('pointerup', commitClipMove);
      window.removeEventListener('pointercancel', cancelClipMove);
      window.removeEventListener('keydown', handleClipMoveKey);
    };
  }, [cellW, laneH, onMoveClip, tracks]);

  const beginClipMove = (event: React.PointerEvent, clip: ArrangementClip) => {
    const node = scrollRef.current;
    if (!clipEditing || !node || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = node.getBoundingClientRect();
    const pointerBeat = (event.clientX - rect.left + node.scrollLeft) / cellW;
    onSelectClip?.(clip.id);
    onSelectTrack(clip.trackId);
    clipMoveGestureRef.current = {
      clipId: clip.id,
      moved: false,
      originClientX: event.clientX,
      originClientY: event.clientY,
      pointerBeatOffset: pointerBeat - clip.startBeat,
      previewStartBeat: clip.startBeat,
      previewTrackId: clip.trackId,
      sourceStartBeat: clip.startBeat,
      sourceTrackId: clip.trackId,
    };
  };

  const moveClipWithKeyboard = (event: React.KeyboardEvent, clip: ArrangementClip) => {
    if (!clipEditing) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDeleteClip?.(clip.id);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      onDuplicateClip?.(clip.id);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const trackIndex = tracks.findIndex((track) => track.id === clip.trackId);
    const nextTrackIndex = event.key === 'ArrowUp'
      ? Math.max(0, trackIndex - 1)
      : event.key === 'ArrowDown'
        ? Math.min(tracks.length - 1, trackIndex + 1)
        : trackIndex;
    const nextStartBeat = event.key === 'ArrowLeft'
      ? Math.max(0, clip.startBeat - 4)
      : event.key === 'ArrowRight'
        ? clip.startBeat + 4
        : clip.startBeat;
    onMoveClip?.(clip.id, tracks[nextTrackIndex]?.id ?? clip.trackId, nextStartBeat);
  };

  const beginSectionResize = (
    event: React.PointerEvent,
    section: (typeof baseSections)[number],
  ) => {
    if (!onResizeSectionEnd || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const minimumEnd = Math.max(
      section.start + MIN_SECTION_STEPS,
      section.end - (originalSongSteps - MIN_ARRANGEMENT_STEPS),
    );
    const gesture = {
      draftEnd: section.end,
      maximumEnd: section.end + (MAX_ARRANGER_BEAT_POSITION - originalSongSteps),
      minimumEnd,
      name: section.name,
      originalEnd: section.end,
      sectionId: section.id,
      start: section.start,
    };
    followingRef.current = false;
    setFollowing(false);
    resizeGestureRef.current = gesture;
    setResizePreview(gesture);
    document.documentElement.style.cursor = 'ew-resize';
    document.documentElement.style.userSelect = 'none';
  };

  const resizeSectionWithKeyboard = (
    event: React.KeyboardEvent,
    section: (typeof baseSections)[number],
  ) => {
    if (!onResizeSectionEnd || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    event.stopPropagation();
    const amount = event.shiftKey ? stepsPerPattern : 1;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const minimumEnd = Math.max(
      section.start + MIN_SECTION_STEPS,
      section.end - (originalSongSteps - MIN_ARRANGEMENT_STEPS),
    );
    const maximumEnd = section.end + (MAX_ARRANGER_BEAT_POSITION - originalSongSteps);
    const nextEnd = Math.max(minimumEnd, Math.min(maximumEnd, section.end + (amount * direction)));
    if (nextEnd !== section.end) {
      onResizeSectionEnd(section.id, section.start, section.end, nextEnd);
    }
  };

  const beginSectionMove = (
    event: React.PointerEvent,
    section: (typeof baseSections)[number],
  ) => {
    if (!onMoveSection || event.button !== 0 || editingMarkerId === section.id) return;
    event.stopPropagation();
    suppressSectionClickRef.current = false;
    moveGestureRef.current = {
      end: section.end,
      moved: false,
      name: section.name,
      originClientX: event.clientX,
      sectionId: section.id,
      start: section.start,
      targetBeat: section.start,
    };
  };

  const moveSectionWithKeyboard = (
    event: React.KeyboardEvent,
    section: (typeof baseSections)[number],
  ) => {
    if (
      !onMoveSection
      || !event.altKey
      || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) return;
    const sectionIndex = baseSections.findIndex((candidate) => candidate.id === section.id);
    const movingLeft = event.key === 'ArrowLeft';
    if ((movingLeft && sectionIndex <= 0) || (!movingLeft && sectionIndex >= baseSections.length - 1)) return;
    event.preventDefault();
    event.stopPropagation();
    const targetBeat = movingLeft
      ? baseSections[sectionIndex - 1].start
      : baseSections[sectionIndex + 1].end;
    onMoveSection(section.id, section.start, section.end, targetBeat);
  };

  // Re-engage auto-follow and snap the view to the playhead. Triggered by the
  // "Follow" pill that appears once a manual scroll has turned following off.
  const resumeFollow = () => {
    followingRef.current = true;
    setFollowing(true);
    const el = scrollRef.current;
    if (el) {
      programmaticScrollRef.current = true;
      el.scrollLeft = Math.max(0, engine.currentStep * cellW - el.clientWidth / 2);
    }
  };

  return (
    <div ref={rootRef} className="relative flex min-h-[240px] flex-1 overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
      {/* Track-name gutter, aligned row-for-row with the lanes. Slides shut to a
          thin icon strip; drag a lane to reorder. */}
      <div className="shrink-0 overflow-hidden border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)] transition-[width] duration-200" style={{ width: gutterCollapsed ? 36 : GUTTER_WIDTH }}>
        <div
          className={`flex items-center border-b border-[var(--border-soft)] ${gutterCollapsed ? 'justify-center' : 'justify-between px-3'}`}
          style={{ height: RULER_HEIGHT }}
        >
          {!gutterCollapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <span className="section-label truncate">Tracks</span>
            </div>
          )}
          <button
            aria-label={gutterCollapsed ? 'Show track names' : 'Hide track names'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
            onClick={() => setGutterCollapsed((value) => !value)}
            title={gutterCollapsed ? 'Slide the track list open' : 'Slide the track list shut for more timeline width'}
            type="button"
          >
            {gutterCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        <div data-song-track-gutter-list="true" style={{ transform: `translateY(-${scrollTop}px)` }}>
        {tracks.map((track, index) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <div
              key={track.id}
              className={`group relative flex w-full items-center border-b border-[var(--border-soft)] transition-colors last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] ${gutterCollapsed ? 'justify-center' : 'gap-2 px-2.5'}`}
              data-drop-target={dropIndex === index ? 'true' : undefined}
              draggable
              onClick={() => onSelectTrack(track.id)}
              onDragStart={(event) => { setDragTrackId(track.id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(event) => { if (dragTrackId && dragTrackId !== track.id) { event.preventDefault(); setDropIndex(index); } }}
              onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragTrackId && onReorderTrack) onReorderTrack(dragTrackId, index);
                setDragTrackId(null);
                setDropIndex(null);
              }}
              onDragEnd={() => { setDragTrackId(null); setDropIndex(null); }}
              style={{
                height: laneH,
                cursor: 'grab',
                background: isSelected ? 'rgba(125,211,252,0.06)' : undefined,
                boxShadow: dropIndex === index ? 'inset 0 2px 0 var(--accent-strong)' : undefined,
                opacity: dragTrackId === track.id ? 0.45 : 1,
              }}
              title={gutterCollapsed ? track.name : 'Drag to reorder'}
            >
              {isSelected && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: track.color }} />}
              {!gutterCollapsed && <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />}
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px]"
                style={{ border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
              >
                <TrackIcon type={track.type} className="h-3.5 w-3.5" />
              </span>
              {!gutterCollapsed && <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</span>}
              {!gutterCollapsed && onDeleteTrack && (
                <button
                  aria-label={`Remove the ${track.name} lane`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-tertiary)] opacity-75 transition-colors hover:bg-[rgba(244,63,94,0.14)] hover:text-[var(--danger)] hover:opacity-100"
                  onClick={(event) => { event.stopPropagation(); onDeleteTrack(track.id); }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={`Remove the ${track.name} lane`}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Scrollable, virtualized timeline. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        data-song-timeline-scroll="true"
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
          setScrollTop(event.currentTarget.scrollTop);
          setHoverCell(null);
          // A scroll we did not initiate means the user moved the view, so stop
          // following until they ask to resume.
          if (programmaticScrollRef.current) {
            programmaticScrollRef.current = false;
          } else if (followingRef.current) {
            followingRef.current = false;
            setFollowing(false);
          }
        }}
      >
        <div className="relative" style={{ width: totalWidth }}>
          {/* Editable section ruler. */}
          <div className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)]" style={{ height: RULER_HEIGHT, width: totalWidth }}>
            {sections.map((section, sectionIndex) => {
              const originalSection = baseSections.find((candidate) => candidate.id === section.id) ?? section;
              const isResizing = resizePreview?.sectionId === section.id;
              const isMoving = movePreview?.sectionId === section.id;
              const sectionLength = section.end - section.start;
              const wholeBars = Math.floor(sectionLength / stepsPerPattern);
              const remainingSteps = sectionLength % stepsPerPattern;
              return (
                <div
                  key={section.id}
                  className="group absolute top-0 flex h-full items-center border-l border-[var(--chrome-line)]"
                  data-moving={isMoving ? 'true' : undefined}
                  data-resizing={isResizing ? 'true' : undefined}
                  style={{
                    left: section.start * cellW,
                    width: sectionLength * cellW,
                    background: `${section.color}${isResizing ? '28' : '14'}`,
                    boxShadow: isResizing || isMoving
                      ? `inset 0 0 0 1px ${section.color}cc, 0 4px 14px rgba(0,0,0,0.38)`
                      : undefined,
                    opacity: movePreview && !isMoving ? 0.72 : 1,
                    zIndex: isResizing || isMoving ? 30 : baseSections.length - sectionIndex,
                  }}
                >
                  {editingMarkerId === section.id ? (
                    <input
                      autoFocus
                      className="mx-1 h-[18px] w-full min-w-0 rounded-[2px] border border-[var(--accent-strong)] bg-[var(--bg-panel-strong)] px-1 text-[10px] text-[var(--text-primary)]"
                      onBlur={commitRename}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename();
                        if (event.key === 'Escape') setEditingMarkerId(null);
                      }}
                      value={draftName}
                    />
                  ) : (
                    <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden pr-2">
                      <button
                        aria-label={`Move ${section.name}`}
                        className="flex h-full min-w-0 flex-1 cursor-grab items-center gap-0.5 truncate px-1 text-left text-[9px] font-semibold uppercase tracking-[0.12em] active:cursor-grabbing"
                        onClick={() => {
                          if (suppressSectionClickRef.current) {
                            suppressSectionClickRef.current = false;
                            return;
                          }
                          onSeek?.(section.start);
                        }}
                        onDoubleClick={() => { setEditingMarkerId(section.id); setDraftName(section.name); }}
                        onKeyDown={(event) => moveSectionWithKeyboard(event, originalSection)}
                        onPointerDown={(event) => beginSectionMove(event, originalSection)}
                        style={{ color: section.color }}
                        title={`Drag ${section.name} to reorder. Alt+Left/Right moves one section.`}
                        type="button"
                      >
                        {onMoveSection && <GripVertical className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />}
                        <span className="truncate">{section.name}</span>
                      </button>
                      {onManageSection && (
                        <button
                          aria-label={`Manage ${section.name}`}
                          className="mr-0.5 shrink-0 rounded-[2px] p-0.5 text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)] hover:opacity-100 focus:opacity-100 group-hover:opacity-70"
                          onClick={() => onManageSection(section.id)}
                          title={`Manage, clear, save, or delete ${section.name}`}
                          type="button"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  {onResizeSectionEnd && (
                    <button
                      aria-label={`Resize the end of ${section.name}`}
                      aria-valuemax={originalSection.end + (MAX_ARRANGER_BEAT_POSITION - originalSongSteps)}
                      aria-valuemin={Math.max(originalSection.start + MIN_SECTION_STEPS, originalSection.end - (originalSongSteps - MIN_ARRANGEMENT_STEPS))}
                      aria-valuenow={section.end}
                      className="absolute -right-2 top-0 z-20 flex h-full w-4 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none"
                      data-section-resize-handle={section.id}
                      onKeyDown={(event) => resizeSectionWithKeyboard(event, originalSection)}
                      onPointerDown={(event) => beginSectionResize(event, originalSection)}
                      role="slider"
                      title={`Drag to resize ${section.name}. Magnetic snap every 4 steps; hold Shift to lock full bars.`}
                      type="button"
                    >
                      <span
                        className="flex h-6 w-2 items-center justify-center rounded-[2px] border transition-all group-hover:w-2.5"
                        style={{
                          background: isResizing ? section.color : 'var(--bg-panel-strong)',
                          borderColor: isResizing ? section.color : `${section.color}88`,
                          color: isResizing ? 'var(--bg-app)' : section.color,
                          boxShadow: isResizing ? `0 0 12px ${section.color}88` : undefined,
                        }}
                      >
                        <GripVertical className="h-3 w-3" />
                      </span>
                    </button>
                  )}
                  {isResizing && (
                    <div
                      className="pointer-events-none absolute -top-9 right-0 z-40 whitespace-nowrap rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-panel-strong)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-primary)] shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
                    >
                      {wholeBars > 0 ? `${wholeBars} bar${wholeBars === 1 ? '' : 's'}` : ''}
                      {wholeBars > 0 && remainingSteps > 0 ? ' + ' : ''}
                      {remainingSteps > 0 || wholeBars === 0 ? `${remainingSteps || sectionLength} steps` : ''}
                      <span className="ml-2" style={{ color: section.color }}>
                        {resizeDelta > 0 ? '+' : ''}{resizeDelta}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lanes. */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="relative border-b border-[var(--border-soft)] last:border-b-0"
              style={{ height: laneH, width: totalWidth }}
              onPointerLeave={() => setHoverCell((current) => (current?.trackId === track.id ? null : current))}
            >
              {windowSteps.map((songStep) => {
                const resolved = resolveAt(track, songStep);
                const active = Boolean(resolved && resolved.note.length > 0);
                const isBar = songStep % barLineEvery === 0;
                const isBeat = songStep % 4 === 0;
                // Placeable = an empty step that the arrangement actually loops
                // here (so the note has somewhere to live). Hovering one floats
                // the pitch ladder anchored to the cell.
                const placeable = placementEnabled && !active && Boolean(resolved);
                const bar = Math.floor(songStep / barLineEvery) + 1;
                const inTrailing = songStep >= songSteps;
                const showLadder = placeable && hoverCell?.trackId === track.id && hoverCell.step === songStep;
                const anchorNote = showLadder && resolved
                  ? getTrackAnchorNote(track, track.patterns[resolved.patternIndex] ?? [], resolved.stepIndex)
                  : null;
                return (
                  <button
                    key={songStep}
                    className="group absolute top-0 h-full transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                    data-song-cell="true"
                    data-track-id={track.id}
                    data-song-step={songStep}
                    disabled={clipEditing || Boolean(resizePreview || movePreview)}
                    onPointerDown={(event) => {
                      // Reset first: a prior drag that ended on another cell (or
                      // off-grid) fires no click to self-clear the flag, so without
                      // this the next plain click would be swallowed.
                      suppressClickRef.current = false;
                      if (event.button !== 0) return;
                      if (active) {
                        // Filled start: erase this cell and everything filled the
                        // drag crosses on this lane.
                        const target = resolved ?? resolveAt(track, songStep);
                        if (!target) return;
                        dragEditRef.current = { mode: 'erase', trackId: track.id };
                        lastDragCellRef.current = `${track.id}:${songStep}`;
                        suppressClickRef.current = true;
                        (onEraseStep ?? onToggleStep)(track.id, target.patternIndex, target.stepIndex);
                        return;
                      }
                      // Empty start: paint into the empty cells the drag crosses.
                      // Mouse/pen only (a touch drag from empty space scrolls), and
                      // not while the SuperSonic ladder owns empty-cell placement.
                      if (event.pointerType === 'touch' || placementEnabled) return;
                      dragEditRef.current = { mode: 'paint', trackId: track.id };
                      lastDragCellRef.current = `${track.id}:${songStep}`;
                      suppressClickRef.current = true;
                      if (resolved) {
                        onToggleStep(track.id, resolved.patternIndex, resolved.stepIndex);
                      } else {
                        onAddSongNote?.(track.id, songStep);
                      }
                    }}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      const target = resolved ?? resolveAt(track, songStep);
                      if (target) {
                        onToggleStep(track.id, target.patternIndex, target.stepIndex);
                      } else {
                        // No clip covers this song step yet: drop one here and
                        // place a note in a single gesture.
                        onAddSongNote?.(track.id, songStep);
                      }
                    }}
                    onPointerEnter={() => {
                      if (placeable) setHoverCell({ trackId: track.id, step: songStep });
                      applyDragToCell(track, songStep);
                    }}
                    onPointerMove={(event) => {
                      // Touch keeps implicit pointer capture, so sibling cells never
                      // get pointerenter; walk the finger via elementFromPoint the
                      // way the per-pattern grid does.
                      if (event.pointerType !== 'touch' || !dragEditRef.current) return;
                      const under = document.elementFromPoint(event.clientX, event.clientY);
                      const cellEl = under instanceof Element ? under.closest('[data-song-cell="true"]') : null;
                      if (!(cellEl instanceof HTMLElement)) return;
                      const overTrack = tracks.find((candidate) => candidate.id === cellEl.dataset.trackId);
                      const overStep = Number(cellEl.dataset.songStep);
                      if (!overTrack || Number.isNaN(overStep)) return;
                      applyDragToCell(overTrack, overStep);
                    }}
                    style={{
                      left: songStep * cellW,
                      width: cellW,
                      // Filled cells keep vertical panning but claim sideways touch
                      // pulls for the erase drag; empty cells scroll freely.
                      touchAction: active ? 'pan-y' : undefined,
                      borderLeft: isBar
                        ? '1px solid rgba(255,255,255,0.16)'
                        : isBeat
                          ? '1px solid rgba(255,255,255,0.06)'
                          : '1px solid rgba(255,255,255,0.02)',
                      background: inTrailing
                        ? 'rgba(114,217,255,0.06)'
                        : isBeat && !isBar ? 'rgba(255,255,255,0.025)' : undefined,
                    }}
                    title={inTrailing
                      ? `Bar ${bar} · click to extend the song here`
                      : placeable
                      ? `Bar ${bar} · hover to place a pitch`
                      : active
                        ? `Bar ${bar} · click to remove`
                        : resolved
                          ? `Bar ${bar} · click to add a note`
                          : `Bar ${bar} · click to start a clip here`}
                    type="button"
                  >
                    {active && (() => {
                      const events = (resolved && track.patterns[resolved.patternIndex]?.[resolved.stepIndex]) || [];
                      // In SuperSonic mode a step's chord shows each note as its
                      // own stacked sub-bar (highest pitch on top), so the parts
                      // are visible instead of one flat block.
                      if (superSonicMode && events.length > 1) {
                        const sorted = [...events].sort((left, right) => pitchRank(right.note) - pitchRank(left.note));
                        // The faint full-cell fill is the "big note" block (how it
                        // reads in normal mode); the brighter inset sub-bars are the
                        // individual subnotes you place in SuperSonic. Nesting them
                        // overlaps the larger note and its parts in one cell.
                        return (
                          <span
                            aria-hidden
                            className="absolute inset-x-[1.5px] rounded-[2px]"
                            style={{ background: track.color, bottom: noteInset, opacity: 0.2, top: noteInset }}
                          >
                            <span className="absolute inset-[1.5px] flex flex-col gap-px overflow-hidden rounded-[1px]">
                              {sorted.map((event, noteIndex) => (
                                <span
                                  className="min-h-0 flex-1 rounded-[1px]"
                                  key={`${event.note}-${noteIndex}`}
                                  style={{ background: track.color, opacity: 0.95 - noteIndex * 0.12 }}
                                  title={event.note}
                                />
                              ))}
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span
                          className="absolute inset-x-[1.5px] overflow-hidden rounded-[2px]"
                          style={{ background: track.color, bottom: noteInset, opacity: 0.92, top: noteInset }}
                          title={events[0]?.note}
                        >
                          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/55" />
                        </span>
                      );
                    })()}
                    {showLadder && anchorNote && resolved && (
                      <span
                        className="supersonic-ladder absolute inset-0 z-[2]"
                        style={{ '--supersonic-ladder-count': String(SUPERSONIC_NOTE_OFFSETS.length) } as React.CSSProperties}
                      >
                        {SUPERSONIC_NOTE_OFFSETS.map((offset) => {
                          const targetNote = shiftPitch(anchorNote, offset);
                          if (!targetNote) {
                            return (
                              <span
                                className="supersonic-ladder-step"
                                key={offset}
                                style={{ '--ladder-fill': '0.44', '--ladder-glow': track.color } as React.CSSProperties}
                              />
                            );
                          }
                          return (
                            <span
                              className="supersonic-ladder-step"
                              data-center={offset === 0 ? 'true' : 'false'}
                              key={offset}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                onPlaceNote?.(track.id, resolved.patternIndex, resolved.stepIndex, targetNote);
                              }}
                              style={{
                                '--ladder-color': track.color,
                                '--ladder-fill': `${Math.max(0.38, 0.94 - (Math.abs(offset) * 0.08))}`,
                                '--ladder-glow': offset === 0 ? 'rgba(255,255,255,0.88)' : `${track.color}88`,
                              } as React.CSSProperties}
                              title={`Place ${targetNote}`}
                            />
                          );
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
              {clipEditing && arrangerClips
                .filter((clip) => (
                  clipMovePreview?.clipId === clip.id
                    ? clipMovePreview.previewTrackId === track.id
                    : clip.trackId === track.id
                ))
                .map((clip) => {
                  const previewing = clipMovePreview?.clipId === clip.id;
                  const startBeat = previewing ? clipMovePreview.previewStartBeat : clip.startBeat;
                  const selected = selectedClipId === clip.id;
                  return (
                    <div
                      className="group absolute inset-y-1 overflow-hidden rounded-[3px] border shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                      data-arranger-clip={clip.id}
                      data-moving={previewing && clipMovePreview.moved ? 'true' : undefined}
                      data-selected={selected ? 'true' : undefined}
                      key={clip.id}
                      style={{
                        background: `${track.color}${selected ? '46' : '30'}`,
                        borderColor: selected ? track.color : `${track.color}88`,
                        boxShadow: selected ? `inset 0 0 0 1px ${track.color}, 0 3px 12px rgba(0,0,0,0.42)` : undefined,
                        left: startBeat * cellW,
                        opacity: previewing ? 0.82 : 1,
                        width: Math.max(36, clip.beatLength * cellW),
                        zIndex: selected || previewing ? 14 : 8,
                      }}
                    >
                      <button
                        aria-label={`Move Pattern ${String.fromCharCode(65 + clip.patternIndex)} clip on ${track.name}`}
                        className="absolute inset-0 flex cursor-grab items-center gap-1 overflow-hidden px-2 text-left active:cursor-grabbing"
                        onClick={() => {
                          onSelectClip?.(clip.id);
                          onSelectTrack(track.id);
                        }}
                        onDoubleClick={() => onDuplicateClip?.(clip.id)}
                        onKeyDown={(event) => moveClipWithKeyboard(event, clip)}
                        onPointerDown={(event) => beginClipMove(event, clip)}
                        title={`Pattern ${String.fromCharCode(65 + clip.patternIndex)} · ${clip.beatLength} steps. Drag in time or to another lane.`}
                        type="button"
                      >
                        <GripVertical className="h-3 w-3 shrink-0 opacity-65" />
                        <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-[0.11em]" style={{ color: track.color }}>
                          P{String.fromCharCode(65 + clip.patternIndex)} · {clip.beatLength}
                        </span>
                      </button>
                      {selected && (
                        <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-[2px] bg-[var(--bg-panel-strong)]/90 p-0.5 shadow-sm">
                          <button
                            aria-label="Duplicate selected clip"
                            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-primary)]"
                            onClick={(event) => { event.stopPropagation(); onDuplicateClip?.(clip.id); }}
                            onPointerDown={(event) => event.stopPropagation()}
                            title="Duplicate clip (Cmd/Ctrl+D)"
                            type="button"
                          >
                            <CopyPlus className="h-3 w-3" />
                          </button>
                          <button
                            aria-label="Delete selected clip"
                            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-[var(--text-secondary)] hover:bg-[rgba(244,63,94,0.14)] hover:text-[var(--danger)]"
                            onClick={(event) => { event.stopPropagation(); onDeleteClip?.(clip.id); }}
                            onPointerDown={(event) => event.stopPropagation()}
                            title="Delete clip"
                            type="button"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}

          {/* Playhead across the ruler and every lane. Positioned imperatively
              from the rAF loop so the grid never re-renders as it moves. */}
          <div
            ref={playheadRef}
            className="pointer-events-none absolute left-0 top-0 w-[2px] bg-[var(--accent-strong)] will-change-transform"
            style={{ transform: 'translateX(0px)', height: RULER_HEIGHT + tracks.length * laneH }}
          />
        </div>
      </div>
      {!following && !resizePreview && !movePreview && !clipMovePreview && (
        <button
          aria-label="Follow the playhead"
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full border border-[var(--accent-strong)] bg-[var(--bg-panel-strong)] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)] shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-colors hover:bg-[var(--accent-muted)]"
          onClick={resumeFollow}
          type="button"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
          Follow
        </button>
      )}
    </div>
  );
};
