## 2026-11-09T16:54:40Z
You are the Replacement Worker for Milestone 5: Settings Tab & Vault Source Persistence of the Obsidian Wanim Plugin.

Target Plugin Directory: C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\
Read-only Reference Directory: C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\ (STRICTLY READ-ONLY: 0 files created, modified, or deleted).
Authoritative User Request: C:\Users\angel\Notes\.agents\teamwork\ORIGINAL_REQUEST.md
Project Plan: C:\Users\angel\Notes\.agents\teamwork\orchestrator\PROJECT.md
Your State Folder: C:\Users\angel\Notes\.agents\teamwork\teamwork_worker_m5_2\

Inputs from Milestone 5 Explorers:
- Explorer 1 (Settings Tab & Schema): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m5_1\handoff.md
- Explorer 2 (Debounced Source Persistence Engine): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m5_2\handoff.md
- Explorer 3 (Multi-Block Coordination & Splicing Invariants): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m5_3\handoff.md

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Architectural Guidelines (R5):
1. Honest functions at leaves: signatures as truth, explicit dependency injection (pass VaultIOAdapter, TimerService, etc.). No hidden globals or singletons in core logic.
2. One level of abstraction: decompose into discrete helper functions ("stacking bricks").
3. Invariant-rich signatures: parse, don't validate (return structured result types e.g. ReplaceFenceResult, SplicedDocumentResult).
4. Dictionary naming convention: {value}By{key} (e.g. labelByIndicatorStatus, themeExtensionByTheme).

Execution Plan:
1. Update `tests/mocks/obsidian.ts`: Add mocks for `PluginSettingTab`, `Setting`, and UI elements if not present.
2. Update `src/types.ts`: Ensure M5 types (splicing options/results, persistence configuration) are defined.
3. Implement `src/settings.ts`:
   - `WanimSettingTab` extending `PluginSettingTab` from `obsidian`.
   - Settings:
     - Editor theme dropdown ('obsidian', 'github-light', 'github-dark', 'one-dark', 'monokai')
     - Auto-save delay input/slider (1-300 seconds, default 60)
     - Collapse code by default toggle (default false)
     - Render quality dropdown ('-ql', '-qm', '-qh', '-q4k', default '-qm')
     - Auto-run on open toggle (default true)
   - Visual conventions matching `obsidian-manim-plugin` without touching the reference directory.
4. Update `src/ui/headerControls.ts`: Support unsaved / save error indicator states if needed.
5. Implement `src/persistence/blockSplicer.ts`:
   - Pure functional fence parsing and string replacement algorithms designed by Explorer 2 and 3.
   - CRLF and LF preservation (`detectLineEnding`).
   - Boundary verification (opening fence match, closing fence match).
   - Multi-block line drift resilience: content matching fallback (`innerContent === target.lastKnownSource`) to locate blocks deterministically even when preceding blocks shifted line coordinates.
   - Backtick collision avoidance (upgrade fence length if Python code contains backticks).
6. Implement `src/persistence/sourcePersistence.ts`:
   - `FileSaveMutex` / `FileSaveQueue`: sequential FIFO promise queue keyed by `sourcePath` to prevent concurrent write races.
   - `DebouncedBlockPersistence`:
     - Tracks dirty state and last persisted content.
     - Debounce timer configured by `plugin.settings.autoSaveDelaySeconds`.
     - Visual status lifecycle integration with `HeaderControls`:
       - Dirty edits -> showUnsaved or appropriate indicator
       - Saving started -> `headerControls.showSaving()`
       - Saving succeeded -> `headerControls.showSaved()` (reverts after 1000ms)
       - Saving failed -> `headerControls.showSaveError()`
     - Immediate flush on play, restart, collapse toggle, or component unload (`onunload`).
7. Update `src/main.ts`:
   - Add `this.addSettingTab(new WanimSettingTab(this.app, this))`
   - `loadSettings()` using `resolvePluginSettings(await this.loadData(), DEFAULT_SETTINGS)`
   - `saveSettings()` using `await this.saveData(this.settings)`
   - Settings update broadcast (updating themes across active editors when theme setting changes).
8. Update `src/ui/codeBlockProcessor.ts`:
   - Wire `WanimCodeEditorChild.onDocChanged` to the persistence coordinator.
   - Trigger immediate persistence flush before running or restarting scenes.
   - Connect collapse and unload flushes.
9. Implement comprehensive automated tests:
   - `tests/unit_m5_settings.ts`: Tests setting defaults, bounds clamping (1-300), dropdown options, and theme resolution.
   - `tests/unit_m5_persistence.ts`: Tests pure block splicing, CRLF/LF preservation, multi-block line drift resilience, backtick upgrades, concurrent file mutex serialization, and debounced auto-save lifecycle.
   - `tests/run_m5_tests.mjs`: Standalone runner for M5 tests.
   - Integrate M5 tests into `tests/run_tests.mjs`.
10. Execute and verify:
   - `node tests/run_m5_tests.mjs`
   - `npm test` (all test suites must pass 100%)
   - `npm run build` (clean TypeScript compilation and bundle generation)
   - `node scripts/verify-isolation.mjs` (verify 26/26 files in obsidian-manim-plugin untouched)


## 2026-11-09T17:07:38Z
**Context**: Milestone 5 Implementation Checkpoint
**Content**: Heartbeat check: What step are you currently working on? Please update progress.md with your latest status so the orchestrator can track your progress.
**Action**: Please reply with your current status and update progress.md.
