# SonicStudio

SonicStudio is a browser-native composition studio built with React and Tone.js. It is aimed at fast song sketching, sound design, arrangement editing, and practical workflow exits inside the browser.

## Why it matters

The current build supports an actual writing flow:

1. build phrases in the sequencer or piano roll
2. arrange clips in song view
3. shape lanes with synth and sample sources
4. print references as WAV
5. move work in and out through MIDI
6. recover safely with checkpoints and snapshots

## Current capabilities

1. Sequencer, piano roll, mixer, arranger, and sound desk tied to one serializable project state
2. Synth lanes and sample lanes with slice-aware triggering
3. Song markers, loop ranges, clip editing, pattern transforms, and section duplication
4. MIDI import and scoped MIDI export
5. WAV bounce with scope selection, print targets, analysis, and bounce history
6. Master presets, master snapshots, track sound recall, and recovery checkpoints
7. Starter scenes for quick demos and fast first use

## Best demo path

1. Start the dev server or open the hosted build
2. Wake audio and press Play
3. Load `Beat Lab` for a rhythm-first demo or `Night Transit` for a fuller song sketch
4. Open `Song` view to inspect clips and structure
5. Open `Notes` to inspect tighter pitch and gate editing
6. Try `Export MIDI` or a WAV bounce from the Output tab

## Run locally

Prerequisite: Node.js 20+

```bash
npm install
npm run dev
```

Vite serves the studio at `http://localhost:3000/SonicStudio/`.

## Verification

```bash
npm run lint
npm run build
```

## Project direction

The strongest next milestones are:

1. offline rendering instead of only live bounce
2. deeper mastering analysis and louder-target feedback
3. stronger project-history UX around destructive edits
4. eventual collaboration and cloud library layers after the local workflow is fully hardened
