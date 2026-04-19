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
   Thin integration shell for the audio provider. It now wires controllers, reducer state, persistence, keyboard shortcuts, and the public context surface instead of owning the reducer internals directly.
2. `src/context/editor/projectMutations.ts`
   Pure arranger clip and track mutation helpers used by the reducer.
3. `src/context/editor/editorDispatchers.ts`
   Dispatch-bound action methods used by the provider so action wiring is no longer handwritten inline.
4. `src/context/editor/keyboardShortcuts.ts`
   Runtime keyboard shortcut bridge for undo, redo, save, transport, metronome, and pattern focus.
5. `src/context/editor/reducer/*`
   Domain reducer ownership split across UI, project, track source, note-event editing, note-pattern editing, clip-pattern step editing, clip-pattern event editing, automation, transforms, track structure, arranger, and history action maps, plus reducer utilities and editor state types.
6. `src/context/editor/transportController.ts`
   Playback, recording, preview, and transport reset orchestration for the provider layer.
7. `src/context/editor/renderController.ts`
   Provider-facing mix, stem, MIDI, and bounce-history orchestration.
8. `src/context/editor/sessionController.ts`
   Provider-facing session import, export, restore, checkpoint, and template-load orchestration.
9. `src/app/routeController.ts`
   Explicit launch and deep-link state resolution so first run, persisted sessions, and query-driven entry all follow one path.
10. `src/services/renderWorkflow.ts`
   Render and bounce orchestration.
11. `src/services/sessionWorkflow.ts`
   Persistence, checkpoint, and import orchestration.
12. `src/components/settings/*`
   Workspace, track, and output controls broken into smaller panels.
13. `src/components/arranger/*`
   Arranger selector logic, interaction utilities, clip drag and paint hooks, viewport and shortcut hooks, inspector panels, and hero-surface view modules.

The main remaining refactor targets are now:

1. reducer ownership still concentrated in `src/context/editor/reducer/trackNotePatternActions.ts` and `src/context/editor/reducer/trackClipPatternStepActions.ts`
2. deeper controller and reducer integration correctness coverage around transport, restore, export scope replay, and route-driven session entry
3. device-rack source ownership still concentrated in the slice and source-window authoring path

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

Current test coverage includes reducer invariants, arranger selector and interaction logic, clip mutation helpers, note edit hydration, MIDI round trips, transport-controller behavior, render workflow behavior, session workflow behavior, explicit route resolution, and controller-level render and restore seams.

## Project direction

The strongest next milestones are:

1. keep shrinking reducer concentration in note-pattern and clip-pattern step ownership
2. expand correctness coverage around reducer action-map behavior, checkpoint restore, transport state, render-scope replay, and route-driven entry
3. keep the device rack moving toward true source, shape, space, slicing, and recall ownership boundaries, with the slice and source-window path next
4. keep the arranger focused on composition fluency instead of growing every side feature equally
5. keep the launch surface and route entry logic explicit instead of drifting back into layered shell clutter
