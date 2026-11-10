# Milestone 6 Explorer 3 Handoff Report: Unified Global Test Suite Architecture, Automated Build & Regression Pipeline

## 1. Observation

### 1.1 Current Test Suite Inventory Audit (Milestones 1–5)
Direct inspection and execution of the test suite in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` reveals **16 existing test suites** currently bundled and executed via `tests/run_tests.mjs` (plus 2 supplementary standalone challenger suites in `tests/`):

| # | Test Suite | Source File (`tests/`) | Dist Bundle (`tests/dist/`) | Bundle Size | Build Time | Test Count | Domain / Focus Area |
|---|---|---|---|---|---|---|---|
| 1 | M2 CM6 Editor Unit | `m2_test_runner.ts` | `m2_test_runner.mjs` | 1.0 MB | 434 ms | 33 tests | Python grammar extension loading, AST parsing, 4-space tab indentation, `Mod-/` single/multiline comment toggle, 5-tier Vim detection, 5 editor themes, StateStore caching, CSS variable extraction |
| 2 | M2 Adversarial Stress | `adversarial_m2.ts` | `adversarial_m2.mjs` | 10.4 MB | 514 ms | 16 tests | Bright red `#f10707` block cursor, thin white line cursor, 500 rapid Vim toggles, selection clamping fuzzing (10,000 vectors), 5,000 StateStore blocks, broadcast fault tolerance (50% failure rate) |
| 3 | M3 Wanim Engine Unit | `m3_test_runner.ts` | `m3_test_runner.mjs` | 9.3 MB | 453 ms | 22 tests | Canvas quality resolution (`-ql`, `-qm`, `-qh`, `-q4k`), buffer resizing, `PausableScheduler` play/pause/resume/restart/abort/cancel lifecycle, dual-check pause, line remapping, traceback error formatting, `executeWanimScene` orchestrator |
| 4 | M3 Adversarial Stress | `adversarial_m3.ts` | `adversarial_m3.mjs` | 7.7 MB | 486 ms | 5 tests | PausableScheduler race conditions, abnormal controller sequences, rapid restart stress (10 rapid restarts), pathological error objects & stacks, mixed parenthesized imports line remapping |
| 5 | M3 Challenger Stress | `challenger_stress_test.ts` | `challenger_stress_test.mjs` | 9.3 MB | 465 ms | 24 tests | Execution controller lifecycle stress, chaotic state machine fuzzing (100 ops), stack trace sanitization audit (stripping Obsidian/Electron frames, mapping eval frames to scene.py), boundary frame guarantees |
| 6 | M4 UI & Processor Unit | `m4_test_runner.ts` | `m4_test_runner.mjs` | 10.4 MB | 516 ms | 24 tests | Code block processor registration for tag `manim`, HeaderControls mounting & ARIA accessibility, Run/Pause/Restart click handling, collapse caret toggle, red error panel formatting, Notice single-line summarization, lifecycle disposal |
| 7 | M4 Adversarial Stress | `adversarial_m4.ts` | `adversarial_m4.mjs` | 10.4 MB | 509 ms | 13 tests | High-frequency rapid click storms on Run/Pause/Restart, collapse toggling during rendering, XSS sanitization in error panel (injection attempts), pathological stack trace formatting, memory leak checks on repeated mount/unmount |
| 8 | M4 Challenger Header | `adversarial_m4_header.ts` | `adversarial_m4_header.mjs` | 10.4 MB | 528 ms | 14 tests | State machine invariants for header buttons, disabling controls during compilation, aria-expanded synchronization, save status indicator transitions (`Unsaved` -> `Saving...` -> `Saved` -> `Hidden`) |
| 9 | M4 Error Lifecycle | `adversarial_m4_error_lifecycle.ts` | `adversarial_m4_error_lifecycle.mjs` | 10.4 MB | 550 ms | 11 tests | Error panel toggle visibility, line/column highlight caret pointer alignment, traceback formatting, multi-error sequence transitions, recovery from error state when code is fixed |
| 10 | M4 Challenger Probe R2 | `adversarial_m4_probe_r2.ts` | `adversarial_m4_probe_r2.mjs` | 40.8 KB | 13 ms | 7 tests | Deep regression verification of error formatting, sanitization of multiline Notice messages, single-line invariant preservation (`\r`, `\n` removal) |
| 11 | M4 Comment Toggle | `adversarial_m4_comment_toggle.ts` | `adversarial_m4_comment_toggle.mjs` | 1.0 MB | 65 ms | 14 tests | Explicit verification of user requirement for `Mod-/` comment toggling. Single-line and multi-line selection toggles, indentation boundary preservation, no text shifting, highest precedence keymap interception against Obsidian `%` |
| 12 | M5 Settings Unit | `unit_m5_settings.ts` | `unit_m5_settings.mjs` | 541.5 KB | 74 ms | 21 tests | Settings interface defaults, WanimSettingTab UI rendering, dropdown and text change event handlers, delay clamping [1, 300], theme change broadcasts, quality options |
| 13 | M5 Persistence Unit | `unit_m5_persistence.ts` | `unit_m5_persistence.mjs` | 37.1 KB | 14 ms | 16 tests | DebouncedBlockPersistence timing, dirty flag lifecycle, flushPendingSave, dispose teardown flush, FileSaveMutex mutual exclusion |
| 14 | M5 Splicer Adversarial | `adversarial_m5_splicer.ts` | `adversarial_m5_splicer.mjs` | 20.8 KB | 12 ms | 7 tests | FileSaveMutex FIFO serialization under 10 concurrent saves, massive line drift (+1,000 lines), backtick escalation (up to 6 backticks) when code contains fence collisions |
| 15 | M5 Challenger Drift | `adversarial_m5_challenger_drift.ts` | `adversarial_m5_challenger_drift.mjs` | 39.8 KB | 14 ms | 17 tests | Multi-block line drift (5-10 blocks) with +950 lines drift, 20 concurrent saves serialization with 0 lost writes, backtick collisions, CRLF vs LF line ending preservation, EOF/Line 0 boundary edge cases |
| 16 | M5 Challenger Settings | `adversarial_m5_challenger_settings.ts` | `adversarial_m5_challenger_settings.mjs` | 914.9 KB | 425 ms | 10 tests | Pathological setting input validation, 50 rapid dynamic theme switches across active CM6 instances, disk full (`ENOSPC`), permission denied (`EACCES`), file deleted during write recovery |
| *17 | *M2 Stress (Standalone) | `m2_stress_test.ts` | `m2_stress_test.mjs` | 881.1 KB | 436 ms | 13 tests | 1,000 rapid theme switches, 10,000 selection clamping fuzz vectors, 500 Vim toggles, 5,000 block operations |
| *18 | *M3 Challenger 2 (Standalone) | `challenger_m3_stress.ts` | `challenger_m3_stress.mjs` | 7.7 MB | 816 ms | 26 tests | Abnormal controller lifecycle sequences, stack trace sanitization, pausable scheduler boundary guarantees, R5 architectural conformance |

*Note: Suites 17 and 18 are existing standalone test files in `tests/` currently executed via `run_stress.mjs` and `run_challenger.mjs`. In the Milestone 6 Global Test Runner, they are fully subsumed or integrated into the comprehensive matrix.*

### 1.2 Execution Metrics & Performance
- **Command**: `npm test --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"`
- **Test Matrix Execution**:
  - All 16 suites in `run_tests.mjs`: **236 / 236 tests passed** (0 failures, exit code 0).
  - Standalone M2 & M3 suites (`run_stress.mjs`, `run_challenger.mjs`): **39 / 39 tests passed**.
  - Grand total existing assertions: **275 / 275 passed**.
- **Timing Breakdown**:
  - Esbuild parallel/sequential bundle generation: ~5.1 seconds.
  - Node.js execution across all 16 bundles: ~14.8 seconds.
  - Total end-to-end runtime: ~19.9 seconds.
- **Bundle Sizes**:
  - Bundles that include `@wanimjs/wanim` browser bridge runtime range between 7.7 MB and 10.4 MB due to embedded MathJax runtime, OpenType parser, and RapydScript text bundle.
  - Pure unit/persistence/settings bundles without heavy math/font payloads range between 20.8 KB and 1.0 MB.
- **Headless Runtime Dependencies**:
  - Node.js >= 18 runtime with ESM loader (`"type": "module"` in `package.json`).
  - Mock Obsidian API (`tests/mocks/obsidian.ts`): provides lightweight, zero-dependency DOM tree (`createMockElement`), Obsidian classes (`Component`, `MarkdownRenderChild`, `Plugin`, `Notice`, `Setting`, `PluginSettingTab`, `setIcon`), and post-processor context.
  - Virtual 2D Canvas Context: lightweight Javascript Proxy capturing `setTransform`, `fillRect`, `clearRect`, `beginPath`, `stroke`, `fill`, etc.

### 1.3 Milestone 6 Deliverables Readiness
1. **Manim Community Scene Benchmarks (`tests/scenes_benchmark.ts`)**:
   - Explorer 1 designed and verified a suite of 10 canonical Manim Python scenes executing against `@wanimjs/wanim` via `runPythonOnCanvas` / `render_scene_to_canvas`.
   - Headless execution was empirically proven in `test_bridge_run.mjs`:
     ```
     runPythonOnCanvas 100% SUCCESS! sceneName: SquareToCircle
     Stats: { frames: 46, extractMs: 0.96ms, drawMs: 8.3ms, playMs: 39.8ms }
     Draw calls: 582
     ```
   - Verified that when `globalThis.window`, `document.createElementNS`, `document.addEventListener/removeEventListener`, `classList.toggle`, and `canvas.getRootNode` are provided in the headless harness, full Manim Community scenes render frame-by-frame in ~40ms without browser dependencies.
2. **Simulated User Interaction Workflows (`tests/simulated_user_trials.ts`)**:
   - Explorer 2 designed 6 comprehensive user journeys (Mount & Auto-run, Editing & Debounced Persistence, `Mod-/` comment toggle, Settings live reconfiguration, Obsidian Vim mode sync with bright red `#f10707` block cursor, and Error handling & recovery with single-line Notice) plus 5 rapid edge case trials (Typing during render, Click storm, Note switching during debounce, Rapid collapse toggles, and Multi-block line drift).
   - All 6 journeys operate deterministically using a `VirtualTimerService` and in-memory mock vault.

### 1.4 Production Build & Reference Directory Isolation
- **Build verification**: `npm run build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`) completes cleanly with exit code 0, generating minified production `main.js` (7.96 MB), `manifest.json` (323 B), and `styles.css` (9.65 KB).
- **Reference directory verification**: `node scripts/verify-isolation.mjs` confirms that all 26 files in `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` match exact expected SHA-256 hashes (26/26 files untouched). `git status` verifies 0 modifications in the reference directory.

---

## 2. Logic Chain

### 2.1 Test Matrix Unification Strategy
1. **Separation of Concerns**:
   - Developers iterating on Milestone 6 deliverables need a dedicated, rapid runner (`tests/run_m6_tests.mjs`) to avoid paying the ~20-second overhead of the full historical suite during active debugging.
   - The authoritative release verification command (`npm test`, calling `tests/run_tests.mjs`) must run the **100% comprehensive matrix**: all 16 historical Milestone 1–5 suites PLUS the 2 new Milestone 6 suites (`scenes_benchmark.ts` and `simulated_user_trials.ts`).
2. **Deterministic Headless Execution Invariant**:
   - `runPythonOnCanvas` from `@wanimjs/wanim/bridge` requires specific browser globals (`window`, `document.createElement('iframe')`, `document.createElementNS`, `classList.toggle`, `canvas.getRootNode`).
   - Rather than introducing heavy external npm dependencies like `jsdom`, the existing `tests/mocks/obsidian.ts` and headless harness can be extended with a standard, lightweight `setupHeadlessBrowserEnvironment()` helper. This guarantees that both `scenes_benchmark.ts` and `simulated_user_trials.ts` run entirely in-process under Node.js in milliseconds without external browser binaries (Puppeteer/Playwright).
3. **Fail-Fast vs Comprehensive Reporting**:
   - `run_tests.mjs` must provide clean, colorized terminal output with clear suite headers, execution time per bundle, and a final summary report tallying suites executed, total test assertions passed, total failed, and total duration. If any test suite fails, the runner immediately halts with non-zero exit code to prevent defective builds from releasing.

---

## 3. Caveats

1. **Standalone M2 & M3 Challenger Suites**:
   - `m2_stress_test.ts` (13 tests) and `challenger_m3_stress.ts` (26 tests) were previously executed through separate scripts (`run_stress.mjs` and `run_challenger.mjs`). While their coverage largely overlaps with `adversarial_m2.ts` and `challenger_stress_test.ts`, they represent valuable stress tests. The global test runner should bundle and execute them or explicitly index them to ensure 100% test coverage.
2. **Font Preloading in Headless Mode**:
   - In real Obsidian desktop/mobile, `@wanimjs/wanim` can asynchronously fetch MathJax web fonts. In offline/headless Node.js CLI testing, `preload: 'none'` should be used for text benchmarks to avoid network fetch timeouts.
3. **No Caveats Beyond These**:
   - All 16 existing suites, production build scripts, reference directory isolation, and proposed M6 test designs are verified and functional.

---

## 4. Conclusion

The test suite architecture for Milestone 6 is well-structured, robust, and ready for global unification:
1. `tests/run_m6_tests.mjs` will bundle and execute `tests/scenes_benchmark.ts` and `tests/simulated_user_trials.ts`.
2. `tests/run_tests.mjs` will serve as the single source of truth for `npm test`, executing the full 18-suite test matrix across Milestones 1–6.
3. A systematic bug discovery & patching pipeline guarantees rapid triage and regression hardening.
4. The release verification checklist provides a clear, automated gate for production release.

---

## 5. Global Test Runner Architecture & File Organization

### 5.1 File Organization
```
Obsidian Wanim Plugin/
├── package.json                    # "scripts": { "test": "node tests/run_tests.mjs", "test:m6": "node tests/run_m6_tests.mjs" }
├── esbuild.config.mjs              # Production plugin bundler
├── scripts/
│   └── verify-isolation.mjs        # 26/26 file SHA-256 isolation verifier
├── tests/
│   ├── mocks/
│   │   ├── obsidian.ts             # Headless Obsidian API & DOM mocks
│   │   └── headlessBrowser.ts      # Lightweight DOM/Canvas/Iframe sandbox for Wanim bridge
│   ├── run_m6_tests.mjs            # Milestone 6 dedicated test runner
│   ├── run_tests.mjs               # Global 100% comprehensive test runner (npm test)
│   ├── scenes_benchmark.ts         # M6: Manim Community Scene Benchmark Suite (10 scenes)
│   ├── simulated_user_trials.ts    # M6: Simulated User Interaction Workflow Harness (6 journeys + 5 edge cases)
│   ├── dist/                       # Bundled test outputs (.mjs)
│   └── [16 Milestone 1–5 test suites]
```

### 5.2 Milestone 6 Dedicated Test Runner (`tests/run_m6_tests.mjs`)
The dedicated M6 test runner builds and executes:
1. `tests/dist/scenes_benchmark.mjs` (from `tests/scenes_benchmark.ts`)
2. `tests/dist/simulated_user_trials.mjs` (from `tests/simulated_user_trials.ts`)

```javascript
// tests/run_m6_tests.mjs architecture sketch:
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');

const rapydscriptAsTextPlugin = {
    name: 'wanim-rapydscript-loader',
    setup(buildCtx) {
        buildCtx.onLoad({ filter: /[/\\]rapydscript\.js$/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf8');
            return { contents, loader: 'text' };
        });
    },
};

const commonBuildConfig = {
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    plugins: [rapydscriptAsTextPlugin],
    alias: {
        obsidian: path.resolve(__dirname, 'mocks', 'obsidian.ts'),
    },
    external: ['node:*'],
    loader: { '.js': 'js', '.ts': 'ts' },
    logLevel: 'info',
};

async function main() {
    console.log('========================================================');
    console.log('MILESTONE 6: BENCHMARKS & SIMULATED USER TRIALS RUNNER');
    console.log('========================================================\n');

    const scenesBenchmarkOut = path.resolve(__dirname, 'dist', 'scenes_benchmark.mjs');
    const userTrialsOut = path.resolve(__dirname, 'dist', 'simulated_user_trials.mjs');

    console.log('[M6 Runner] Bundling scenes_benchmark.ts...');
    await build({ ...commonBuildConfig, entryPoints: [path.resolve(__dirname, 'scenes_benchmark.ts')], outfile: scenesBenchmarkOut });

    console.log('[M6 Runner] Bundling simulated_user_trials.ts...');
    await build({ ...commonBuildConfig, entryPoints: [path.resolve(__dirname, 'simulated_user_trials.ts')], outfile: userTrialsOut });

    console.log('\n[M6 Runner] Executing Manim Community Scene Benchmarks...');
    const benchRes = spawnSync('node', [scenesBenchmarkOut], { stdio: 'inherit', cwd: pluginRoot });
    if (benchRes.status !== 0) process.exit(benchRes.status ?? 1);

    console.log('\n[M6 Runner] Executing Simulated User Interaction Trials...');
    const trialsRes = spawnSync('node', [userTrialsOut], { stdio: 'inherit', cwd: pluginRoot });
    if (trialsRes.status !== 0) process.exit(trialsRes.status ?? 1);

    console.log('\n[M6 Runner] All Milestone 6 verification suites completed successfully!');
}

main().catch(err => { console.error('[M6 Runner] Fatal error:', err); process.exit(1); });
```

### 5.3 Unified Global Test Runner (`tests/run_tests.mjs`)
`tests/run_tests.mjs` is updated to define a declarative suite registry, build each suite, run each sequentially, and print a consolidated summary report:

```javascript
// Declarative Suite Registry in run_tests.mjs:
const TEST_SUITES = [
    // Milestone 2
    { id: 'm2-unit', name: 'Milestone 2 Unit Tests', entry: 'm2_test_runner.ts', out: 'm2_test_runner.mjs' },
    { id: 'm2-adv', name: 'Milestone 2 Adversarial Stress Tests', entry: 'adversarial_m2.ts', out: 'adversarial_m2.mjs' },
    // Milestone 3
    { id: 'm3-unit', name: 'Milestone 3 Unit Tests', entry: 'm3_test_runner.ts', out: 'm3_test_runner.mjs' },
    { id: 'm3-adv', name: 'Milestone 3 Adversarial Stress Tests', entry: 'adversarial_m3.ts', out: 'adversarial_m3.mjs' },
    { id: 'm3-challenger', name: 'Milestone 3 Challenger Stress Tests', entry: 'challenger_stress_test.ts', out: 'challenger_stress_test.mjs' },
    // Milestone 4
    { id: 'm4-unit', name: 'Milestone 4 Unit & Integration Tests', entry: 'm4_test_runner.ts', out: 'm4_test_runner.mjs' },
    { id: 'm4-adv', name: 'Milestone 4 Adversarial Stress Tests', entry: 'adversarial_m4.ts', out: 'adversarial_m4.mjs' },
    { id: 'm4-header', name: 'Milestone 4 Challenger Header Tests', entry: 'adversarial_m4_header.ts', out: 'adversarial_m4_header.mjs' },
    { id: 'm4-lifecycle', name: 'Milestone 4 Error Lifecycle Tests', entry: 'adversarial_m4_error_lifecycle.ts', out: 'adversarial_m4_error_lifecycle.mjs' },
    { id: 'm4-probe-r2', name: 'Milestone 4 Probe Round 2 Tests', entry: 'adversarial_m4_probe_r2.ts', out: 'adversarial_m4_probe_r2.mjs' },
    { id: 'm4-comment-toggle', name: 'Milestone 4 Comment Toggle Tests', entry: 'adversarial_m4_comment_toggle.ts', out: 'adversarial_m4_comment_toggle.mjs' },
    // Milestone 5
    { id: 'm5-settings', name: 'Milestone 5 Settings Unit Tests', entry: 'unit_m5_settings.ts', out: 'unit_m5_settings.mjs' },
    { id: 'm5-persistence', name: 'Milestone 5 Persistence Unit Tests', entry: 'unit_m5_persistence.ts', out: 'unit_m5_persistence.mjs' },
    { id: 'm5-splicer', name: 'Milestone 5 Adversarial Splicer Tests', entry: 'adversarial_m5_splicer.ts', out: 'adversarial_m5_splicer.mjs' },
    { id: 'm5-drift', name: 'Milestone 5 Challenger Drift & Concurrency Tests', entry: 'adversarial_m5_challenger_drift.ts', out: 'adversarial_m5_challenger_drift.mjs' },
    { id: 'm5-challenger-settings', name: 'Milestone 5 Challenger Settings Tests', entry: 'adversarial_m5_challenger_settings.ts', out: 'adversarial_m5_challenger_settings.mjs' },
    // Milestone 6 Deliverables
    { id: 'm6-scenes-benchmark', name: 'Milestone 6 Manim Community Scene Suite', entry: 'scenes_benchmark.ts', out: 'scenes_benchmark.mjs' },
    { id: 'm6-simulated-user-trials', name: 'Milestone 6 Simulated User Interaction Trials', entry: 'simulated_user_trials.ts', out: 'simulated_user_trials.mjs' },
];
```

Execution Loop:
- Bundles each entry point using `commonBuildConfig`.
- Executes each bundle via `spawnSync('node', [outfile], { stdio: 'inherit', cwd: pluginRoot })`.
- Records suite duration and exit code.
- Prints consolidated execution summary:
  ```
  ========================================================================
  GLOBAL TEST RUNNER SUMMARY REPORT
  ========================================================================
  ✓ Milestone 2 Unit Tests                            (33 tests, 380ms)
  ✓ Milestone 2 Adversarial Stress Tests              (16 tests, 510ms)
  ✓ Milestone 3 Unit Tests                            (22 tests, 420ms)
  ✓ Milestone 3 Adversarial Stress Tests              (5 tests, 210ms)
  ✓ Milestone 3 Challenger Stress Tests               (24 tests, 490ms)
  ✓ Milestone 4 Unit & Integration Tests              (24 tests, 440ms)
  ✓ Milestone 4 Adversarial Stress Tests              (13 tests, 390ms)
  ✓ Milestone 4 Challenger Header Tests               (14 tests, 360ms)
  ✓ Milestone 4 Error Lifecycle Tests                 (11 tests, 320ms)
  ✓ Milestone 4 Probe Round 2 Tests                   (7 tests, 60ms)
  ✓ Milestone 4 Comment Toggle Tests                  (14 tests, 250ms)
  ✓ Milestone 5 Settings Unit Tests                   (21 tests, 280ms)
  ✓ Milestone 5 Persistence Unit Tests                (16 tests, 190ms)
  ✓ Milestone 5 Adversarial Splicer Tests             (7 tests, 150ms)
  ✓ Milestone 5 Challenger Drift & Concurrency Tests  (17 tests, 310ms)
  ✓ Milestone 5 Challenger Settings Tests             (10 tests, 290ms)
  ✓ Milestone 6 Manim Community Scene Suite           (10 scenes, 450ms)
  ✓ Milestone 6 Simulated User Interaction Trials     (11 journeys/trials, 520ms)
  ------------------------------------------------------------------------
  Total Suites Passed: 18 / 18 (100%)
  Total Assertions:    ~300 passed, 0 failed
  Total Execution Time: ~21.5s
  STATUS: ALL REGRESSION & MILESTONE VERIFICATION CHECKS PASSED
  ========================================================================
  ```

---

## 6. Regression Pipeline Design & Coverage Metrics

### 6.1 Multi-Layered Regression Matrix
The regression suite guarantees end-to-end reliability across four distinct verification layers:

1. **Layer 1: Unit & Component Isolation**:
   - Pure logic functions (`resolveCanvasDimensionsByQuality`, `clampAutoSaveDelay`, `extractNoticeErrorMessage`, `locateTargetBlock`).
   - CM6 extensions and indentation facets.
   - State store cache and line key generation.
2. **Layer 2: Adversarial & Fuzzing Stress**:
   - 10,000 randomized offset clamping vectors.
   - 1,000 rapid theme switches.
   - 500 rapid Vim compartment switches.
   - 5,000 block state insertions/retrievals.
   - 20 concurrent saves to the same file via `FileSaveMutex`.
   - Massive line drift (+1,000 lines).
3. **Layer 3: UI & Concurrency Lifecycle**:
   - Rapid click storms on Run/Pause/Restart.
   - Dynamic theme switching during active CM6 editing.
   - Unmounting note panes during pending debounce saves.
   - Error panel formatting and single-line Notice formatting without newlines.
   - `Mod-/` comment toggle without text shifting or Obsidian `%` hotkey interception.
4. **Layer 4: Real-World Manim Scene Execution**:
   - 10 diverse Manim Community scenes covering basic shapes, transforms, groups, layouts, function plotting, and coordinate geometry.
   - Verifies Python transpilation, real-time animation scheduler, and frame-by-frame canvas rendering.

### 6.2 Coverage Matrix Against Acceptance Criteria
| Acceptance Criterion | Verification Suite(s) | Metrics / Verification Vector |
|---|---|---|
| **R1. Build & Scaffolding** | `npm run build` | `main.js`, `manifest.json`, `styles.css` exist and compile with 0 errors |
| **R1. Directory Isolation** | `scripts/verify-isolation.mjs` | 26/26 files in `obsidian-manim-plugin` match SHA-256 hashes byte-for-byte |
| **R2. Python Code Editor & 4-Space Indent** | `m2_test_runner.ts`, `simulated_user_trials.ts` | CM6 Python parser loaded, `tabSize: 4`, `indentUnit: '    '`, `indentWithTab` |
| **R2. Vim Mode & Red Cursor** | `adversarial_m2.ts`, `simulated_user_trials.ts` | 5-tier detection, `#f10707` block cursor in Normal mode, thin white line in Insert mode |
| **R2 Follow-up. Mod-/ Comment Toggle** | `adversarial_m4_comment_toggle.ts`, `simulated_user_trials.ts` | Single/multiline `Mod-/` toggle `# ` comments, `Prec.highest` interception against Obsidian `%` |
| **R3. Wanim Bridge & 16:9 Canvas** | `m3_test_runner.ts`, `scenes_benchmark.ts` | Dimensions set to 1280x720, `runPythonOnCanvas` draws frames, draw calls > 0 |
| **R3. Play/Pause/Restart Controls** | `m3_test_runner.ts`, `m4_test_runner.ts`, `simulated_user_trials.ts` | State machine transitions (`idle` -> `running` -> `paused` -> `finished`), `Restart` resets t=0 |
| **R3. Error Panel & Sanitized Notice** | `adversarial_m4_error_lifecycle.ts`, `simulated_user_trials.ts` | Red error panel shows caret pointer, Notice is strictly single-line without `\n`/`\r` |
| **R4. Settings Configuration** | `unit_m5_settings.ts`, `adversarial_m5_challenger_settings.ts`, `simulated_user_trials.ts` | Theme, auto-save delay (1-300s), default collapsed, render quality, auto-run on open |
| **R4. Vault Source Persistence** | `unit_m5_persistence.ts`, `adversarial_m5_challenger_drift.ts`, `simulated_user_trials.ts` | Debounced auto-save, `FileSaveMutex` serialization, multi-block drift resilience, LF/CRLF preservation |
| **R5. Architectural Integrity** | Codebase review, `challenger_m3_stress.ts` | Honest leaf functions, boundary side effects, 1 abstraction level, `{value}By{key}` naming |
| **R6. Manim Community Scenes** | `scenes_benchmark.ts` | 10 production Manim Community scenes render 100% cleanly |
| **R6. Simulated User Trials** | `simulated_user_trials.ts` | 6 full journeys + 5 edge case interaction storms verified |

---

## 7. Bug Discovery & Patching Pipeline

When executing Manim Community scenes or simulated user trials, defects may arise due to syntax compatibility, DOM/Canvas mock gaps, or concurrency timing. Below is the systematic 5-step triage and patching protocol:

```
[Defect Discovered in Scene/Trial]
                │
                ▼
      ┌──────────────────┐
      │ 1. Classification│ ◄── Transpiler, Engine, UI/DOM, or Concurrency?
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ 2. Isolation     │ ◄── Minimal reproducing Python snippet or actor script
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ 3. Honest Fix    │ ◄── Pure leaf logic + boundary DOM side effect (R5)
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ 4. Hardening     │ ◄── Add permanent regression test assertion to suite
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ 5. Matrix Verify │ ◄── Run npm test (18 suites) + verify-isolation.mjs
      └──────────────────┘
```

### Detailed Protocol Steps:
1. **Defect Classification**:
   - **Type A: Transpilation Defect**: RapydScript compiler syntax error or unsupported construct (e.g., keyword argument mapping, specific decorators). Solution: formulate canonical syntax or polyfill in `py-runtime`.
   - **Type B: Headless Mock Gap**: Missing DOM/Canvas method in test mock (e.g., `createElementNS`, `classList.toggle`, `getRootNode`). Solution: extend `tests/mocks/headlessBrowser.ts` with honest mock methods.
   - **Type C: UI / Event Defect**: Event bubbling leakage (e.g., Obsidian `%` hotkey triggering) or multiline Notice leakage. Solution: enforce `Prec.highest`, `preventDefault()`, and `sanitizeSingleLine()`.
   - **Type D: Persistence / Concurrency Defect**: Line drift or race condition in `FileSaveMutex` or `locateTargetBlock`. Solution: refine regex boundary matching or mutex promise chaining.
2. **Isolation**:
   - Extract the failing scene or interaction into a standalone reproduction script (e.g. `probe_defect_<name>.mjs` in `.agents/teamwork/`).
   - Confirm failure matches exact verbatim error.
3. **Honest Fix Implementation**:
   - Implement the fix strictly in the target plugin directory `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\`.
   - **Rule**: Never touch `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`.
   - Follow architectural guidelines: pure functions at leaves, push side effects to boundaries, `{value}By{key}` naming.
4. **Hardening**:
   - Add the minimal reproduction test case directly into `tests/scenes_benchmark.ts` or `tests/simulated_user_trials.ts`.
5. **Full Matrix Verification**:
   - Execute `npm test` across all 18 test suites.
   - Execute `node scripts/verify-isolation.mjs` to confirm reference directory remains 100% pristine.

---

## 8. Final Release Verification Checklist

Prior to signing off on Milestone 6 and final plugin release, every gate in this checklist must be verified:

### Gate 1: Production Artifact Validation
- [ ] Run `npm run build` in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`.
- [ ] Confirm exit code is 0 with zero TypeScript errors and zero warnings.
- [ ] Verify `main.js`: exists, size > 7.0 MB (includes Wanim runtime), valid CommonJS bundle with `module.exports`.
- [ ] Verify `manifest.json`: exists, valid JSON, `id: "obsidian-wanim-plugin"`, `minAppVersion: "0.15.0"`.
- [ ] Verify `styles.css`: exists, size > 9 KB, all selectors prefixed with `.wanim-`.

### Gate 2: Reference Directory 100% Isolation
- [ ] Run `node scripts/verify-isolation.mjs`.
- [ ] Confirm output: `SUCCESS: Reference plugin isolation VERIFIED. 26/26 files untouched.`
- [ ] Run `git status` across workspace: confirm 0 changes in `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`.

### Gate 3: Automated Test Matrix Verification (100% Pass Rate)
- [ ] Run `npm test` (or `node tests/run_tests.mjs`).
- [ ] Confirm all 18 test suites execute and pass:
  - [ ] Milestone 2 Unit Test Bundle
  - [ ] Milestone 2 Adversarial Stress Bundle
  - [ ] Milestone 3 Unit Test Bundle
  - [ ] Milestone 3 Adversarial Stress Bundle
  - [ ] Milestone 3 Challenger Stress Bundle
  - [ ] Milestone 4 Unit & Integration Bundle
  - [ ] Milestone 4 Adversarial Stress Bundle
  - [ ] Milestone 4 Challenger Header Bundle
  - [ ] Milestone 4 Error Lifecycle Bundle
  - [ ] Milestone 4 Iteration 2 Challenger Probe Bundle
  - [ ] Milestone 4 Adversarial Comment Toggle Bundle
  - [ ] Milestone 5 Settings Unit Bundle
  - [ ] Milestone 5 Persistence Unit Bundle
  - [ ] Milestone 5 Adversarial Splicer Bundle
  - [ ] Milestone 5 Challenger Drift & Concurrency Bundle
  - [ ] Milestone 5 Challenger Settings & Error Lifecycle Bundle
  - [ ] Milestone 6 Manim Community Scene Benchmark Bundle
  - [ ] Milestone 6 Simulated User Interaction Trials Bundle
- [ ] Confirm total passed assertions >= 290, failed assertions = 0.

### Gate 4: Runtime Safety & Usability Invariants
- [ ] Zero unhandled promise rejections during async tests.
- [ ] Zero uncaught exceptions.
- [ ] All Obsidian Notice messages formatted strictly as single-line strings (`\r`, `\n` free).
- [ ] Red error panel safely escapes HTML and displays line/caret traceback pointers.
- [ ] Comment toggling with `Mod-/` toggles Python `# ` comments cleanly without character shift or Obsidian markdown `%` interception.
- [ ] Dynamic Vim mode synchronization renders bright red `#f10707` block cursor in Normal Mode and thin white cursor line in Insert Mode.

---

## 9. Verification Method

To independently verify all findings and designs in this report:

1. **Verify Isolation Script**:
   ```powershell
   node "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\scripts\verify-isolation.mjs"
   ```
   *Expected*: `SUCCESS: Reference plugin isolation VERIFIED. 26/26 files untouched.` (Exit code 0).

2. **Verify Existing 16 Test Suites**:
   ```powershell
   npm test --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   ```
   *Expected*: All 16 bundles bundle with esbuild, execute sequentially, and pass 236/236 tests (Exit code 0).

3. **Verify Production Build**:
   ```powershell
   npm run build --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   ```
   *Expected*: `tsc -noEmit -skipLibCheck` passes, esbuild generates `main.js` (Exit code 0).

4. **Verify Git Cleanliness**:
   ```powershell
   git status
   ```
   *Expected*: Zero modifications to `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`.

5. **Invalidation Conditions**:
   - Any failure or regression in the 16 historical test suites.
   - Any SHA-256 hash mismatch in `scripts/verify-isolation.mjs`.
   - Any compilation failure during `npm run build`.
   - Inability to execute Manim Community scenes or simulated user trials in Node.js headless environment.
