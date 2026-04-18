import { useEffect, useState } from 'react';
import type React from 'react';

import type { ArrangementClip } from '../../project/schema';
import { getViewportScrollLeft, shouldHandleTimelineWheel } from './interactionUtils';

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

interface UseArrangerViewportOptions {
  currentStep: number;
  followPlayhead: boolean;
  pixelsPerStep: number;
  selectedClip: ArrangementClip | null;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  timelineWidth: number;
}

export const useArrangerViewport = ({
  currentStep,
  followPlayhead,
  pixelsPerStep,
  selectedClip,
  timelineRef,
  timelineWidth,
}: UseArrangerViewportOptions) => {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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
  }, [timelineRef, pixelsPerStep]);

  useEffect(() => {
    if (!followPlayhead) {
      return;
    }

    const node = timelineRef.current;
    if (!node) {
      return;
    }

    scrollTimelineToStep(node, currentStep, pixelsPerStep, 'nearest');
  }, [currentStep, followPlayhead, pixelsPerStep, timelineRef]);

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
  }, [pixelsPerStep, selectedClip?.id, timelineRef]);

  const jumpToStep = (step: number, align: 'center' | 'nearest' = 'center') => {
    if (!timelineRef.current) {
      return;
    }

    scrollTimelineToStep(timelineRef.current, step, pixelsPerStep, align);
  };

  const scrollTimelineByViewport = (direction: -1 | 1) => {
    if (!timelineRef.current) {
      return;
    }

    const maxTimelineScrollLeft = Math.max(0, timelineWidth - viewportWidth);
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

  const setScrollStripPosition = (value: number) => {
    if (!timelineRef.current) {
      return;
    }

    timelineRef.current.scrollLeft = value;
  };

  return {
    handleTimelineWheel,
    jumpToStep,
    scrollLeft,
    scrollTimelineByViewport,
    setScrollStripPosition,
    viewportWidth,
  };
};
