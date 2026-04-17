import type { ReactNode } from 'react';

export const ActionButton = ({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-field flex min-w-0 items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <span className="text-[var(--accent)]">{icon}</span>
    {label}
  </button>
);

export const MetricCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="section-label">{label}</div>
    <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

export const SegmentButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
    data-active={active}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

export const StateButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors"
    data-active={active}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

export const ShortcutRow = ({
  command,
  description,
}: {
  command: string;
  description: string;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <span className="font-mono text-xs text-[var(--accent-strong)]">{command}</span>
    <span className="text-right text-xs text-[var(--text-secondary)]">{description}</span>
  </div>
);
