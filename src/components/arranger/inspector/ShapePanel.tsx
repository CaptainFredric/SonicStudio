import React from 'react';
import { Braces, Copy, Eraser, Layers3, Minus, MoveHorizontal, PencilLine, Plus, Scissors, Trash2, Wand2 } from 'lucide-react';

interface ShapePanelProps {
  clipId: string;
  loopArrangerClip: (clipId: string, repeats: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  onTransformClipPattern: (clipId: string, transform: string, amount?: number) => void;
  removeArrangerClip: (clipId: string) => void;
  splitArrangerClip: (clipId: string, splitBeat: number) => void;
  splitBeat: number | null;
}

export const ShapePanel = ({
  clipId,
  loopArrangerClip,
  makeClipPatternUnique,
  onTransformClipPattern,
  removeArrangerClip,
  splitArrangerClip,
  splitBeat,
}: ShapePanelProps) => (
  <div className="mt-4 grid gap-4">
    <div className="grid gap-3">
      <div>
        <div className="section-label">Clip</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <InspectorActionButton icon={<Braces className="h-3.5 w-3.5" />} label="Make unique" onClick={() => makeClipPatternUnique(clipId)} />
          <InspectorActionButton
            icon={<Scissors className="h-3.5 w-3.5" />}
            label="Split at playhead"
            onClick={() => {
              if (splitBeat !== null) {
                splitArrangerClip(clipId, splitBeat);
              }
            }}
          />
          <button
            className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)] sm:col-span-2"
            onClick={() => removeArrangerClip(clipId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove clip
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Movement</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <InspectorActionButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift left" onClick={() => onTransformClipPattern(clipId, 'shift-left')} />
          <InspectorActionButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift right" onClick={() => onTransformClipPattern(clipId, 'shift-right')} />
          <InspectorActionButton icon={<Minus className="h-3.5 w-3.5" />} label="Semitone down" onClick={() => onTransformClipPattern(clipId, 'transpose', -1)} />
          <InspectorActionButton icon={<Plus className="h-3.5 w-3.5" />} label="Semitone up" onClick={() => onTransformClipPattern(clipId, 'transpose', 1)} />
          <InspectorActionButton icon={<Minus className="h-3.5 w-3.5" />} label="Octave down" onClick={() => onTransformClipPattern(clipId, 'transpose', -12)} />
          <InspectorActionButton icon={<Plus className="h-3.5 w-3.5" />} label="Octave up" onClick={() => onTransformClipPattern(clipId, 'transpose', 12)} />
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] pt-3">
        <div className="section-label">Structure</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <InspectorActionButton icon={<Layers3 className="h-3.5 w-3.5" />} label="Repeat x4" onClick={() => loopArrangerClip(clipId, 3)} />
          <InspectorActionButton icon={<Copy className="h-3.5 w-3.5" />} label="Double density" onClick={() => onTransformClipPattern(clipId, 'double-density')} />
          <InspectorActionButton icon={<Eraser className="h-3.5 w-3.5" />} label="Halve density" onClick={() => onTransformClipPattern(clipId, 'halve-density')} />
          <InspectorActionButton icon={<Eraser className="h-3.5 w-3.5" />} label="Clear phrase" onClick={() => onTransformClipPattern(clipId, 'clear')} />
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] pt-3">
        <div className="section-label">Dynamics</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <InspectorActionButton icon={<Wand2 className="h-3.5 w-3.5" />} label="Randomize velocity" onClick={() => onTransformClipPattern(clipId, 'randomize-velocity')} />
          <InspectorActionButton icon={<PencilLine className="h-3.5 w-3.5" />} label="Reset automation" onClick={() => onTransformClipPattern(clipId, 'reset-automation')} />
        </div>
      </div>
    </div>
  </div>
);

const InspectorActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);
