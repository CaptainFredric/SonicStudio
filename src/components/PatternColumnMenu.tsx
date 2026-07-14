import {
  ArrowLeft,
  ArrowRight,
  CopyPlus,
  Eraser,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { MAX_STEPS_PER_PATTERN, MIN_STEPS_PER_PATTERN } from '../project/schema';
import type { PatternColumnOperation } from '../utils/patternColumnEditing';

interface PatternColumnMenuProps {
  currentPattern: number;
  onOpenChange: (open: boolean) => void;
  onOperation: (operation: PatternColumnOperation) => void;
  open: boolean;
  selected: boolean;
  stepIndex: number;
  stepsPerPattern: number;
}

interface MenuActionProps {
  detail: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger';
}

const MenuAction = ({ detail, disabled = false, icon, label, onClick, tone }: MenuActionProps) => (
  <button
    className="step-column-menu-action"
    data-tone={tone}
    disabled={disabled}
    onClick={onClick}
    role="menuitem"
    type="button"
  >
    <span className="step-column-menu-action-icon">{icon}</span>
    <span className="min-w-0 text-left">
      <span className="block text-[11px] font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="mt-0.5 block text-[9px] text-[var(--text-tertiary)]">{detail}</span>
    </span>
  </button>
);

export const PatternColumnMenu = ({
  currentPattern,
  onOpenChange,
  onOperation,
  open,
  selected,
  stepIndex,
  stepsPerPattern,
}: PatternColumnMenuProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPlacement, setPopoverPlacement] = useState<{ left: number; top: number; width: number } | null>(null);
  const patternLabel = String.fromCharCode(65 + currentPattern);
  const canGrow = stepsPerPattern < MAX_STEPS_PER_PATTERN;
  const canShrink = stepsPerPattern > MIN_STEPS_PER_PATTERN;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const cell = triggerRef.current?.closest('.step-ruler-cell');
      const grid = triggerRef.current?.closest('.sequencer-grid-scroll');
      if (!triggerRect || !(cell instanceof HTMLElement)) return;

      const cellRect = cell.getBoundingClientRect();
      const gridRect = grid?.getBoundingClientRect();
      const menuWidth = Math.min(244, window.innerWidth - 24);
      const menuHeight = popoverRef.current?.getBoundingClientRect().height ?? 302;
      const viewportLeft = 12;
      const viewportRight = window.innerWidth - 12;
      const gridLeft = Math.max(viewportLeft, (gridRect?.left ?? 4) + 8);
      const gridRight = Math.min(viewportRight, (gridRect?.right ?? window.innerWidth - 4) - 8);
      const gridCanFitMenu = gridRight - gridLeft >= menuWidth;
      const leftBound = gridCanFitMenu ? gridLeft : viewportLeft;
      const rightBound = gridCanFitMenu ? gridRight : viewportRight;
      const centeredLeft = triggerRect.left + (triggerRect.width / 2) - (menuWidth / 2);
      const nextLeft = Math.min(
        Math.max(centeredLeft, leftBound),
        Math.max(leftBound, rightBound - menuWidth),
      );
      const belowTop = cellRect.bottom + 6;
      const aboveTop = cellRect.top - menuHeight - 6;
      const fitsBelow = belowTop + menuHeight <= window.innerHeight - 12;
      const fitsAbove = aboveTop >= 12;
      const fallbackTop = cellRect.top - 12 > window.innerHeight - cellRect.bottom - 12
        ? aboveTop
        : belowTop;
      const nextTop = fitsBelow
        ? belowTop
        : fitsAbove
          ? aboveTop
          : Math.min(Math.max(fallbackTop, 12), Math.max(12, window.innerHeight - menuHeight - 12));
      setPopoverPlacement({ left: nextLeft, top: nextTop, width: menuWidth });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, stepIndex, stepsPerPattern]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Edit step ${stepIndex + 1} time column`}
        className="step-column-menu-trigger"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        tabIndex={open || selected ? 0 : -1}
        title={`Edit the whole step ${stepIndex + 1} column`}
        type="button"
        ref={triggerRef}
      >
        <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          aria-label={`Step ${stepIndex + 1} column tools`}
          className="step-column-popover"
          data-step-column-menu-root="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          ref={popoverRef}
          role="menu"
          style={popoverPlacement === null ? undefined : {
            left: `${popoverPlacement.left}px`,
            right: 'auto',
            top: `${popoverPlacement.top}px`,
            transform: 'none',
            width: `${popoverPlacement.width}px`,
          }}
        >
          <div className="step-column-menu-heading">
            <span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Time column</span>
              <span className="mt-0.5 block text-sm font-semibold text-[var(--text-primary)]">Step {stepIndex + 1}</span>
            </span>
            <span className="rounded-[3px] border border-[var(--border-soft)] px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Pattern {patternLabel}
            </span>
          </div>

          <div className="step-column-move-row">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Move beat</span>
            <div className="flex gap-1">
              <button
                aria-label="Move time column earlier"
                className="step-column-move-button"
                disabled={stepIndex === 0}
                onClick={() => onOperation('move-left')}
                role="menuitem"
                title="Move this column one step earlier"
                type="button"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Earlier
              </button>
              <button
                aria-label="Move time column later"
                className="step-column-move-button"
                disabled={stepIndex === stepsPerPattern - 1}
                onClick={() => onOperation('move-right')}
                role="menuitem"
                title="Move this column one step later"
                type="button"
              >
                Later
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="step-column-menu-actions">
            <MenuAction
              detail={`Silence every lane; keep ${stepsPerPattern} steps`}
              icon={<Eraser className="h-3.5 w-3.5" />}
              label="Clear column"
              onClick={() => onOperation('clear')}
            />
            <MenuAction
              detail={`Copy this beat; ${stepsPerPattern} to ${stepsPerPattern + 1} steps`}
              disabled={!canGrow}
              icon={<CopyPlus className="h-3.5 w-3.5" />}
              label="Duplicate time"
              onClick={() => onOperation('duplicate')}
            />
            <MenuAction
              detail={`Add blank beat after; ${stepsPerPattern} to ${stepsPerPattern + 1}`}
              disabled={!canGrow}
              icon={<Plus className="h-3.5 w-3.5" />}
              label="Insert blank"
              onClick={() => onOperation('insert')}
            />
            <MenuAction
              detail={`All patterns; ${stepsPerPattern} to ${stepsPerPattern - 1} steps`}
              disabled={!canShrink}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Delete time"
              onClick={() => onOperation('delete')}
              tone="danger"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
