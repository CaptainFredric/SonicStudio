import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  detail?: string;
  id: number;
  title: string;
  tone: 'info' | 'success' | 'error';
}

interface ToastStackProps {
  onDismiss: (id: number) => void;
  toasts: ToastItem[];
}

const TONE_ICON = {
  error: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

export const ToastStack = ({ onDismiss, toasts }: ToastStackProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="toast-stack" role="status">
      {toasts.map((toast) => {
        const Icon = TONE_ICON[toast.tone];

        return (
          <section className="toast-card" data-tone={toast.tone} key={toast.id}>
            <div className="flex items-start gap-3">
              <span className="toast-icon-wrap">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</div>
                {toast.detail ? (
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{toast.detail}</div>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notice"
                className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                onClick={() => onDismiss(toast.id)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
};