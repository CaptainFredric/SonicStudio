import React, { type ErrorInfo, type ReactNode } from 'react';

// Turn an unknown thrown value into one short, human line for the fallback.
export const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  return 'An unexpected error stopped this view from rendering.';
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Keeps a single render crash from blanking the whole studio. React unmounts
// the tree when a render throws; without a boundary that leaves a white
// screen. This catches it and offers a way back, and reassures the user that
// the session is autosaved locally so nothing is lost.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // This project does not install @types/react, so the inherited Component
  // members are invisible to the type-checker even though React provides them
  // at runtime. Declare the two we use; `declare` emits no code.
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('SonicStudio: a component crashed', error, info.componentStack);
    }
  }

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  public render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          alignItems: 'center',
          background: 'var(--bg-app, #04070b)',
          color: 'var(--text-primary, #f3f8fb)',
          display: 'flex',
          inset: 0,
          justifyContent: 'center',
          padding: '24px',
          position: 'fixed',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            background: 'var(--bg-panel-strong, rgba(10,14,19,0.94))',
            border: '1px solid var(--border-strong, rgba(190,208,228,0.16))',
            borderRadius: '6px',
            maxWidth: '420px',
            padding: '28px',
            width: '100%',
          }}
        >
          <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            The studio hit a snag
          </div>
          <p style={{ color: 'var(--text-secondary, #9eb3c8)', fontSize: '13px', lineHeight: 1.55, marginTop: '10px' }}>
            Something on screen stopped responding. Your session autosaves to this browser, so your work is still here. Reload to pick it back up, or try again to stay on this view.
          </p>
          <code
            style={{
              background: 'var(--bg-control, #0a0f15)',
              border: '1px solid var(--border-soft, rgba(149,169,189,0.1))',
              borderRadius: '3px',
              color: 'var(--text-secondary, #9eb3c8)',
              display: 'block',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '11px',
              marginTop: '16px',
              overflowWrap: 'anywhere',
              padding: '10px 12px',
            }}
          >
            {readErrorMessage(error)}
          </code>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={this.handleReload}
              style={{
                background: 'var(--accent, #48e4ff)',
                border: 'none',
                borderRadius: '3px',
                color: '#04070b',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '10px 16px',
                textTransform: 'uppercase',
              }}
              type="button"
            >
              Reload studio
            </button>
            <button
              onClick={this.handleRetry}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-strong, rgba(190,208,228,0.16))',
                borderRadius: '3px',
                color: 'var(--text-primary, #f3f8fb)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '10px 16px',
                textTransform: 'uppercase',
              }}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
