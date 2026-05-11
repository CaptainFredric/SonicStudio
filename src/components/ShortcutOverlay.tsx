import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutEntry {
  keys: string;
  label: string;
}

const GROUPS: Array<{ title: string; entries: ShortcutEntry[] }> = [
  {
    title: 'Transport',
    entries: [
      { keys: 'Space', label: 'Play / Pause' },
    ],
  },
  {
    title: 'Edit',
    entries: [
      { keys: '⌘ S', label: 'Save project' },
      { keys: '⌘ Z', label: 'Undo' },
      { keys: '⇧ ⌘ Z', label: 'Redo' },
      { keys: '[ ]', label: 'Nudge selected note gate' },
    ],
  },
  {
    title: 'Tap to play',
    entries: [
      { keys: 'A S D F G H J K L', label: 'White keys C-D-E-F-G-A-B-C-D' },
      { keys: 'W E T Y U O P', label: 'Black keys' },
      { keys: 'A S D F', label: 'Drum pads when drum track focused' },
    ],
  },
  {
    title: 'Help',
    entries: [
      { keys: '?', label: 'Toggle this overlay' },
      { keys: 'Esc', label: 'Close overlay or settings' },
    ],
  },
];

export const ShortcutOverlay = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormField = target && (
        target.tagName === 'INPUT'
        || target.tagName === 'SELECT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      );
      if (event.key === '?' && !isFormField && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,7,11,0.72)] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
    >
      <div
        className="surface-panel-strong w-[min(560px,90vw)] max-h-[80vh] overflow-auto p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Keyboard className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Shortcuts</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Keyboard reference</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Press <kbd className="font-mono text-[11px] text-[var(--accent-strong)]">?</kbd> anywhere to toggle. Tap-to-play keys only fire while the keyboard strip is open.
            </p>
          </div>
          <button
            aria-label="Close shortcuts"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{group.title}</div>
              <div className="mt-2 grid gap-1.5">
                {group.entries.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                  >
                    <span className="text-xs text-[var(--text-secondary)]">{entry.label}</span>
                    <kbd className="font-mono text-[11px] text-[var(--accent-strong)] tracking-wider">{entry.keys}</kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
