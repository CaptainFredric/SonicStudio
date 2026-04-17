# SonicStudio Current Reevaluation

## Purpose

This is the current technical and product reevaluation of SonicStudio after the second critique-following cleanup pass.

The first critique pass removed reviewer-facing studio chrome and created the first real service boundaries.

This second pass followed through on the next layer of the critique:

1. split the next settings monolith
2. reduce demo and submission framing
3. tighten product language so the app reads more like a music tool

The goal of this document is to give another AI or engineer a clean, current, technically grounded picture of what SonicStudio is now.

## Short product description

SonicStudio is a browser-native music creation studio built around one canonical session model. It combines:

1. pattern sequencing
2. clip-based song arrangement
3. piano-roll note editing
4. hybrid synth and sample tracks
5. MIDI import and export
6. offline mix and stem rendering
7. bounce analysis
8. local checkpoints and persistence

The product is trying to be a credible lightweight browser studio for a solo creator, not a guided showcase artifact.

## What improved in this pass

### 1. Workspace settings were split again into clearer responsibilities

The earlier settings split was real, but `WorkspaceSettingsPanel.tsx` had simply become the next oversized file.

That is now reduced through these new components:

1. `src/components/settings/WorkspaceSessionPanel.tsx`
2. `src/components/settings/WorkspaceBouncePanel.tsx`
3. `src/components/settings/WorkspaceRecoveryPanel.tsx`
4. `src/components/settings/WorkspaceTransportPanel.tsx`
5. `src/components/settings/WorkspaceUtilityPanel.tsx`

`src/components/settings/WorkspaceSettingsPanel.tsx` now acts as a coordinator for shared local state and file inputs instead of rendering every concern inline.

This matters because the workspace tab is now organized around distinct jobs:

1. session start and save
2. bounce and export
3. recovery
4. transport
5. utility

That is much closer to how the product is actually used.

### 2. The control surface is named more honestly

The side-nav label and panel heading no longer present this area as `Setup`.

Current wording:

1. side nav uses `Ctrl`
2. panel heading uses `Studio Controls`

This is a better fit because the panel is not onboarding or setup in the traditional sense. It is contextual control for the current studio session.

### 3. Demo-style route boot behavior was reduced

`src/App.tsx` no longer parses:

1. `?demo=...`
2. `?view=...`

Normal app boot now only uses `launch=1` to force the launchpad open, or opens the launchpad when no persisted session exists.

This matters because the normal product route is no longer shaped around guided demo assumptions.

### 4. Submission framing was removed from the main repo surface

These files were deleted:

1. `SUBMISSION_BRIEF.md`
2. `SUBMISSION_CHART.md`

That reduces repo-level showcase framing and keeps the main project narrative closer to the actual product.

### 5. README language is cleaner

`README.md` was adjusted to reduce demo-oriented wording and keep the framing closer to product use.

Examples:

1. `Best demo path` became `Quick start`
2. `Starter scenes for quick demos and fast first use` became `Starter scenes for quick starts and first use`

These are small copy changes, but they support the larger identity cleanup.

## What remains genuinely improved from the earlier pass

These improvements are still in place and still matter:

1. reviewer-facing studio chrome was removed from the shipped app
2. `SubmissionGuide` is gone
3. readiness-style internal metrics are gone
4. `AudioContext.tsx` no longer owns all render and session workflow orchestration
5. service boundaries now exist for render and session workflows
6. `SettingsSidebar.tsx` is a shallow shell
7. setup open state is no longer restored on boot
8. the repo now has a minimal test harness

## Current file-boundary state

### Better than before

1. `src/components/SettingsSidebar.tsx` is small and focused
2. `src/components/settings/WorkspaceSettingsPanel.tsx` is smaller and delegates further
3. render behavior is separated in `src/services/renderWorkflow.ts`
4. session and checkpoint behavior is separated in `src/services/sessionWorkflow.ts`

### Still too large

1. `src/context/AudioContext.tsx`
2. `src/components/Arranger.tsx`
3. `src/components/DeviceRack.tsx`

Those are still the main structural risks.

## Current product assessment

### Stronger now

The product shell is cleaner and more disciplined than it was before:

1. fewer reviewer-era assumptions
2. less repo-level showcase framing
3. more honest product terminology
4. better separation inside the control surface

### Still weak

The architectural center of gravity is still too concentrated:

1. `AudioContext.tsx` still does too much
2. `Arranger.tsx` is still oversized relative to its importance
3. `DeviceRack.tsx` still holds too many concerns in one file
4. correctness coverage is still modest relative to product complexity

## Current verdict

These numbers are intentionally blunt:

1. as a browser-native music product: `8/10`
2. as a serious lightweight DAW today: `6.5/10`
3. as a GarageBand replacement today: `4.5/10`
4. as a codebase moving in the right direction: `8.5/10`

The increase is real, but still bounded by the same core issues:

1. oversized central files
2. limited correctness coverage
3. still too much interaction density in major surfaces

## What another AI should keep

Keep:

1. shared canonical session model
2. arranger-centered workflow
3. clip-to-pattern relationship
4. hybrid synth and sample lane model
5. offline rendering
6. MIDI import and export
7. checkpoints and persistence
8. cleaner non-reviewer shell
9. extracted render and session workflow boundaries
10. finer-grained workspace control sections
11. the test harness

## What another AI should cut or demote further

Cut or demote:

1. any remaining explanatory copy that narrates the tool instead of helping use it
2. any route or UI behavior that still assumes the app needs to stage itself like a presentation
3. any control-surface wording that implies a separate mini application instead of one studio

## What another AI should refactor next

### 1. Break down `Arranger.tsx`

This is now the clearest next target.

Best next decomposition:

1. overview strip
2. marker and section UI
3. lane rendering
4. clip rendering and drag logic
5. phrase desk
6. song tools

### 2. Split `AudioContext.tsx` further

Best next boundaries:

1. transport controller
2. arranger mutation helpers
3. track and pattern mutation helpers
4. bounce history helpers
5. reducer action maps

### 3. Attack `DeviceRack.tsx`

Best next split:

1. source surface
2. shape surface
3. space surface
4. sample slicing surface
5. recall and preset surface

## What another AI should test next

1. reducer tests
2. clip duplication tests
3. make unique tests
4. split clip tests
5. JSON import-export round trip
6. MIDI import into session shape
7. checkpoint restore into live editor state
8. render scope handling at integration level

## Bottom line

SonicStudio is cleaner, more credible, and more internally disciplined than it was two passes ago.

The product-smell problem is now substantially improved.
The architecture problem is still only partially improved.

The next phase should stay focused on:

1. deeper decomposition
2. correctness coverage
3. reducing oversized central files

That is where the real leverage is now.
