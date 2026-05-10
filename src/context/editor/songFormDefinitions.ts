export type SongFormId = 'short-arc' | 'full-arc' | 'club-lift';
export type SongFormRole = 'intro' | 'groove' | 'lift' | 'break' | 'return' | 'outro';

export interface SongFormSection {
  label: string;
  length: number;
  patternOffset: number;
  role: SongFormRole;
}

export interface SongFormDefinition {
  id: SongFormId;
  label: string;
  sections: SongFormSection[];
  summary: string;
}

export const SONG_FORM_DEFINITIONS: SongFormDefinition[] = [
  {
    id: 'short-arc',
    label: 'Short arc',
    sections: [
      { label: 'Intro', length: 16, patternOffset: 0, role: 'intro' },
      { label: 'Groove', length: 16, patternOffset: 1, role: 'groove' },
      { label: 'Lift', length: 16, patternOffset: 2, role: 'lift' },
      { label: 'Return', length: 16, patternOffset: 1, role: 'return' },
    ],
    summary: 'Intro, groove, lift, return',
  },
  {
    id: 'full-arc',
    label: 'Full arc',
    sections: [
      { label: 'Intro', length: 16, patternOffset: 0, role: 'intro' },
      { label: 'Verse', length: 24, patternOffset: 1, role: 'groove' },
      { label: 'Hook', length: 24, patternOffset: 2, role: 'lift' },
      { label: 'Break', length: 16, patternOffset: 3, role: 'break' },
      { label: 'Final', length: 24, patternOffset: 2, role: 'return' },
      { label: 'Outro', length: 16, patternOffset: 0, role: 'outro' },
    ],
    summary: 'Intro, verse, hook, break, final, outro',
  },
  {
    id: 'club-lift',
    label: 'Club lift',
    sections: [
      { label: 'Intro', length: 16, patternOffset: 0, role: 'intro' },
      { label: 'Drive', length: 32, patternOffset: 1, role: 'groove' },
      { label: 'Break', length: 16, patternOffset: 3, role: 'break' },
      { label: 'Return', length: 32, patternOffset: 2, role: 'return' },
      { label: 'Outro', length: 16, patternOffset: 0, role: 'outro' },
    ],
    summary: 'Intro, drive, break, return, outro',
  },
];
