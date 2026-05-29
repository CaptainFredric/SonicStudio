// User-facing copy for export outcomes. Kept pure and separate so the
// wording is tested and the render controller can stay focused on wiring.
// Without these, a failed bounce or MIDI export used to fail silently: the
// progress bar reset and nothing downloaded, with no word to the user.

export type ExportKind = 'mix' | 'stems' | 'midi';

export interface ExportNotice {
  title: string;
  detail: string;
}

const SUCCESS: Record<ExportKind, ExportNotice> = {
  mix: { title: 'Mix bounced', detail: 'The WAV is in your downloads.' },
  stems: { title: 'Stems bounced', detail: 'The stem WAVs are in your downloads.' },
  midi: { title: 'MIDI exported', detail: 'The .mid file is in your downloads.' },
};

const FAILURE_TITLE: Record<ExportKind, string> = {
  mix: 'Mix bounce did not finish',
  stems: 'Stem bounce did not finish',
  midi: 'MIDI export did not finish',
};

export const exportSuccessNotice = (kind: ExportKind): ExportNotice => SUCCESS[kind];

export const exportFailureNotice = (kind: ExportKind, error?: unknown): ExportNotice => {
  const message = error instanceof Error ? error.message.trim() : '';
  return {
    title: FAILURE_TITLE[kind],
    detail: message.length > 0 ? message : 'Nothing was saved. Try the export again.',
  };
};
