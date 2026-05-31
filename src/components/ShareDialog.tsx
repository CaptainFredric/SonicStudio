import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Download, Link2, Share2, X } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useManualKeyOverride } from '../services/manualKeyOverride';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (tone: 'info' | 'success' | 'error', title: string, detail?: string) => void;
}

type Tab = 'link' | 'clipboard' | 'file';

const encodeForLink = (text: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const ShareDialog = ({ open, onClose, onNotify }: ShareDialogProps) => {
  const { currentSession, exportSession } = useAudio();
  const [override] = useManualKeyOverride();
  const [tab, setTab] = useState<Tab>('link');
  const [copied, setCopied] = useState<Tab | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef);

  const sessionJson = useMemo(() => {
    if (!open) return '';
    try {
      // Wrap the session so a manual key pin can travel alongside it.
      // Older share links carried just the session; the receiver still
      // accepts both shapes so we don't break existing URLs.
      const payload = {
        v: 1,
        session: currentSession,
        manualKeyOverride: override,
      };
      return JSON.stringify(payload, null, 2);
    } catch {
      return '';
    }
  }, [currentSession, open, override]);

  const shareLink = useMemo(() => {
    if (!sessionJson || typeof window === 'undefined') return '';
    const encoded = encodeForLink(sessionJson);
    if (!encoded) return '';
    return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  }, [sessionJson]);

  const payloadBytes = sessionJson ? new Blob([sessionJson]).size : 0;
  const linkLength = shareLink.length;

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!open) return null;

  const notifyCopied = (source: Tab) => {
    if (!onNotify) {
      return;
    }

    if (source === 'link') {
      onNotify('success', 'Share link copied', 'Send it or open it in another tab.');
      return;
    }

    if (source === 'clipboard') {
      onNotify('success', 'Session JSON copied', 'Paste it into a note or save it as a .json file.');
      return;
    }

    onNotify('success', 'Session file export started', 'A .sonicstudio.json download has started.');
  };

  const copyText = async (text: string, source: Tab) => {
    if (!text) {
      onNotify?.('error', 'Share payload unavailable', 'Try reopening the Share panel.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(source);
      notifyCopied(source);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(source);
        notifyCopied(source);
      } catch {
        onNotify?.('error', 'Clipboard copy failed', 'Your browser blocked copy access for this action.');
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.72)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        ref={dialogRef}
        className="surface-panel-strong w-[min(640px,96vw)] max-h-[88vh] overflow-auto p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Share2 className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Share</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Share this session.
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Pick a link, raw JSON, or a file download. Everything stays in your browser.
            </p>
          </div>
          <button
            aria-label="Close share dialog"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Share modes">
          <TabButton active={tab === 'link'} onClick={() => setTab('link')}>
            <Link2 className="h-3.5 w-3.5" /> Link
          </TabButton>
          <TabButton active={tab === 'clipboard'} onClick={() => setTab('clipboard')}>
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </TabButton>
          <TabButton active={tab === 'file'} onClick={() => setTab('file')}>
            <Download className="h-3.5 w-3.5" /> Save file
          </TabButton>
        </nav>

        <div className="mt-4">
          {tab === 'link' && (
            <ModeCard
              title="Share link"
              description="The whole session is packed into the URL. Opening it brings SonicStudio back in this exact state."
              meta={shareLink ? `${(linkLength / 1024).toFixed(1)} KB link` : null}
              footnote="Long sessions can push past browser URL limits. If the link looks cut off, use Save file instead."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="control-field w-full px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]"
                  onFocus={(event) => event.target.select()}
                  readOnly
                  value={shareLink || 'Building link...'}
                />
                <button
                  className="control-chip flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active={copied === 'link' ? 'true' : undefined}
                  onClick={() => copyText(shareLink, 'link')}
                  type="button"
                >
                  {copied === 'link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </ModeCard>
          )}

          {tab === 'clipboard' && (
            <ModeCard
              title="Copy the session JSON"
              description="Paste the JSON into a message or note. The other person can save it as a .sonicstudio.json file and load it from Options -> Workspace -> Load JSON."
              meta={`${formatBytes(payloadBytes)} payload`}
            >
              <textarea
                className="control-field h-40 w-full resize-y px-3 py-2 font-mono text-[10px] text-[var(--text-secondary)]"
                readOnly
                value={sessionJson}
              />
              <div className="mt-2 flex justify-end">
                <button
                  className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active={copied === 'clipboard' ? 'true' : undefined}
                  onClick={() => copyText(sessionJson, 'clipboard')}
                  type="button"
                >
                  {copied === 'clipboard' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'clipboard' ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
            </ModeCard>
          )}

          {tab === 'file' && (
            <ModeCard
              title="Download the session file"
              description="Download a .sonicstudio.json file you can email, store in the cloud, or commit to a repo. Open it later from Options -> Workspace -> Load JSON."
              meta={`${formatBytes(payloadBytes)} .sonicstudio.json`}
            >
              <button
                className="control-chip flex w-full items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em]"
                data-active
                onClick={() => {
                  exportSession();
                  setCopied('file');
                  notifyCopied('file');
                }}
                type="button"
              >
                {copied === 'file' ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {copied === 'file' ? 'Download started' : 'Save session file'}
              </button>
            </ModeCard>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) => (
  <button
    className="control-chip flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors"
    data-active={active ? 'true' : undefined}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const ModeCard = ({
  title,
  description,
  meta,
  footnote,
  children,
}: {
  title: string;
  description: string;
  meta?: string | null;
  footnote?: string;
  children: ReactNode;
}) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</p>
      </div>
      {meta && (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {meta}
        </span>
      )}
    </div>
    <div className="mt-3">{children}</div>
    {footnote && (
      <p className="mt-3 border-t border-[var(--border-soft)] pt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
        {footnote}
      </p>
    )}
  </section>
);
