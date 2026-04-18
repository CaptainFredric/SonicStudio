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
7. Starter scenes for quick starts and first use

## Current architecture

The codebase is now split around a few real boundaries:

1. `src/context/AudioContext.tsx`
   Main session controller and reducer integration layer. Still too large, but smaller than before.
2. `src/context/editor/projectMutations.ts`
   Pure arranger clip and track mutation helpers used by the reducer.
3. `src/context/editor/transportController.ts`
   Playback, recording, preview, and transport reset orchestration for the provider layer.
4. `src/context/editor/renderController.ts`
   Provider-facing mix, stem, MIDI, and bounce-history orchestration.
5. `src/context/editor/sessionController.ts`
   Provider-facing session import, export, restore, checkpoint, and template-load orchestration.
6. `src/services/renderWorkflow.ts`
   Render and bounce orchestration.
7. `src/services/sessionWorkflow.ts`
   Persistence, checkpoint, and import orchestration.
8. `src/components/settings/*`
   Workspace, track, and output controls broken into smaller panels.
9. `src/components/arranger/*`
   Arranger selector logic, interaction utilities, clip drag and paint hooks, viewport and shortcut hooks, inspector panels, and hero-surface view modules.

The main remaining refactor targets are still:

1. `src/context/AudioContext.tsx`
2. `src/components/DeviceRack.tsx`
3. reducer and integration correctness coverage

## Quick start

1. Start the dev server or open the hosted build
2. Use the launch surface to open a real scene, start blank, or import MIDI
3. Load `Beat Lab` for rhythm work or `Night Transit` for a fuller song sketch
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
npm test
npm run build
```

## Project direction

The strongest next milestones are:

1. split `AudioContext.tsx` into transport, arranger action-map, track mutation, and history-helper boundaries
2. split `DeviceRack.tsx` into source, shape, space, slicing, and recall surfaces
3. expand correctness coverage around clip operations, checkpoint restore, and import-export round trips
4. keep the arranger focused on composition fluency instead of growing every side feature equally
5. keep the launch surface as a real first-view route instead of drifting back into layered shell clutter
