import React, { useEffect, useRef, useState } from 'react';

export const BrandMark = ({
  className = 'h-5 w-5',
  speed = 1,
  amplitude = 1,
}: {
  className?: string;
  speed?: number;
  amplitude?: number;
}) => {
  const [phase, setPhase] = useState(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mediaQuery.matches;
    if (reducedRef.current) {
      return undefined;
    }

    let animationFrame = 0;
    let startTime = 0;
    const tick = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      setPhase(((timestamp - startTime) / 1000) * speed);
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [speed]);

  const buildPath = (
    yMid: number,
    amp: number,
    freq: number,
    phaseOffset: number,
  ) => {
    const steps = 28;
    const xStart = 16;
    const width = 32;
    const scaledAmplitude = amp * amplitude;
    let path = `M ${xStart} ${yMid + Math.sin(phase + phaseOffset) * scaledAmplitude}`;

    for (let index = 1; index <= steps; index += 1) {
      const x = xStart + (index / steps) * width;
      const y = yMid + Math.sin(phase * 1.4 + phaseOffset + (index / steps) * freq * Math.PI * 2) * scaledAmplitude;
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }

    return path;
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="currentColor"
        fillOpacity="0.08"
        height="52"
        rx="10"
        width="52"
        x="6"
        y="6"
      />
      <path
        d={buildPath(22, 3, 1.6, 0)}
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.45"
        strokeWidth="4.5"
      />
      <path
        d={buildPath(32, 3.4, 1.4, 1.1)}
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.75"
        strokeWidth="4.5"
      />
      <path
        d={buildPath(42, 3.6, 1.2, 2.3)}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4.5"
      />
    </svg>
  );
};
