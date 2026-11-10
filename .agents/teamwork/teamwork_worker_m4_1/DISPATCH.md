## 2026-11-09T15:17:40Z
You are the Milestone 4 Worker (teamwork_worker).
Your task is to implement Milestone 4: UI Header Controls, Red Error Panel, and Markdown Code Block Processor.

State Folder: C:\Users\angel\Notes\.agents\teamwork\teamwork_worker_m4_1\
Target Plugin Working Directory: C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\
Reference Plugin Directory (STRICTLY READ-ONLY - DO NOT TOUCH): C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\

Authoritative Inputs:
- C:\Users\angel\Notes\.agents\teamwork\ORIGINAL_REQUEST.md
- C:\Users\angel\Notes\.agents\teamwork\orchestrator\PROJECT.md
- Explorer 1 Handoff (Code Block Processor): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_1\handoff.md
- Explorer 2 Handoff (Header Controls): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_2_gen2\handoff.md
- Explorer 3 Handoff (Error Panel): C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Architectural Requirements (R5):
1. Local reasoning and honest functions: leaf functions must be pure, depending only on arguments. Push DOM manipulation, timers, and Obsidian I/O to boundaries. Use explicit dependency injection.
2. Single uniform level of abstraction ("stacking bricks"): high-level orchestrator functions must read like a table of contents without dipping into low-level mechanics.
3. Invariant-rich signatures: use explicit union types (CollapseState, PlaybackButtonState, IndicatorStatus) instead of boolean flags.
4. Dictionary naming: use {value}By{key} convention for all lookup maps.

Files You Own Exclusively:
- src/ui/headerControls.ts
- src/ui/errorPanel.ts
- src/ui/codeBlockProcessor.ts
- src/main.ts (update to register code block processor)
- styles.css (refine any selectors if needed per explorer recommendations)
- tests/mocks/obsidian.ts (add Notice class mock if needed)
- tests/m4_test_runner.ts
- tests/run_tests.mjs (wire m4_test_runner.ts)

Requirements to Implement:
1. Header Controls (src/ui/headerControls.ts):
   - Run/Pause toggle button: displays 'play' / 'pause' icon, 'Run' / 'Pause' label, aria-label, disabled state. Routes click based on execution state (play, pause, resume).
   - Restart button: displays 'rotate-ccw' icon, restarts animation from frame 0.
   - Collapse Caret: displays '▾' / '▸', toggles editor display, invokes requestMeasure() when expanded, handles click and Enter/Space keydown, header click delegation with button click avoidance.
   - Save status indicator: .wanim-save-state displaying 'Running...', 'Paused', 'Saving...', 'Saved'. Includes 1000ms timer for 'Saved' that reverts back to active execution state instead of clearing blindly.
   - Decoupled into pure leaf functions, boundary DOM procedures, controller class, and {value}By{key} tables.
2. Red Error Panel (src/ui/errorPanel.ts):
   - pre.wanim-error-panel element displaying formatted compilation error with caret (^) or clean runtime traceback.
   - Pure leaf text extraction, safe textContent rendering (XSS safe), clearError, and single-line summary Notice with "Wanim render failed: " prefix.
   - Controller class and mount helper.
3. Code Block Processor (src/ui/codeBlockProcessor.ts):
   - registerMarkdownCodeBlockProcessor("manim", ...) handler.
   - DOM mounting hierarchy: .wanim-block > [.wanim-block-header, .wanim-code-editor, .wanim-canvas-container > canvas.wanim-canvas, pre.wanim-error-panel].
   - Mounts WanimCodeEditorChild via ctx.addChild(editorChild).
   - Gated auto-run on open respecting plugin.settings.autoRunOnOpen.
   - Synchronizes controller lifecycle and editorChild.register teardown to prevent frame/memory leaks.
4. Main Plugin (src/main.ts):
   - Call registerWanimCodeBlockProcessor(this) in onload().
5. Testing & Verification:
   - Implement tests/m4_test_runner.ts testing header controls, error panel, code block processor DOM layout, and lifecycle hooks.
   - Run `npm run build` and ensure 0 TypeScript or esbuild errors.
   - Run `npm test` and ensure all test suites (M2, M3, M4) pass 100%.
   - Run isolation audit `node scripts/verify-isolation.mjs` verifying 26/26 files in obsidian-manim-plugin untouched.
6. Write a comprehensive handoff report at:
   C:\Users\angel\Notes\.agents\teamwork\teamwork_worker_m4_1\handoff.md
   documenting:
   - Observation: files modified/created, build & test outputs.
   - Logic Chain: architectural and implementation choices.
   - Caveats: edge cases handled or pending M5/M6 items.
   - Conclusion: summary of deliverables.
   - Verification: exact commands and results.
7. Send a message to your parent when done.
