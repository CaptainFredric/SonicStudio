import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary rendering', () => {
  it('passes children through untouched when nothing throws', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <span>studio is fine</span>
      </ErrorBoundary>,
    );
    expect(html).toContain('studio is fine');
    expect(html).not.toContain('hit a snag');
  });
});
