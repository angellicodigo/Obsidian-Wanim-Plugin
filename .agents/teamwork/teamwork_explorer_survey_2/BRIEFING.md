# BRIEFING — 2026-11-09T03:58:00Z

## Mission
Investigate the Wanim execution engine, npm packages, browser bridge, and Python execution on HTML5 canvas.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: C:\Users\angel\Notes
- State folder: C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_survey_2
- Original parent: 20c2d47d-d294-467c-9e69-233a08f70b0d
- Milestone: Wanim Engine Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do not modify project code files directly
- Write all findings to handoff.md and report to parent

## Current Parent
- Conversation ID: 20c2d47d-d294-467c-9e69-233a08f70b0d
- Updated: 2026-11-09T03:58:00Z

## Investigation State
- **Explored paths**:
  - `@wanimjs/wanim@0.1.3` npm package tarball, `browser/` and `dist/` subpaths
  - `browser/bridge.browser.js`, `dist/bridge.d.ts`, `dist/browser.d.ts`
  - `dist/compiler.js`, `dist/compile_error.js`, `dist/preprocess.js`, `browser/rapydscript.js`
  - `dist/utils/scheduler.js`, `dist/interactive/presentation.js`, `dist/scene/scene.js`
  - `C:\Users\angel\.gemini\antigravity-cli\brain\297f2c6b-e69a-4d05-b196-0b0d450a9639\wanim_implementation_plan.md`
  - `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\esbuild.config.mjs`, `package.json`
- **Key findings**:
  - Wanim uses a patched RapydScript compiler (`browser/rapydscript.js`) transpiling Python into JS AST in <50ms, executed inside an isolated hidden iframe. It does NOT use Pyodide or WASM for Python execution.
  - `compilePython` requires `globalThis.RapydScript` to be defined. RapydScript can be inlined as text into `main.js` via an esbuild text plugin and initialized synchronously (`new Function('external_namespace', text)(globalThis)`).
  - esbuild bundling requires `external: ['node:fs', 'node:fs/promises']` due to dynamic imports in `numpy-ts`, and `define: { 'import.meta.url': JSON.stringify('http://localhost/') }` (or `document.baseURI`) to avoid `TypeError: Invalid URL` in font initialization.
  - `runPythonOnCanvas(source, canvas, options)` takes `quality` (`-ql`, `-qm`, `-qh`), `fps`, `realtime`, `signal` (AbortSignal), `onSceneReady`, `onController`, etc., and returns `Promise<RunPythonResult>`.
  - Play/pause can be cleanly implemented via custom `PausableScheduler` hooked into `scene.set_run_scheduler()` through `onSceneReady`.
  - Syntax errors provide exact line, column, snippet, and caret pointer via `formatCompileError`. Unsupported imports are caught by `unsupportedImportError`.
  - Wanim provides 16:9 canvas resolutions: `-ql` (854x480, 15fps), `-qm` (1280x720, 30fps), `-qh` (1920x1080, 60fps), `-q4k` (3840x2160, 60fps).
- **Unexplored areas**: None. All objectives addressed.

## Key Decisions Made
- Confirmed esbuild configuration requirements (external node builtins, import.meta.url define, rapydscript text loader).
- Verified pausable frame scheduler architecture.

## Artifact Index
- handoff.md — comprehensive structured findings and handoff report
- progress.md — liveness heartbeat and step tracking
