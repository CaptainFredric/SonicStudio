import { describe, expect, it } from 'vitest';

import { exportFailureNotice, exportSuccessNotice } from './exportFeedback';

describe('export feedback copy', () => {
  it('names the format in each success notice', () => {
    expect(exportSuccessNotice('mix').title).toMatch(/mix/i);
    expect(exportSuccessNotice('stems').title).toMatch(/stems/i);
    expect(exportSuccessNotice('midi').title).toMatch(/midi/i);
  });

  it('points the user at their downloads on success', () => {
    expect(exportSuccessNotice('mix').detail).toMatch(/downloads/i);
  });

  it('surfaces the underlying error message when there is one', () => {
    const notice = exportFailureNotice('mix', new Error('AudioContext was closed'));
    expect(notice.title).toMatch(/did not finish/i);
    expect(notice.detail).toBe('AudioContext was closed');
  });

  it('falls back to friendly copy when no error message is available', () => {
    expect(exportFailureNotice('midi').detail).toMatch(/try the export again/i);
    expect(exportFailureNotice('stems', new Error('   ')).detail).toMatch(/try the export again/i);
  });
});
