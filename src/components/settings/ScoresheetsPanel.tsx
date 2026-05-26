import { useEffect, useState } from 'react';
import { BookOpen, Check, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';

import { useAudio } from '../../context/AudioContext';

const formatRelative = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diff = Date.now() - then;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export const ScoresheetsPanel = () => {
  const {
    deleteScoresheet,
    loadScoresheet,
    projectName,
    renameScoresheet,
    saveScoresheet,
    scoresheets,
  } = useAudio();
  const [draftName, setDraftName] = useState(projectName);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { setDraftName(projectName); }, [projectName]);
  useEffect(() => {
    if (!flash) return undefined;
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [flash]);

  const handleSave = () => {
    const name = draftName.trim();
    if (!name) return;
    saveScoresheet(name);
    setFlash('saved');
  };

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <BookOpen className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Scoresheets</span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Save many named sessions and switch between them. Each scoresheet is a full snapshot of tracks, arrangement, sounds, and tempo.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          aria-label="Scoresheet name"
          className="control-field h-9 flex-1 px-3 text-sm"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSave();
          }}
          placeholder="Name for this snapshot"
          value={draftName}
        />
        <button
          className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          data-active={flash === 'saved' ? 'true' : undefined}
          disabled={!draftName.trim()}
          onClick={handleSave}
          type="button"
        >
          {flash === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {flash === 'saved' ? 'Saved' : 'Save current'}
        </button>
      </div>

      {scoresheets.length === 0 ? (
        <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
          No scoresheets yet. Save the current session to build a library you can return to.
        </p>
      ) : (
        <div className="mt-4 grid gap-1.5">
          {scoresheets.map((sheet) => (
            <div
              key={sheet.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            >
              <div className="min-w-0">
                {renamingId === sheet.id ? (
                  <input
                    aria-label={`Rename ${sheet.name}`}
                    autoFocus
                    className="control-field h-7 w-full px-2 text-sm"
                    onBlur={() => {
                      renameScoresheet(sheet.id, renameDraft);
                      setRenamingId(null);
                    }}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        renameScoresheet(sheet.id, renameDraft);
                        setRenamingId(null);
                      } else if (event.key === 'Escape') {
                        setRenamingId(null);
                      }
                    }}
                    value={renameDraft}
                  />
                ) : (
                  <button
                    className="block w-full truncate text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)]"
                    onClick={() => loadScoresheet(sheet.id)}
                    title={`Open ${sheet.name}`}
                    type="button"
                  >
                    {sheet.name}
                  </button>
                )}
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Saved {formatRelative(sheet.savedAt)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Open scoresheet ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                  onClick={() => loadScoresheet(sheet.id)}
                  title="Open this scoresheet"
                  type="button"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label={`Rename ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                  onClick={() => { setRenamingId(sheet.id); setRenameDraft(sheet.name); }}
                  title="Rename"
                  type="button"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  aria-label={`Delete ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center text-[var(--danger)]"
                  onClick={() => {
                    if (typeof window === 'undefined' || window.confirm(`Delete "${sheet.name}"? This cannot be undone.`)) {
                      deleteScoresheet(sheet.id);
                    }
                  }}
                  title="Delete"
                  type="button"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
