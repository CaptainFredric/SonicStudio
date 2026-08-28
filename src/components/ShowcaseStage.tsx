import { ArrowRight, Download, Layers3, Pause, Play, Share2, SlidersHorizontal } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useAudio } from '../context/AudioContext';

const TRACK_ROWS = [
  { color: '#70dcff', name: 'Glass pad', steps: [0, 3, 6, 9, 12, 15] },
  { color: '#ff9d73', name: 'Kick', steps: [0, 4, 8, 10, 12] },
  { color: '#f5cf72', name: 'Snare', steps: [4, 12] },
  { color: '#a9e77f', name: 'Hi hat', steps: [0, 2, 4, 6, 8, 10, 12, 14] },
  { color: '#c49cff', name: 'Bass', steps: [0, 3, 7, 8, 11, 14] },
];

interface ShowcaseStageProps {
  onEnterStudio: () => void;
  onOpenShare: () => void;
}

export const ShowcaseStage = ({ onEnterStudio, onOpenShare }: ShowcaseStageProps) => {
  const { isPlaying, togglePlay } = useAudio();

  return (
    <section aria-labelledby="showcase-stage-title" className="showcase-stage surface-panel min-h-[520px] overflow-hidden">
      <div className="showcase-stage-glow" />
      <div className="relative z-[1] grid min-h-[520px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.25fr)] lg:items-center lg:p-8">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="showcase-badge">Handshake Featured</span>
            <span className="showcase-badge" data-tone="quiet">Built with Codex</span>
          </div>
          <p className="section-label mt-6 text-[var(--accent)]">Browser native music production</p>
          <h1 className="mt-3 max-w-[13ch] text-[clamp(2rem,7vw,4.8rem)] font-semibold leading-[0.95] tracking-[-0.055em]" id="showcase-stage-title">
            Hear the song. Then open the machine.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[14px] leading-7 text-[var(--text-secondary)] sm:text-[15px]">
            Night Transit is a complete six section arrangement. Listen first, then enter the same local first studio to edit rhythm, pitch, structure, sound, and mix.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="showcase-primary-action" data-tour-target="play" onClick={() => void togglePlay()} type="button">
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {isPlaying ? 'Pause Night Transit' : 'Play Night Transit'}
            </button>
            <button className="showcase-secondary-action" onClick={onEnterStudio} type="button">
              Enter full studio <ArrowRight className="h-4 w-4" />
            </button>
            <button aria-label="Share Night Transit" className="showcase-icon-action" data-tour-target="share" onClick={onOpenShare} title="Share Night Transit" type="button">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-2">
            <div className="showcase-stat"><dt>Song form</dt><dd>6 sections</dd></div>
            <div className="showcase-stat"><dt>Workflow</dt><dd>Local first</dd></div>
            <div className="showcase-stat"><dt>Outputs</dt><dd>MIDI + WAV</dd></div>
          </dl>
        </div>

        <div className="showcase-console" data-tour-target="views">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Night Transit</p><p className="mt-1 text-[13px] font-semibold">Pattern grid · section A</p></div>
            <div className="showcase-console-status"><span className={isPlaying ? 'showcase-live-dot' : ''} />{isPlaying ? 'Playing' : 'Ready'}</div>
          </div>
          <div className="p-3 sm:p-4">
            <div className="showcase-step-ruler"><span /><span>1</span><span>2</span><span>3</span><span>4</span></div>
            <div className="space-y-1.5">
              {TRACK_ROWS.map((track) => (
                <div className="showcase-track-row" key={track.name}>
                  <div className="showcase-track-name"><span style={{ backgroundColor: track.color }} />{track.name}</div>
                  <div className="showcase-step-grid" style={{ '--track-color': track.color } as CSSProperties}>
                    {Array.from({ length: 16 }, (_, index) => <span data-on={track.steps.includes(index) ? 'true' : undefined} key={index} />)}
                  </div>
                </div>
              ))}
            </div>
            <div className="showcase-form-line" aria-hidden="true">
              {['Intro', 'A', 'B', 'Bridge', 'A2', 'Outro'].map((section, index) => <span data-accent={index === 1 ? 'true' : undefined} key={section}>{section}</span>)}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="showcase-capability"><Layers3 className="h-4 w-4" /><span><strong>Arrange</strong> six connected sections</span></div>
              <div className="showcase-capability"><SlidersHorizontal className="h-4 w-4" /><span><strong>Shape</strong> every lane and note</span></div>
              <div className="showcase-capability"><Download className="h-4 w-4" /><span><strong>Finish</strong> with portable exports</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
