import { describe, expect, it } from 'vitest';

import { readErrorMessage } from './ErrorBoundary';

describe('readErrorMessage', () => {
  it('uses the message from an Error', () => {
    expect(readErrorMessage(new Error('Cannot read clips of undefined'))).toBe('Cannot read clips of undefined');
  });

  it('passes through a non-empty string throw', () => {
    expect(readErrorMessage('boom')).toBe('boom');
  });

  it('falls back for an empty or whitespace message', () => {
    expect(readErrorMessage(new Error('   '))).toMatch(/stopped this view/i);
    expect(readErrorMessage('')).toMatch(/stopped this view/i);
  });

  it('falls back for non-error values', () => {
    expect(readErrorMessage(null)).toMatch(/stopped this view/i);
    expect(readErrorMessage({ weird: true })).toMatch(/stopped this view/i);
  });
});
