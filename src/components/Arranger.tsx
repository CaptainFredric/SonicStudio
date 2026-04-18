import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useAudio } from '../context/AudioContext';
import { type ArrangementClip } from '../project/schema';
import { ArrangerHeader } from './arranger/ArrangerHeader';
import { ArrangerInspector } from './arranger/ArrangerInspector';
import { buildLaneData, buildLaneSections, buildSectionRanges, isDrumTrack } from './arranger/arrangerSelectors';
import { ArrangerTimeline } from './arranger/ArrangerTimeline';
import type { DragMode, DragState, InspectorTab, LaneScope, LaneSectionKey, PaintMode, PaintState, SnapSize, ZoomPreset } from './arranger/types';
import {
  getClipUpdatesFromDragState,
  getDragPreview,
  getRenderedClipFrame,
  getSplitBeat,
  getViewportScrollLeft,
  resolveArrangerShortcut,
  shouldHandleTimelineWheel,
} from './arranger/interactionUtils';
import { buildComposerRows, getComposerStepCount } from './arranger/noteUtils';

const DEFAULT_SNAP = 4;
const MIN_CLIP_LENGTH = 4;
export const ZOOM_PIXELS_PER_STEP: Record<ZoomPreset, number> = {
  PHRASE: 30,
  SECTION: 18,
  SONG: 10,
};

const SNAP_OPTIONS: Array<{ label: string; value: SnapSize }> = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: '8', value: 8 },
  { label: '16', value: 16 },
];

const formatBars = (steps: number) => Math.max(1, Math.ceil(steps / 16));

const getVisibleRangeLabel = (startStep: number, endStep: number) => (
  `${startStep + 1} to ${Math.max(startStep + 1, endStep)}`
);

const scrollTimelineToStep = (
  node: HTMLDivElement,
  step: number,
  pixelsPerStep: number,
  align: 'center' | 'nearest' = 'center',
) => {
  const targetLeft = step * pixelsPerStep;
  const viewportStart = node.scrollLeft;
  const viewportEnd = viewportStart + node.clientWidth;

  if (align === 'nearest' && targetLeft >= viewportStart && targetLeft <= viewportEnd) {
    return;
  }

  const nextLeft = align === 'center'
    ? Math.max(0, targetLeft - node.clientWidth * 0.5)
    : Math.max(0, targetLeft - node.clientWidth * 0.2);

  node.scrollTo({
    behavior: 'smooth',
    left: nextLeft,
  });
};

export const Arranger = () => {
  const {
    addArrangerClip,
    arrangerClips,
    bpm,
    createSongMarker,
    currentStep,
    duplicateArrangerClip,
    duplicateSongRange,
    loopArrangerClip,
    loopRangeEndBeat,
    loopRangeStartBeat,
    makeClipPatternUnique,
    moveTrack,
    patternCount,
    pinnedTrackIds,
    removeArrangerClip,
    selectSampleSlice,
    selectedArrangerClipId,
    selectedTrackId,
    setActiveView,
    setClipPatternStepSlice,
    setCurrentPattern,
    setLoopRange,
    setSelectedArrangerClipId,
    setSelectedTrackId,
    songMarkers,
    songLengthInBeats,
    splitArrangerClip,
    stepsPerPattern,
    toggleClipPatternStep,
    toggleMute,
    togglePinnedTrack,
    toggleSolo,
    tracks,
    transformClipPattern,
    transportMode,
    updateArrangerClip,
    updateClipPatternAutomationStep,
    updateClipPatternStepEvent,
    updateSongMarker,
    removeSongMarker,
  } = useAudio();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [paintState, setPaintState] = useState<PaintState | null>(null);
  const [selectedPhraseStepIndex, setSelectedPhraseStepIndex] = useState(0);
  const [selectedPhraseNoteIndex, setSelectedPhraseNoteIndex] = useState<number | null>(null);
  const [snapSize, setSnapSize] = useState<SnapSize>(DEFAULT_SNAP);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [laneScope, setLaneScope] = useState<LaneScope>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<LaneSectionKey, boolean>>({
    MUSICAL: false,
    PINNED: false,
    RHYTHM: false,
    TEXTURE: false,
  });
  const [compactLaneView, setCompactLaneView] = useState(false);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('SECTION');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('COMPOSE');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [openLaneMenuTrackId, setOpenLaneMenuTrackId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const pixelsPerStep = ZOOM_PIXELS_PER_STEP[zoomPreset];

  const selectedClip = arrangerClips.find((clip) => clip.id === selectedArrangerClipId) ?? null;
  const selectedClipTrack = tracks.find((track) => track.id === selectedClip?.trackId) ?? null;
  const linkedPhraseCount = selectedClip
    ? arrangerClips.filter((clip) => (
        clip.trackId === selectedClip.trackId
        && clip.patternIndex === selectedClip.patternIndex
      )).length
    : 0;
  const selectedClipPattern = selectedClip && selectedClipTrack
    ? selectedClipTrack.patterns[selectedClip.patternIndex] ?? Array.from({ length: stepsPerPattern }, () => [])
    : [];
  const selectedClipAutomation = selectedClip && selectedClipTrack
    ? selectedClipTrack.automation[selectedClip.patternIndex] ?? {
        level: Array.from({ length: stepsPerPattern }, () => 0.5),
        tone: Array.from({ length: stepsPerPattern }, () => 0.5),
      }
    : {
        level: Array.from({ length: stepsPerPattern }, () => 0.5),
        tone: Array.from({ length: stepsPerPattern }, () => 0.5),
      };
  const selectedPhraseStep = selectedClipPattern[selectedPhraseStepIndex] ?? [];
  const normalizedSelectedPhraseNoteIndex = selectedPhraseNoteIndex !== null && selectedPhraseStep[selectedPhraseNoteIndex]
    ? selectedPhraseNoteIndex
    : selectedPhraseStep.length > 0 ? 0 : null;
  const selectedPhraseNote = normalizedSelectedPhraseNoteIndex !== null
    ? selectedPhraseStep[normalizedSelectedPhraseNoteIndex]
    : null;
  const composerStepCount = getComposerStepCount(selectedClip, stepsPerPattern);
  const composerSteps = selectedClipPattern.slice(0, composerStepCount);
  const phraseRows = useMemo(() => (
    selectedClipTrack && !isDrumTrack(selectedClipTrack)
      ? buildComposerRows(selectedClipTrack, selectedPhraseNote?.note ?? selectedPhraseStep[0]?.note ?? null)
      : []
  ), [selectedClipTrack, selectedPhraseNote?.note, selectedPhraseStep]);
  const isStepMappedSampleTrack = Boolean(
    selectedClipTrack
    && selectedClipTrack.source.engine === 'sample'
    && selectedClipTrack.source.sampleTriggerMode === 'step-mapped',
  );
  const timelineSteps = Math.max(songLengthInBeats, 32);
  const timelineWidth = timelineSteps * pixelsPerStep;
  const totalBars = formatBars(timelineSteps);
  const totalDurationSeconds = songLengthInBeats * (60 / bpm) * 0.25;
  const visibleStartStep = Math.floor(scrollLeft / pixelsPerStep);
  const visibleEndStep = Math.ceil((scrollLeft + viewportWidth) / pixelsPerStep);
  const maxTimelineScrollLeft = Math.max(0, timelineWidth - viewportWidth);
  const selectedPhraseActiveSteps = selectedClipPattern.filter((step) => step.length > 0).length;
  const selectedPhraseNoteCount = selectedClipPattern.reduce((sum, step) => sum + step.length, 0);
  const selectedAutomationLevel = selectedClipAutomation.level[selectedPhraseStepIndex] ?? 0.5;
  const selectedAutomationTone = selectedClipAutomation.tone[selectedPhraseStepIndex] ?? 0.5;
  const selectedPhraseSliceIndex = selectedPhraseStep[0]?.sampleSliceIndex ?? null;
  const markerCount = songMarkers.length;
  const sectionRanges = useMemo(
    () => buildSectionRanges(arrangerClips, songMarkers, timelineSteps),
    [arrangerClips, songMarkers, timelineSteps],
  );
  const laneData = useMemo(() => buildLaneData({
    arrangerClips,
    laneScope,
    pinnedTrackIds,
    selectedTrackId,
    tracks,
  }), [arrangerClips, laneScope, pinnedTrackIds, selectedTrackId, tracks]);
  const laneSections = useMemo(() => buildLaneSections({
    laneData,
    laneScope,
    pinnedTrackIds,
  }), [laneData, laneScope, pinnedTrackIds]);
  const laneLabelWidth = compactLaneView ? 184 : 220;
  const laneHeightClass = compactLaneView ? 'h-16' : 'h-20';
  const clipHeightClass = compactLaneView ? 'h-12' : 'h-14';

  useEffect(() => {
    if (selectedArrangerClipId && arrangerClips.some((clip) => clip.id === selectedArrangerClipId)) {
      return;
    }

    setSelectedArrangerClipId(arrangerClips[0]?.id ?? null);
  }, [arrangerClips, selectedArrangerClipId, setSelectedArrangerClipId]);

  useEffect(() => {
    setSelectedPhraseStepIndex(0);
    setSelectedPhraseNoteIndex(null);
  }, [selectedArrangerClipId]);

  useEffect(() => {
    if (selectedClip) {
      setInspectorTab('COMPOSE');
    }
  }, [selectedClip?.id]);

  useEffect(() => {
    if (!openLaneMenuTrackId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-lane-menu-root="true"]')) {
        return;
      }

      setOpenLaneMenuTrackId(null);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [openLaneMenuTrackId]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const preview = getDragPreview(
        dragState,
        event.clientX,
        pixelsPerStep,
        snapSize,
        MIN_CLIP_LENGTH,
      );

      setDragState((current) => current ? {
        ...current,
        previewBeatLength: preview.beatLength,
        previewStartBeat: preview.startBeat,
      } : current);
    };

    const handlePointerUp = () => {
      const clip = arrangerClips.find((candidate) => candidate.id === dragState.clipId);
      if (clip) {
        const updates = getClipUpdatesFromDragState(dragState);

        if (Object.keys(updates).length > 0) {
          updateArrangerClip(clip.id, updates);
        }
      }

      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [arrangerClips, dragState, pixelsPerStep, snapSize, updateArrangerClip]);

  useEffect(() => {
    if (!paintState) {
      return undefined;
    }

    const clearPaint = () => setPaintState(null);
    window.addEventListener('pointerup', clearPaint, { once: true });

    return () => {
      window.removeEventListener('pointerup', clearPaint);
    };
  }, [paintState]);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) {
      return undefined;
    }

    const updateViewport = () => {
      setViewportWidth(node.clientWidth);
      setScrollLeft(node.scrollLeft);
    };

    updateViewport();
    node.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);

    return () => {
      node.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [zoomPreset]);

  useEffect(() => {
    if (!followPlayhead) {
      return;
    }

    const node = timelineRef.current;
    if (!node) {
      return;
    }

    scrollTimelineToStep(node, currentStep, pixelsPerStep, 'nearest');
  }, [currentStep, followPlayhead, pixelsPerStep]);

  useEffect(() => {
    if (!selectedClip) {
      return;
    }

    const node = timelineRef.current;
    if (!node) {
      return;
    }

    const clipMidpoint = selectedClip.startBeat + selectedClip.beatLength / 2;
    scrollTimelineToStep(node, clipMidpoint, pixelsPerStep, 'nearest');
  }, [pixelsPerStep, selectedClip?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      )) {
        return;
      }

      if (!selectedClip) {
        return;
      }

      const shortcutAction = resolveArrangerShortcut(event, selectedClip, snapSize);
      if (!shortcutAction) {
        return;
      }

      event.preventDefault();

      switch (shortcutAction.type) {
        case 'duplicate':
          duplicateArrangerClip(selectedClip.id);
          return;
        case 'make-unique':
          makeClipPatternUnique(selectedClip.id);
          return;
        case 'remove':
          removeArrangerClip(selectedClip.id);
          return;
        case 'move':
          updateArrangerClip(selectedClip.id, { startBeat: Math.max(0, selectedClip.startBeat + shortcutAction.amount) });
          return;
        case 'transpose':
          transformClipPattern(selectedClip.id, 'transpose', shortcutAction.amount);
          return;
        case 'toggle-follow':
          setFollowPlayhead((current) => !current);
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [duplicateArrangerClip, makeClipPatternUnique, removeArrangerClip, selectedClip, snapSize, transformClipPattern, updateArrangerClip]);

  const selectClip = (clipId: string) => {
    const clip = arrangerClips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      return;
    }

    setSelectedArrangerClipId(clip.id);
    setSelectedTrackId(clip.trackId);
    setCurrentPattern(clip.patternIndex);
  };

  const revealSelectedClip = () => {
    if (!selectedClip || !timelineRef.current) {
      return;
    }

    scrollTimelineToStep(
      timelineRef.current,
      selectedClip.startBeat + selectedClip.beatLength / 2,
      pixelsPerStep,
      'center',
    );
  };

  const jumpToPlayhead = () => {
    if (!timelineRef.current) {
      return;
    }

    scrollTimelineToStep(timelineRef.current, currentStep, pixelsPerStep, 'center');
  };

  const jumpToBoundary = (step: number) => {
    if (!timelineRef.current) {
      return;
    }

    scrollTimelineToStep(timelineRef.current, step, pixelsPerStep, 'center');
  };

  const beginClipDrag = (clip: ArrangementClip, event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    selectClip(clip.id);
    setDragState({
      clipId: clip.id,
      mode,
      originX: event.clientX,
      previewBeatLength: clip.beatLength,
      previewStartBeat: clip.startBeat,
      sourceBeatLength: clip.beatLength,
      sourceStartBeat: clip.startBeat,
    });
  };

  const beginPaint = (note: string, stepIndex: number, isActive: boolean) => {
    if (!selectedClip) {
      return;
    }

    const mode: PaintMode = isActive ? 'remove' : 'add';
    setSelectedPhraseStepIndex(stepIndex);
    setSelectedPhraseNoteIndex(0);
    setPaintState({ mode, note });
    toggleClipPatternStep(selectedClip.id, stepIndex, note, mode);
  };

  const continuePaint = (note: string, stepIndex: number) => {
    if (!paintState || !selectedClip || paintState.note !== note) {
      return;
    }

    setSelectedPhraseStepIndex(stepIndex);
    toggleClipPatternStep(selectedClip.id, stepIndex, note, paintState.mode);
  };

  const beginSlicePaint = (stepIndex: number, sliceIndex: number | null, isActive: boolean) => {
    if (!selectedClip || sliceIndex === null) {
      return;
    }

    const mode: PaintMode = isActive ? 'remove' : 'add';
    setSelectedPhraseStepIndex(stepIndex);
    setSelectedPhraseNoteIndex(0);
    setPaintState({ mode, sliceIndex });
    setClipPatternStepSlice(selectedClip.id, stepIndex, mode === 'remove' ? null : sliceIndex);
  };

  const continueSlicePaint = (stepIndex: number) => {
    if (!paintState || !selectedClip || typeof paintState.sliceIndex !== 'number') {
      return;
    }

    setSelectedPhraseStepIndex(stepIndex);
    setClipPatternStepSlice(
      selectedClip.id,
      stepIndex,
      paintState.mode === 'remove' ? null : paintState.sliceIndex,
    );
  };

  const phraseSummary = selectedClip && selectedClipTrack
    ? `${selectedClipTrack.name} · Pattern ${String.fromCharCode(65 + selectedClip.patternIndex)} · ${selectedClip.beatLength} steps · ${selectedPhraseActiveSteps} active`
    : 'Select a clip to compose directly in song view';
  const visibleRangeLabel = getVisibleRangeLabel(visibleStartStep, visibleEndStep);
  const splitBeat = selectedClip
    ? getSplitBeat(selectedClip, currentStep, snapSize, transportMode, MIN_CLIP_LENGTH)
    : null;

  const scrollTimelineByViewport = (direction: -1 | 1) => {
    if (!timelineRef.current) {
      return;
    }

    timelineRef.current.scrollTo({
      behavior: 'smooth',
      left: getViewportScrollLeft(
        timelineRef.current.scrollLeft,
        maxTimelineScrollLeft,
        viewportWidth,
        direction,
      ),
    });
  };

  const handleTimelineWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const node = timelineRef.current;
    if (!node || !shouldHandleTimelineWheel(event.deltaX, event.deltaY, node.scrollWidth, node.clientWidth)) {
      return;
    }

    event.preventDefault();
    node.scrollLeft += event.deltaY;
  };

  return (
    <section className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <ArrangerHeader
        addClip={() => addArrangerClip(selectedTrackId ?? undefined)}
        arrangerClips={arrangerClips}
        compactLaneView={compactLaneView}
        currentStep={currentStep}
        followPlayhead={followPlayhead}
        inspectorOpen={isInspectorOpen}
        laneDataCount={laneData.length}
        laneScope={laneScope}
        markerCount={markerCount}
        onJumpToBoundary={jumpToBoundary}
        onJumpToPlayhead={jumpToPlayhead}
        onRevealSelectedClip={revealSelectedClip}
        onSelectClip={selectClip}
        onSetCompactLaneView={setCompactLaneView}
        onSetFollowPlayhead={setFollowPlayhead}
        onSetInspectorOpen={setIsInspectorOpen}
        onSetInspectorTab={() => setInspectorTab('SECTIONS')}
        onSetLaneScope={setLaneScope}
        onSetSnapSize={setSnapSize}
        onSetZoomPreset={setZoomPreset}
        phraseSummary={phraseSummary}
        sectionCount={sectionRanges.length}
        selectedArrangerClipId={selectedArrangerClipId}
        selectedClip={selectedClip}
        snapOptions={SNAP_OPTIONS}
        snapSize={snapSize}
        songMarkers={songMarkers}
        timelineSteps={timelineSteps}
        totalBars={totalBars}
        totalDurationSeconds={totalDurationSeconds}
        tracks={tracks}
        visibleEndStep={visibleEndStep}
        visibleRangeLabel={visibleRangeLabel}
        visibleStartStep={visibleStartStep}
        zoomPreset={zoomPreset}
      />

      <div className={`grid min-h-0 flex-1 gap-4 p-5 ${isInspectorOpen ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        <ArrangerInspector
          collapsedGroups={collapsedGroups}
          composerStepCount={composerStepCount}
          composerSteps={composerSteps}
          createSongMarker={createSongMarker}
          currentStep={currentStep}
          duplicateArrangerClip={duplicateArrangerClip}
          duplicateSongRange={duplicateSongRange}
          inspectorTab={inspectorTab}
          isOpen={isInspectorOpen}
          isStepMappedSampleTrack={isStepMappedSampleTrack}
          laneSections={laneSections}
          linkedPhraseCount={linkedPhraseCount}
          loopArrangerClip={loopArrangerClip}
          loopRangeEndBeat={loopRangeEndBeat}
          loopRangeStartBeat={loopRangeStartBeat}
          makeClipPatternUnique={makeClipPatternUnique}
          markerCount={markerCount}
          onBeginPaint={beginPaint}
          onBeginSlicePaint={beginSlicePaint}
          onContinuePaint={continuePaint}
          onContinueSlicePaint={continueSlicePaint}
          onJumpToBoundary={jumpToBoundary}
          onRemoveSongMarker={removeSongMarker}
          onSelectSampleSlice={selectSampleSlice}
          onSetActiveView={setActiveView}
          onSetCurrentPattern={setCurrentPattern}
          onSetInspectorTab={setInspectorTab}
          onSetLoopRange={setLoopRange}
          onSetSelectedPhraseNoteIndex={setSelectedPhraseNoteIndex}
          onSetSelectedPhraseStepIndex={setSelectedPhraseStepIndex}
          onSetSelectedTrackId={setSelectedTrackId}
          onToggleCollapsedGroup={(key) => setCollapsedGroups((current) => ({ ...current, [key]: !current[key] }))}
          onToggleClipPatternStep={toggleClipPatternStep}
          onTransformClipPattern={transformClipPattern}
          onUpdateSongMarker={updateSongMarker}
          phraseRows={phraseRows}
          phraseSummary={phraseSummary}
          removeArrangerClip={removeArrangerClip}
          sectionRanges={sectionRanges}
          selectedAutomationLevel={selectedAutomationLevel}
          selectedAutomationTone={selectedAutomationTone}
          selectedClip={selectedClip}
          selectedClipAutomation={selectedClipAutomation}
          selectedClipTrack={selectedClipTrack}
          selectedPhraseNote={selectedPhraseNote}
          selectedPhraseNoteIndex={normalizedSelectedPhraseNoteIndex}
          selectedPhraseSliceIndex={selectedPhraseSliceIndex}
          selectedPhraseStep={selectedPhraseStep}
          selectedPhraseStepIndex={selectedPhraseStepIndex}
          setClipPatternStepSlice={setClipPatternStepSlice}
          songMarkers={songMarkers}
          splitArrangerClip={splitArrangerClip}
          splitBeat={splitBeat}
          updateClipPatternAutomationStep={updateClipPatternAutomationStep}
          updateClipPatternStepEvent={updateClipPatternStepEvent}
        />

        <ArrangerTimeline
          clipHeightClass={clipHeightClass}
          collapsedGroups={collapsedGroups}
          currentStep={currentStep}
          getRenderedClipFrame={(clip) => getRenderedClipFrame(clip, dragState)}
          handleTimelineWheel={handleTimelineWheel}
          inspectorOpen={isInspectorOpen}
          laneDataCount={laneData.length}
          laneHeightClass={laneHeightClass}
          laneLabelWidth={laneLabelWidth}
          laneSections={laneSections}
          maxTimelineScrollLeft={maxTimelineScrollLeft}
          onBeginClipDrag={beginClipDrag}
          onMoveTrack={moveTrack}
          onScrollTimelineByViewport={scrollTimelineByViewport}
          onSelectClip={selectClip}
          onSetInspectorOpen={setIsInspectorOpen}
          onSetOpenLaneMenuTrackId={setOpenLaneMenuTrackId}
          onSetSelectedTrackId={setSelectedTrackId}
          onToggleCollapsedGroup={(key) => setCollapsedGroups((current) => ({ ...current, [key]: !current[key] }))}
          onToggleMute={toggleMute}
          onTogglePinnedTrack={togglePinnedTrack}
          onToggleSolo={toggleSolo}
          openLaneMenuTrackId={openLaneMenuTrackId}
          phraseSummary={phraseSummary}
          pinnedTrackIds={pinnedTrackIds}
          pixelsPerStep={pixelsPerStep}
          scrollLeft={scrollLeft}
          selectedArrangerClipId={selectedArrangerClipId}
          selectedClip={selectedClip}
          selectedTrackId={selectedTrackId}
          setScrollStripPosition={(value) => {
            if (!timelineRef.current) {
              return;
            }

            timelineRef.current.scrollLeft = value;
          }}
          snapSize={snapSize}
          timelineRef={timelineRef}
          timelineSteps={timelineSteps}
          timelineWidth={timelineWidth}
          totalBars={totalBars}
          visibleEndStep={visibleEndStep}
          visibleStartStep={visibleStartStep}
          zoomPreset={zoomPreset}
        />
      </div>
    </section>
  );
};
