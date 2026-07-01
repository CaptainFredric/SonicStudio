import { useEffect, useRef } from 'react';

import { engine } from '../audio/ToneEngine';

// A thin live spectrum that sits under the transport buttons, so pressing Play
// visibly moves the music. It reads the engine's dedicated spectrum analyser
// (separate from the device-rack scope) and only animates while playing: when
// playback stops the bars settle to a resting line and the animation loop ends,
// so an idle tab costs nothing.

const BAR_COUNT = 32;

// A clearly visible but low center-weighted resting shape, so a stopped strip
// reads as a quiet equalizer at its noise floor rather than an empty box.
const idleProfile = (bar: number): number => 0.16 + 0.1 * Math.sin((Math.PI * bar) / (BAR_COUNT - 1));

// dB floor that counts as silence; values climb toward 0 dB at full output.
const DB_FLOOR = 80;

// Fold an FFT magnitude buffer (decibels) into bar heights in 0..1. Pure and
// exported so the dB mapping is unit-tested without a live AudioContext, which
// the headless preview cannot start.
export const spectrumToBars = (
  values: Float32Array | number[],
  barCount: number,
  dbFloor: number = DB_FLOOR,
): number[] => {
  // The top FFT bins sit near silence for most music, so map the lower portion
  // of the range across the strip for a fuller picture.
  const usable = Math.max(1, Math.floor(values.length * 0.78));
  const bars: number[] = [];
  for (let bar = 0; bar < barCount; bar += 1) {
    const start = Math.floor((bar / barCount) * usable);
    const end = Math.max(start + 1, Math.floor(((bar + 1) / barCount) * usable));
    let peak = -Infinity;
    for (let index = start; index < end; index += 1) {
      const value = values[index];
      if (Number.isFinite(value) && value > peak) {
        peak = value;
      }
    }
    const normalized = peak === -Infinity ? 0 : Math.max(0, Math.min(1, (peak + dbFloor) / dbFloor));
    // A gentle curve lifts quiet detail without blowing out loud bars.
    bars.push(normalized ** 0.7);
  }
  return bars;
};

// How far a peak-hold cap falls per frame once the bar drops beneath it.
const PEAK_FALL = 0.014;

// Peak-hold: a cap jumps instantly to a new bar peak, then sinks under a little
// gravity, so transients leave a briefly hanging marker. Never falls below the
// current bar. Pure and exported for unit testing alongside spectrumToBars.
export const decayPeaks = (
  peaks: number[],
  levels: number[],
  fall: number = PEAK_FALL,
): number[] => levels.map((level, bar) => Math.max(level, (peaks[bar] ?? level) - fall));

interface TransportSpectrumProps {
  active: boolean;
  className?: string;
}

const readPalette = () => {
  const superSonic = document.documentElement.dataset.supersonic === 'true';
  return superSonic
    ? { top: '#d8456a', bottom: '#7c1b2f' }
    : { top: '#9be8ff', bottom: '#2f9bd6' };
};

export const TransportSpectrum = ({ active, className }: TransportSpectrumProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Smoothed bar heights persist across active/idle transitions so the strip
  // eases between states instead of snapping.
  const levelsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, (_, bar) => idleProfile(bar)));
  // Peak-hold caps track the recent maximum of each bar and fall slowly.
  const peaksRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, (_, bar) => idleProfile(bar)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let frameId = 0;

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.clientWidth || 240;
      const cssHeight = canvas.clientHeight || 30;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Resizing clears the backing store, so repaint the current bars. Without
      // this an idle strip (no animation loop running) wipes blank when the
      // ResizeObserver's first callback fires just after the initial draw.
      render();
    };

    const sampleBars = (): number[] => {
      const spectrum = engine.spectrum;
      if (!spectrum) {
        return levelsRef.current.map((_, bar) => idleProfile(bar));
      }
      return spectrumToBars(spectrum.getValue() as Float32Array, BAR_COUNT);
    };

    const render = () => {
      const width = canvas.clientWidth || 240;
      const height = canvas.clientHeight || 30;
      const palette = readPalette();

      ctx.clearRect(0, 0, width, height);

      const gap = 2;
      const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const levels = levelsRef.current;
      const peaks = peaksRef.current;

      for (let bar = 0; bar < BAR_COUNT; bar += 1) {
        const level = levels[bar];
        const barHeight = Math.max(1.5, level * height);
        const x = bar * (barWidth + gap);
        const y = height - barHeight;

        const gradient = ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, palette.top);
        gradient.addColorStop(1, palette.bottom);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.5 + level * 0.5;

        const radius = Math.min(barWidth / 2, 1.5);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();

        // Peak-hold cap: a bright sliver at the bar's recent maximum.
        const capCenter = height - Math.max(barHeight, peaks[bar] * height);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette.top;
        ctx.fillRect(x, Math.max(0, Math.min(height - 2, capCenter - 1)), barWidth, 2);
      }
      ctx.globalAlpha = 1;
    };

    sizeCanvas();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sizeCanvas)
      : null;
    resizeObserver?.observe(canvas);

    // While playing, chase the live spectrum. When stopped, ease every bar back
    // to the resting line and end the loop once it has settled.
    const FRAME_MS = 1000 / 32;
    let lastFrame = 0;
    const step = (now: number) => {
      // rAF fires at the display's refresh rate, which can be 120Hz. Sampling
      // the FFT and repainting the canvas that often is main-thread time the
      // audio scheduler needs to stay ahead, so gate the real work to ~32fps
      // and let the extra frames fall straight through. Cheap insurance
      // against playback stutter on weaker machines.
      if (now - lastFrame < FRAME_MS) {
        frameId = requestAnimationFrame(step);
        return;
      }
      lastFrame = now;
      const levels = levelsRef.current;
      const targets = active && !reduceMotion ? sampleBars() : null;
      let moving = false;

      for (let bar = 0; bar < BAR_COUNT; bar += 1) {
        const target = targets ? targets[bar] : idleProfile(bar);
        // Fall faster than it rises so peaks pop and decays read as natural.
        const ease = target > levels[bar] ? 0.5 : 0.18;
        levels[bar] += (target - levels[bar]) * ease;
        if (Math.abs(target - levels[bar]) > 0.004) {
          moving = true;
        }
      }

      // Caps ride above the bars, so the loop must keep running while any cap is
      // still falling toward its bar, even after the bars themselves have settled.
      const peaks = decayPeaks(peaksRef.current, levels);
      peaksRef.current = peaks;
      for (let bar = 0; bar < BAR_COUNT; bar += 1) {
        if (peaks[bar] - levels[bar] > 0.004) {
          moving = true;
        }
      }

      render();

      if (active && !reduceMotion) {
        frameId = requestAnimationFrame(step);
      } else if (moving) {
        frameId = requestAnimationFrame(step);
      } else {
        // Settled at rest: draw the final frame and stop burning animation.
        for (let bar = 0; bar < BAR_COUNT; bar += 1) {
          levels[bar] = idleProfile(bar);
          peaksRef.current[bar] = idleProfile(bar);
        }
        render();
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [active]);

  return (
    <canvas
      aria-hidden="true"
      className={className}
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '30px' }}
    />
  );
};
