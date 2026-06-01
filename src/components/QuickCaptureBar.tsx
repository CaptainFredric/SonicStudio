import { useEffect, useRef, useState } from 'react';
import { History, Mic2, X } from 'lucide-react';

import { captureNoteString } from '../services/noteStringLibrary';
import { setQueuedNoteStringId } from '../services/noteStringQueue';
import { readJson, writeJson } from '../utils/safeStorage';

const HISTORY_STORAGE_KEY = 'sonicstudio:quick-capture-history:v1';
const MAX_HISTORY = 5;

const readHistory = (): string[] => (
  readJson<string[]>(HISTORY_STORAGE_KEY, [], (parsed) => (
    Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_HISTORY)
      : []
  ))
);

const writeHistory = (entries: string[]): void => {
  writeJson(HISTORY_STORAGE_KEY, entries.slice(0, MAX_HISTORY));
};

interface QuickCaptureBarProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (tone: 'info' | 'success' | 'error', title: string, detail?: string) => void;
}

// A small dialog that lets the user save and queue a note string from
// anywhere in the studio. Opens on Alt+C (handled by the keyboard
// shortcut layer) so power users do not have to dig into Studio
// Settings every time they want to drop a quick idea.
export const QuickCaptureBar = ({ open, onClose, onNotify }: QuickCaptureBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRaw, setDraftRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => readHistory());

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHistory(readHistory());
    // Defer focus so the dialog has actually painted before we focus.
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      // Alt+1..5 recalls the n-th history entry so a power user can
      // build on a recent capture without reaching for the chip strip.
      if (event.altKey && /^[1-5]$/.test(event.key)) {
        const index = Number.parseInt(event.key, 10) - 1;
        const entry = history[index];
        if (entry) {
          event.preventDefault();
          setDraftRaw(entry);
          setError(null);
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, history]);

  if (!open) return null;

  const handleSubmit = () => {
    const updated = captureNoteString({ name: draftName, raw: draftRaw, source: 'typed' });
    if (!updated) {
      setError('That didn\'t look like notes. Try something like C4 E4 G4.');
      return;
    }
    const saved = updated[0];
    setQueuedNoteStringId(saved.id);
    // Remember this entry so the next Alt+C can recall it. Dedupe so
    // a user retrying the same line doesn't fill the history with it.
    const trimmedRaw = draftRaw.trim();
    if (trimmedRaw) {
      const nextHistory = [trimmedRaw, ...history.filter((entry) => entry !== trimmedRaw)].slice(0, MAX_HISTORY);
      writeHistory(nextHistory);
      setHistory(nextHistory);
    }
    onNotify?.(
      'success',
      'Saved and queued',
      `Tap any cell, lane header, or arrangement row to drop "${saved.name}".`,
    );
    setDraftName('');
    setDraftRaw('');
    setError(null);
    onClose();
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(4,7,11,0.55)] px-4 pt-[14vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="surface-panel-strong w-[min(560px,96vw)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Mic2 className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Quick capture</span>
            </div>
            <p className="mt-1 max-w-[58ch] text-[12px] leading-5 text-[var(--text-secondary)]">
              Type a note string and press Enter to save it and queue it for the next tap. Alt+C opens this from anywhere.
            </p>
          </div>
          <button
            aria-label="Close quick capture"
            className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center"
            data-ui-sound="nav"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          <input
            aria-label="Note string"
            className="control-field h-10 w-full px-3 font-mono text-sm"
            onChange={(event) => {
              setDraftRaw(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="C4 E4 G4 B4*2 . F4"
            ref={inputRef}
            type="text"
            value={draftRaw}
          />
          <input
            aria-label="Optional name"
            className="control-field h-9 w-full px-3 text-sm"
            maxLength={48}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Name this string (optional)"
            type="text"
            value={draftName}
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Use . for rests, *N to hold N steps, @V for velocity from 0 to 1.
          </div>
          {error && (
            <div className="text-[11px] text-[var(--accent-warn,#ff9466)]" role="alert">
              {error}
            </div>
          )}
          {history.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <History className="h-3 w-3" />
                Recent
              </span>
              {history.map((entry, index) => (
                <button
                  aria-label={`Reuse capture "${entry}". Shortcut Alt+${index + 1}.`}
                  className="control-chip h-7 min-h-[1.75rem] inline-flex items-center gap-1 px-2 font-mono text-[10px] tracking-[0.06em]"
                  key={`${entry}-${index}`}
                  onClick={() => {
                    setDraftRaw(entry);
                    setError(null);
                    inputRef.current?.focus();
                  }}
                  title={`Alt+${index + 1} to recall. Fills: ${entry}`}
                  type="button"
                >
                  <span className="text-[var(--text-tertiary)]">Alt+{index + 1}</span>
                  <span>{entry.length > 24 ? `${entry.slice(0, 22)}…` : entry}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-ui-sound="tab"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-active="true"
            data-ui-sound="action"
            disabled={draftRaw.trim().length === 0}
            onClick={handleSubmit}
            type="button"
          >
            Save and queue
          </button>
        </div>
      </div>
    </div>
  );
};
