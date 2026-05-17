import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAudio, usePlaybackStep } from '../context/AudioContext';
import { type ArrangementClip } from '../project/schema';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ArrangerHeader } from './arranger/ArrangerHeader';
import { ArrangerInspector } from './arranger/ArrangerInspector';
import { buildLaneData, buildLaneSections, buildSectionRanges, isDrumTrack } from './arranger/arrangerSelectors';
import { ArrangerTimeline } from './arranger/ArrangerTimeline';
import { useArrangerClipDrag } from './arranger/useArrangerClipDrag';
import { useArrangerPaint } from './arranger/useArrangerPaint';
import { useArrangerShortcuts } from './arranger/useArrangerShortcuts';
import { useArrangerViewport } from './arranger/useArrangerViewport';
import type { InspectorTab, LaneScope, LaneSectionKey, SnapSize, ZoomPreset } from './arranger/types';
import {
  getRenderedClipFrame,
  getSplitBeat,
} from './arranger/interactionUtils';
import { buildComposerRows, getComposerStepCount } from './arranger/noteUtils';

const DEFAULT_SNAP = 4;
const MIN_CLIP_LENGTH = 4;
const ARRANGER_RUNWAY_STEPS = 6;
export const ZOOM_PIXELS_PER_STEP: Record<ZoomPreset, number> = {
  PHRASE: 30,
  SECTION: 18,
  SONG: 10,
  FIT: 18,
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

export const Arranger = () => {
  const isMobileViewport = useMediaQuery('(max-width: 767px)');
  const currentStep = usePlaybackStep();
  const {
    addArrangerClip,
    applySongForm,
    arrangerClips,
    bpm,
    createSongMarker,
    currentPattern,
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
    setStepsPerPattern,
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
    superSonicMode,
    superSonicPreferences,
    updateArrangerClip,
    updateClipPatternAutomationStep,
    updateClipPatternStepEvent,
    updateSongMarker,
    removeSongMarker,
  } = useAudio();
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
  const [compactLaneView, setCompactLaneView] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('SECTION');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('COMPOSE');
  const [isInspectorOpen, setIsInspectorOpen] = useState(() => !(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  const [openLaneMenuTrackId, setOpenLaneMenuTrackId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedSelectedClipRef = useRef(false);
  const previousSelectedClipIdRef = useRef<string | null>(null);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState(0);
  const [customPixelsPerStep, setCustomPixelsPerStep] = useState<number | null>(null);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setTimelineContainerWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setTimelineContainerWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const presetPixelsPerStep = ZOOM_PIXELS_PER_STEP[zoomPreset];
  const songLengthSteps = Math.max(songLengthInBeats, 32);
  const fitPixelsPerStep = timelineContainerWidth > 0
    ? Math.max(4, Math.min(80, Math.floor(timelineContainerWidth / Math.max(1, songLengthSteps))))
    : presetPixelsPerStep;
  const pixelsPerStep = customPixelsPerStep ?? (zoomPreset === 'FIT' ? fitPixelsPerStep : presetPixelsPerStep);

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
  const timelineSteps = songLengthSteps;
  const timelineRunwayWidth = Math.max(108, ARRANGER_RUNWAY_STEPS * pixelsPerStep);
  const timelineWidth = (timelineSteps * pixelsPerStep) + timelineRunwayWidth;
  const { beginClipDrag, dragState } = useArrangerClipDrag({
    arrangerClips,
    minClipLength: MIN_CLIP_LENGTH,
    onSelectClip: (clipId) => {
      const clip = arrangerClips.find((candidate) => candidate.id === clipId);
      if (!clip) {
        return;
      }

      setSelectedArrangerClipId(clip.id);
      setSelectedTrackId(clip.trackId);
      setCurrentPattern(clip.patternIndex);
    },
    pixelsPerStep,
    snapSize,
    updateArrangerClip,
  });
  const {
    beginPaint,
    beginSlicePaint,
    continuePaint,
    continueSlicePaint,
  } = useArrangerPaint({
    selectedClipId: selectedClip?.id ?? null,
    setClipPatternStepSlice,
    setSelectedPhraseNoteIndex,
    setSelectedPhraseStepIndex,
    toggleClipPatternStep,
  });
  const {
    handleTimelineWheel: baseHandleTimelineWheel,
    jumpToStep,
    scrollLeft,
    scrollTimelineByViewport,
    setScrollStripPosition,
    viewportWidth,
  } = useArrangerViewport({
    currentStep,
    followPlayhead,
    pixelsPerStep,
    selectedClip,
    timelineRef,
    timelineWidth,
  });
  const adjustPixelsPerStep = useCallback((delta: number, anchorRatio = 0.5) => {
    const node = timelineRef.current;
    const previousPx = pixelsPerStep;
    const nextPx = Math.max(4, Math.min(80, previousPx + delta));
    if (Math.abs(nextPx - previousPx) < 0.5) return;
    setCustomPixelsPerStep(nextPx);
    if (node) {
      const anchor = node.scrollLeft + node.clientWidth * anchorRatio;
      const scaledAnchor = (anchor / previousPx) * nextPx;
      requestAnimationFrame(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollLeft = Math.max(0, scaledAnchor - node.clientWidth * anchorRatio);
        }
      });
    }
  }, [pixelsPerStep]);

  const handleTimelineWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
      adjustPixelsPerStep(-event.deltaY * 0.18, ratio);
      return;
    }
    baseHandleTimelineWheel(event);
  }, [adjustPixelsPerStep, baseHandleTimelineWheel]);

  const totalBars = formatBars(timelineSteps);
  const totalDurationSeconds = songLengthInBeats * (60 / bpm) * 0.25;
  const visibleStartStep = Math.floor(scrollLeft / pixelsPerStep);
  const visibleEndStep = Math.min(timelineSteps, Math.ceil((scrollLeft + viewportWidth) / pixelsPerStep));
  const maxTimelineScrollLeft = Math.max(0, timelineWidth - viewportWidth);
  const selectedPhraseActiveSteps = selectedClipPattern.filter((step) => step.length > 0).length;
  const selectedPhraseNoteCount = selectedClipPattern.reduce((sum, step) => sum + step.length, 0);
  const selectedAutomationLevel = selectedClipAutomation.level[selectedPhraseStepIndex] ?? 0.5;
  const selectedAutomationTone = selectedClipAutomation.tone[selectedPhraseStepIndex] ?? 0.5;
  const selectedPhraseSliceIndex = selectedPhraseStep[0]?.sampleSliceIndex ?? null;
  const hiddenPatternContent = useMemo(() => {
    const relevantPatternIndices = new Set<number>([currentPattern]);
    arrangerClips.forEach((clip) => {
      relevantPatternIndices.add(clip.patternIndex);
    });

    let hiddenNoteCount = 0;
    let requiredSteps = stepsPerPattern;

    tracks.forEach((track) => {
      Object.keys(track.patterns).forEach((patternKey) => {
        const patternIndex = Number(patternKey);
        const patternSteps = track.patterns[patternIndex] ?? [];
        if (!relevantPatternIndices.has(patternIndex)) {
          return;
        }

        for (let stepIndex = stepsPerPattern; stepIndex < patternSteps.length; stepIndex += 1) {
          const step = patternSteps[stepIndex] ?? [];
          if (step.length === 0) {
            continue;
          }

          hiddenNoteCount += step.length;
          requiredSteps = Math.max(requiredSteps, stepIndex + 1);
        }
      });
    });

    return {
      hiddenNoteCount,
      requiredSteps: Math.min(4096, Math.max(16, requiredSteps)),
    };
  }, [arrangerClips, currentPattern, stepsPerPattern, tracks]);
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
  const laneLabelWidth = isMobileViewport
    ? (compactLaneView ? 176 : 200)
    : compactLaneView ? 196 : 232;
  const laneHeightClass = isMobileViewport
    ? (compactLaneView ? 'h-14' : 'h-16')
    : compactLaneView ? 'h-16' : 'h-20';
  const clipHeightClass = isMobileViewport
    ? (compactLaneView ? 'h-10' : 'h-12')
    : compactLaneView ? 'h-12' : 'h-14';

  useEffect(() => {
    if (!isMobileViewport) {
      return;
    }

    setCompactLaneView(true);
    setIsInspectorOpen(false);
  }, [isMobileViewport]);

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
    const nextClipId = selectedClip?.id ?? null;

    if (!hasTrackedSelectedClipRef.current) {
      hasTrackedSelectedClipRef.current = true;
      previousSelectedClipIdRef.current = nextClipId;
      return;
    }

    const previousClipId = previousSelectedClipIdRef.current;
    previousSelectedClipIdRef.current = nextClipId;

    if (selectedClip && selectedClip.id !== previousClipId && inspectorTab === 'SHAPE') {
      setInspectorTab('COMPOSE');
    }
  }, [inspectorTab, selectedClip?.id]);

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
  useArrangerShortcuts({
    duplicateArrangerClip,
    makeClipPatternUnique,
    removeArrangerClip,
    selectedClip,
    setFollowPlayhead,
    snapSize,
    transformClipPattern,
    updateArrangerClip,
  });

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
    if (!selectedClip) {
      return;
    }

    jumpToStep(selectedClip.startBeat + selectedClip.beatLength / 2, 'center');
  };

  const jumpToPlayhead = () => {
    jumpToStep(currentStep, 'center');
  };

  const jumpToBoundary = (step: number) => {
    jumpToStep(step, 'center');
  };

  const phraseSummary = selectedClip && selectedClipTrack
    ? `${selectedClipTrack.name} · Pattern ${String.fromCharCode(65 + selectedClip.patternIndex)} · ${selectedClip.beatLength} steps · ${selectedPhraseActiveSteps} active`
    : 'Pick a clip to edit it here';
  const visibleRangeLabel = getVisibleRangeLabel(visibleStartStep, visibleEndStep);
  const splitBeat = selectedClip
    ? getSplitBeat(selectedClip, currentStep, snapSize, transportMode, MIN_CLIP_LENGTH)
    : null;

  return (
    <section className="surface-panel arranger-surface flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <ArrangerHeader
        addClip={() => addArrangerClip(selectedTrackId ?? undefined)}
        onAddMarkerAtPlayhead={() => createSongMarker(currentStep)}
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
        onApplySongForm={applySongForm}
        onRevealSelectedClip={revealSelectedClip}
        onSelectClip={selectClip}
        onSetCompactLaneView={setCompactLaneView}
        onSetFollowPlayhead={setFollowPlayhead}
        onSetInspectorOpen={setIsInspectorOpen}
        onSetInspectorTab={() => setInspectorTab('SECTIONS')}
        onSetLaneScope={setLaneScope}
        onSetSnapSize={setSnapSize}
        onSetZoomPreset={(value) => { setZoomPreset(value); setCustomPixelsPerStep(null); }}
        phraseSummary={phraseSummary}
        sectionCount={sectionRanges.length}
        hiddenOverflowNoteCount={hiddenPatternContent.hiddenNoteCount}
        hiddenOverflowRequiredSteps={hiddenPatternContent.requiredSteps}
        onRestoreOverflowLength={() => setStepsPerPattern(hiddenPatternContent.requiredSteps)}
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
        showSuperSonicGuidance={superSonicMode && superSonicPreferences.guidanceBadges}
        superSonicMode={superSonicMode}
      />

      <div className={`arranger-layout grid min-h-0 flex-1 gap-4 p-5 ${isInspectorOpen ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        <ArrangerInspector
          applySongForm={applySongForm}
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
          onPinchZoom={adjustPixelsPerStep}
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
          setScrollStripPosition={setScrollStripPosition}
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
