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
      { keys: 'Space', label: 'Play or pause' },
      { keys: '⌥ R', label: 'Start or stop recording' },
      { keys: 'M', label: 'Toggle metronome' },
      { keys: '1-8', label: 'Jump to pattern A-H' },
    ],
  },
  {
    title: 'Views and modes',
    entries: [
      { keys: '⌥ 1', label: 'Open Sequencer' },
      { keys: '⌥ 2', label: 'Open Mixer' },
      { keys: '⌥ S', label: 'Toggle SuperSonic mode' },
    ],
  },
  {
    title: 'Capture',
    entries: [
      { keys: '⌥ C', label: 'Quick capture a note string from anywhere' },
      { keys: '⌥ 1-5', label: 'Recall a recent capture (inside Quick capture)' },
      { keys: '⇧ paint', label: 'Snap painted notes to the session key (Notes panel)' },
    ],
  },
  {
    title: 'Edit',
    entries: [
      { keys: '⌘ S', label: 'Save' },
      { keys: '⌘ Z', label: 'Undo' },
      { keys: '⇧ ⌘ Z', label: 'Redo' },
      { keys: '[ ]', label: 'Shorten or lengthen the selected note' },
    ],
  },
  {
    title: 'Arranger clips',
    entries: [
      { keys: '← →', label: 'Nudge the selected clip' },
      { keys: '⇧ ← →', label: 'Trim the selected clip length' },
      { keys: '[ ]', label: 'Transpose the selected clip' },
      { keys: 'D', label: 'Duplicate the selected clip' },
      { keys: 'U', label: 'Make a linked clip unique' },
      { keys: 'Backspace', label: 'Remove the selected clip' },
      { keys: 'F', label: 'Follow the playhead' },
    ],
  },
  {
    title: 'Tap to play',
    entries: [
      { keys: 'A S D F G H J K L', label: 'White keys, two octaves' },
      { keys: 'W E T Y U O P', label: 'Black keys' },
      { keys: 'A S D F', label: 'Drum pads (when a drum track is selected)' },
    ],
  },
  {
    title: 'Drag and drop',
    entries: [
      { keys: 'Drag', label: 'Drop a shelf string on a lane, cell, or arrangement row' },
      { keys: 'Tap', label: 'On touch, queue a string then tap a cell or lane to drop it' },
      { keys: 'Drag', label: 'Drop a scoresheet on a lane to borrow its melody' },
    ],
  },
  {
    title: 'Help',
    entries: [
      { keys: '?', label: 'Open or close this list' },
      { keys: 'Esc', label: 'Close the overlay or settings panel' },
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
              <span className="section-label text-[var(--accent)]">Reference</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Shortcuts and gestures</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Transport, editing, playable keys, capture, and the drag actions the studio responds to.
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
