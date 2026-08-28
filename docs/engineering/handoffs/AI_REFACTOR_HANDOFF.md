# SonicStudio Refactor Handoff

## Purpose

This handoff captures the critique driven cleanup and refactor work completed after the sharp product review. It is meant for another AI or engineer who needs a precise map of what changed, what was deliberately removed, what was structurally improved, what was verified, and what still deserves scrutiny.

## Critique themes that were followed

The critique argued that SonicStudio had a stronger musical core than product shell, and that the shipped app was mixing studio workflow with reviewer artifacts and weak structural boundaries.

The highest priority recommendations were:

1. remove reviewer facing product chrome from the main build
2. split `AudioContext.tsx` into more disciplined boundaries
3. extract render and export orchestration
4. extract checkpoint and persistence workflow orchestration
5. break `SettingsSidebar.tsx` into smaller task based sections
6. add tests around extracted workflows

This pass followed those points directly.

## What was removed from the product surface

These reviewer era surfaces were removed from the shipped studio UI in the earlier critique pass and remain removed:

1. in app submission guide
2. readiness panel
3. GarageBand fit metric
4. monetization metric
5. reviewer score framing inside setup
6. reviewer first routes tied to the main product shell

Files removed earlier and still absent:

1. `src/components/SubmissionGuide.tsx`
2. `src/utils/readiness.ts`

## Structural changes implemented in this pass

### 1. Render and export workflow extracted from `AudioContext.tsx`

New files:

1. `src/services/workflowTypes.ts`
2. `src/services/renderWorkflow.ts`

What moved out of `AudioContext.tsx`:

1. shared export and render types
2. bounce scope formatting
3. render payload construction for pattern, song, loop window, and clip window scopes
4. offline mix export orchestration
5. offline stem export orchestration
6. bounce history entry construction

Practical effect:

1. `AudioContext.tsx` no longer owns the full offline render loop
2. render scope building is now testable without booting the whole context
3. bounce history construction is now centralized and reusable
4. mix and stem export behavior is still the same product behavior, but the orchestration is no longer trapped inside the context file

### 2. Session and checkpoint workflow extracted from `AudioContext.tsx`

New file:

1. `src/services/sessionWorkflow.ts`

What moved out of `AudioContext.tsx`:

1. session persistence wrapper
2. checkpoint save workflow
3. checkpoint restore workflow
4. checkpoint delete workflow
5. JSON session import workflow
6. MIDI session import workflow

Practical effect:

1. `AudioContext.tsx` now coordinates session actions instead of directly parsing files and calling storage primitives
2. storage primitives remain in `src/project/storage.ts`
3. app level session behavior now has its own workflow boundary

### 3. `SettingsSidebar.tsx` split into real sections

New files:

1. `src/components/settings/SettingsPrimitives.tsx`
2. `src/components/settings/WorkspaceSettingsPanel.tsx`
3. `src/components/settings/TrackSettingsPanel.tsx`
4. `src/components/settings/OutputSettingsPanel.tsx`

Rewritten file:

1. `src/components/SettingsSidebar.tsx`

What changed:

1. the old monolithic settings component was replaced by a shallow shell
2. workspace actions now live in `WorkspaceSettingsPanel`
3. selected track editing now lives in `TrackSettingsPanel`
4. master and output shaping now live in `OutputSettingsPanel`
5. shared UI primitives were extracted instead of being redefined in the giant file

Practical effect:

1. settings code now reflects the tab structure it already presented in the UI
2. future edits can target a panel without reopening a 1,100 line file
3. the product shell is easier to reason about and modify

### 4. Transient setup visibility no longer pollutes the normal route

Updated file:

1. `src/project/storage.ts`

What changed:

1. persisted `isSettingsOpen` is no longer restored from local session UI state

Why:

1. setup open state is transient UI chrome, not essential project state
2. restoring it made the default route feel cluttered and harder to read
3. this change improves first impression without changing the musical project data

Practical effect:

1. the studio now reopens cleaner on the normal route even if setup was open during the previous session

## Behavioral impact

These changes were intended to preserve product behavior while improving discipline.

Expected unchanged behavior:

1. offline mix export still works
2. offline stem export still works
3. JSON session export and import still work
4. MIDI import and export still work
5. bounce history still records export outcomes
6. checkpoints still save, restore, and delete
7. setup tabs still expose the same broad capabilities

Expected improved behavior:

1. the normal studio route is less cluttered on load because setup no longer reopens from persisted UI state
2. the codebase has clearer ownership around render and session workflows
3. settings edits can be made panel by panel rather than inside one monolith

## Tests added

New files:

1. `src/services/renderWorkflow.test.ts`
2. `src/services/sessionWorkflow.test.ts`

Package changes:

1. added `vitest`
2. added `npm test`

What the tests cover:

### `renderWorkflow.test.ts`

1. pattern render payload applies transport safety settings
2. loop window render trims arranger clips and markers into the window
3. clip window render returns `null` when there is no selected clip
4. bounce history entry construction preserves snapshot and target metadata

### `sessionWorkflow.test.ts`

1. session persistence delegates through the workflow boundary
2. checkpoint save refreshes the checkpoint list
3. JSON session import uses the hydration boundary
4. MIDI import failure returns `null`
5. checkpoint list, restore, and delete delegate correctly

## Verification completed

### Static verification

Commands run successfully:

1. `npm run lint`
2. `npm test`
3. `npm run build`

### Browser verification

Browser tool used:

1. `/Users/erendiracisneros/.npm-global/bin/agent-browser`

Routes checked:

1. `http://127.0.0.1:3001/SonicStudio/`

Artifacts captured:

1. `/tmp/sonic-refactor-check.png`
2. `/tmp/sonic-refactor-final.png`

What was confirmed in browser:

1. the studio shell loads
2. the normal route renders without the settings panel forced open
3. the main arranger surface remains present
4. setup is still reachable through the `SETUP` button
5. the sound desk still renders
6. the refactor did not break the visible product shell

## Files materially changed in this pass

### Added

1. `src/services/workflowTypes.ts`
2. `src/services/renderWorkflow.ts`
3. `src/services/sessionWorkflow.ts`
4. `src/components/settings/SettingsPrimitives.tsx`
5. `src/components/settings/WorkspaceSettingsPanel.tsx`
6. `src/components/settings/TrackSettingsPanel.tsx`
7. `src/components/settings/OutputSettingsPanel.tsx`
8. `src/services/renderWorkflow.test.ts`
9. `src/services/sessionWorkflow.test.ts`
10. `AI_REFACTOR_HANDOFF.md`

### Updated

1. `src/context/AudioContext.tsx`
2. `src/components/SettingsSidebar.tsx`
3. `src/project/storage.ts`
4. `package.json`

## Current architectural status after this pass

### Better than before

1. render orchestration is no longer embedded entirely inside the context
2. session and checkpoint orchestration now have a real service boundary
3. settings are no longer trapped inside one oversized component
4. the codebase now has focused tests for extracted workflow modules

### Still weak

1. `src/context/AudioContext.tsx` is still very large
2. reducer logic and app orchestration are still heavily centralized
3. `src/components/Arranger.tsx` is still extremely large
4. `src/components/DeviceRack.tsx` is still large and probably wants its own similar split
5. there is still no reducer specific test coverage
6. export analysis is stronger than before, but mastering grade accuracy is still approximate

## What another AI should analyze next

If another AI continues from here, the best next scrutiny targets are:

### 1. Split `AudioContext.tsx` further

Current best decomposition candidates:

1. transport controller
2. track and pattern mutation helpers
3. arranger mutation helpers
4. snapshot and bounce history actions
5. reducer specific action maps

### 2. Reduce `Arranger.tsx`

Best candidates:

1. lane row rendering
2. clip rendering and drag behavior
3. phrase desk
4. song tools section
5. overview strip

### 3. Add reducer and integration tests

Most useful next tests:

1. clip duplication and make unique
2. section duplication
3. MIDI import into session shape
4. checkpoint restore into editor state
5. export scope handling at reducer and orchestration boundaries

### 4. Decide whether setup should keep all current breadth

Now that setup is split, the next question is product scope:

1. should bounce history stay in setup or move to output history
2. should track jump stay in setup or become a top-shell tool
3. should starter scenes stay under setup once launchpad already handles first run

## Short summary for another AI

This pass followed the critique in a concrete way rather than with more UI polish. The main work was structural:

1. export and render orchestration moved out of `AudioContext.tsx`
2. session and checkpoint orchestration moved out of `AudioContext.tsx`
3. `SettingsSidebar.tsx` was split into real tab specific components
4. transient setup open state no longer reopens on normal load
5. focused tests were added for the new workflow boundaries

The codebase is more disciplined than before, but the next serious work is still deeper decomposition of `AudioContext.tsx` and `Arranger.tsx`, plus stronger reducer and integration tests.
