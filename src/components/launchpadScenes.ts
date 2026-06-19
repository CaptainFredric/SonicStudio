// The starter-scene catalog and featured lists, kept as plain data so the
// Launchpad component and the registry tests can both read them without pulling
// in the audio runtime. Every id here must be a real SessionTemplateId.
import type { SessionTemplateId } from '../project/schema';

export interface StartOption {
  body: string;
  focus: string;
  genre: string;
  bpm: number;
  id: SessionTemplateId;
  label: string;
  swatch: [string, string, string];
  mark: string;
}

export const START_OPTIONS: StartOption[] = [
  {
    body: 'A full song with drums, bass, lead, pads, and mix moves already in place.',
    focus: 'Full arrangement',
    genre: 'Synth pop',
    bpm: 112,
    id: 'night-transit',
    label: 'Night Transit',
    swatch: ['#7dd3fc', '#67e8f9', '#c084fc'],
    mark: 'NT',
  },
  {
    body: 'Driving pulse, sidechained bass, glassy lead, and wide late-night pads.',
    focus: '80s synthwave',
    genre: '80s synthwave',
    bpm: 108,
    id: 'synthwave-drive',
    label: 'Synthwave Drive',
    swatch: ['#fb7185', '#c084fc', '#7dd3fc'],
    mark: 'SD',
  },
  {
    body: 'Club kick, pluck stabs, a pumping bass lane, and a lift FX track already in motion.',
    focus: 'Club lift and stabs',
    genre: 'House pulse',
    bpm: 122,
    id: 'club-horizon',
    label: 'Club Horizon',
    swatch: ['#fb7185', '#ef4444', '#f59e0b'],
    mark: 'CH',
  },
  {
    body: 'Four-on-the-floor drive in E major. A clean pad-and-hats intro drops into the main groove, then lifts.',
    focus: 'Driving groove',
    genre: 'House pulse',
    bpm: 125,
    id: 'pulse-rider',
    label: 'Pulse Rider',
    swatch: ['#22d3ee', '#818cf8', '#f472b6'],
    mark: 'PR',
  },
  {
    body: 'Halftime 808 trap in G minor: booming sub, rattling triplet hats, a backbeat clap, and a dark bell hook.',
    focus: 'Halftime trap',
    genre: 'Trap',
    bpm: 140,
    id: 'midnight-trap',
    label: 'Midnight Trap',
    swatch: ['#a78bfa', '#7c3aed', '#f43f5e'],
    mark: 'MT',
  },
  {
    body: 'A 174 BPM two-step break, a growling reese sub, stabbed lead, and a wide atmosphere pad.',
    focus: 'Drum and bass',
    genre: 'Drum & bass',
    bpm: 174,
    id: 'neon-breaks',
    label: 'Neon Breaks',
    swatch: ['#22d3ee', '#34d399', '#a3e635'],
    mark: 'NB',
  },
  {
    body: 'Deep house warmth: four-on-the-floor, offbeat open hats, a round bass, and lush ninth-chord pads.',
    focus: 'Deep house',
    genre: 'Deep house',
    bpm: 122,
    id: 'sunset-house',
    label: 'Sunset House',
    swatch: ['#fb923c', '#f472b6', '#f59e0b'],
    mark: 'SH',
  },
  {
    body: 'Soft four-on-the-floor, shuffled shakers, a bouncing log-drum bass, and warm piano chords.',
    focus: 'Amapiano groove',
    genre: 'Amapiano',
    bpm: 112,
    id: 'palm-hour',
    label: 'Palm Hour',
    swatch: ['#fbbf24', '#f59e0b', '#34d399'],
    mark: 'PH',
  },
  {
    body: 'A skippy two-step kick, shuffled hats, a bouncing sub, and chopped stabs over a warm pad.',
    focus: 'Two-step shuffle',
    genre: 'UK garage',
    bpm: 133,
    id: 'pirate-radio',
    label: 'Pirate Radio',
    swatch: ['#a78bfa', '#22d3ee', '#f472b6'],
    mark: 'PR',
  },
  {
    body: 'A four-on-the-floor kick, off-beat open hats, an octave-jumping bass, and string and brass stabs.',
    focus: 'Four-on-the-floor disco',
    genre: 'Disco',
    bpm: 120,
    id: 'saturday-lights',
    label: 'Saturday Lights',
    swatch: ['#f472b6', '#fbbf24', '#22d3ee'],
    mark: 'SL',
  },
  {
    body: 'Bright pop drums, glossy lead hooks, and a counter-pluck for fast topline writing.',
    focus: 'Bright pop motion',
    genre: 'Pop shimmer',
    bpm: 110,
    id: 'starlight-parade',
    label: 'Starlight Parade',
    swatch: ['#7dd3fc', '#f472b6', '#fbbf24'],
    mark: 'SP',
  },
  {
    body: 'Loose drums, soft chords, and plenty of room for melody at 78 BPM.',
    focus: 'Lo-fi hip hop',
    genre: 'Lo-fi',
    bpm: 78,
    id: 'lofi-sunday',
    label: 'Lo-Fi Sunday',
    swatch: ['#fbbf24', '#fb923c', '#67e8f9'],
    mark: 'LS',
  },
  {
    body: 'Sample drums, walking bass, and a few risers for loop-first writing.',
    focus: 'Beat-first',
    genre: 'Hip-hop beat',
    bpm: 136,
    id: 'beat-lab',
    label: 'Beat Lab',
    swatch: ['#f87171', '#fb923c', '#fbbf24'],
    mark: 'BL',
  },
  {
    body: 'Wide pads, slow phrases, and lots of space for sketching.',
    focus: 'Atmosphere',
    genre: 'Ambient',
    bpm: 94,
    id: 'ambient-drift',
    label: 'Ambient Drift',
    swatch: ['#67e8f9', '#60a5fa', '#c084fc'],
    mark: 'AD',
  },
  {
    body: 'A cleaner grid with drums, bass, lead, and pad lanes ready to sketch on immediately.',
    focus: 'Start blank',
    genre: 'Blank canvas',
    bpm: 120,
    id: 'blank-grid',
    label: 'Blank Grid',
    swatch: ['#9eb3c8', '#74899e', '#9eb3c8'],
    mark: 'BG',
  },
  {
    body: 'A chamber sketch with held bass, piano triads, a soft pad bed, and a singing violin line over I-vi-IV-V.',
    focus: 'Strings and piano',
    genre: 'Chamber',
    bpm: 86,
    id: 'velvet-suite',
    label: 'Velvet Suite',
    swatch: ['#e0a86b', '#83c995', '#67e8f9'],
    mark: 'VS',
  },
  {
    body: 'A bright I-IV-V loop with a soft kick anchor, piano stabs, wide pad, and a bell sparkling on the offbeats.',
    focus: 'Bell-led sparkle',
    genre: 'Sparkle',
    bpm: 92,
    id: 'crystal-garden',
    label: 'Crystal Garden',
    swatch: ['#b9c2da', '#83c995', '#67e8f9'],
    mark: 'CG',
  },
  {
    body: 'Cinematic A-minor with soft kick, walking bass, piano triads, a held pad, a violin line, and bell sparkles on every change.',
    focus: 'Cinematic ensemble',
    genre: 'Cinematic',
    bpm: 88,
    id: 'twilight-frame',
    label: 'Twilight Frame',
    swatch: ['#e0a86b', '#83c995', '#b9c2da'],
    mark: 'TF',
  },
  {
    body: 'Slow D-minor at 72 BPM: a tape-warmed pad, a bowed violin line, glass bells, a whistled lead, and a round sub bass.',
    focus: 'New voices showcase',
    genre: 'Downtempo',
    bpm: 72,
    id: 'late-hours',
    label: 'Late Hours',
    swatch: ['#7c8cff', '#b9c2da', '#e0a86b'],
    mark: 'LH',
  },
];

export const FEATURED_IDS: SessionTemplateId[] = ['pulse-rider', 'night-transit', 'midnight-trap', 'sunset-house', 'palm-hour', 'pirate-radio', 'saturday-lights', 'twilight-frame', 'club-horizon', 'neon-breaks', 'starlight-parade', 'velvet-suite'];

// The hero "featured" scene rotates once per calendar day from a weighted pool,
// so a returning visitor meets a different scene rather than the same one every
// time. Weights lean toward the longer, newer builds (Pulse Rider and the most
// recent additions) without ever excluding the rest.
export const FEATURED_POOL: Array<{ id: SessionTemplateId; weight: number }> = [
  { id: 'pulse-rider', weight: 5 },
  { id: 'midnight-trap', weight: 4 },
  { id: 'neon-breaks', weight: 4 },
  { id: 'sunset-house', weight: 4 },
  { id: 'palm-hour', weight: 4 },
  { id: 'pirate-radio', weight: 4 },
  { id: 'saturday-lights', weight: 4 },
  { id: 'twilight-frame', weight: 3 },
  { id: 'club-horizon', weight: 3 },
  { id: 'starlight-parade', weight: 3 },
  { id: 'night-transit', weight: 2 },
  { id: 'velvet-suite', weight: 2 },
];
