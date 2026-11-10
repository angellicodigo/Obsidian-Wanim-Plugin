# Handoff Report: Milestone 4 — Markdown Code Block Processor & DOM Layout Design

## 1. Observation

Direct examination of the workspace, build scripts, reference plugin (`obsidian-manim-plugin`), and existing Wanim modules (`Obsidian Wanim Plugin`) revealed the following exact files, structures, line references, and behaviors.

### 1.1 Plugin Architecture & File Inventory
- **Build Status**:
  Command executed: `cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"; npm run build`
  Result: exited with code 0 (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`).
- **Existing Source Structure (`src/`)**:
  - `src/main.ts` (lines 64–74): `onload()` currently initializes settings, initializes RapydScript, and registers the vault config listener. It does **not** yet register the code block processor.
  - `src/types.ts`:
    - `WanimPluginSettings` (lines 16–22): includes `readonly autoRunOnOpen: boolean;` (default `true`), `readonly defaultCollapsed: boolean;` (default `false`), `readonly renderQuality: RenderQuality;` (default `'-qm'`), and `readonly editorTheme: WanimEditorTheme;` (default `'obsidian'`).
    - `WanimExecutionController` (lines 85–95): defines `play()`, `pause()`, `resume()`, `restart()`, `stop()`, `dispose()`, `isRunning()`, and `isPaused()`.
    - `WanimRunOptions` (lines 97–106): defines `source`, `canvas`, `quality`, `onStateChange`, `onError`, `onFinished`, `onSceneReady`, and `signal`.
    - `WanimFormattedError` (lines 112–154): union of `FormattedCompileError`, `FormattedImportError`, `FormattedRuntimeError`, and `FormattedGenericError`.
  - `src/editor/editorChild.ts` (lines 126–322):
    - `WanimCodeEditorChild` extends `MarkdownRenderChild` and implements `ThemeableEditor`.
    - Constructor signature: `constructor(containerEl: HTMLElement, options: WanimCodeEditorOptions)` where `options` contains `plugin`, `ctx`, `contextEl`, `initialSource`, `theme`, and `initialBlockState`.
    - Exposes `getCode(): string`, `setCode(newCode: string): void`, `requestMeasure(): void`, and `snapshotCurrentState(forceCollapsed?: boolean): void`.
    - Inherits `register(callback: () => void): void` from `Component` / `MarkdownRenderChild` to register teardown hooks.
  - `src/editor/editorStyle.ts`:
    - Exposes `syncStylesFromNativeCodeMirror(hostEl: HTMLElement)` which copies Obsidian CM6 CSS variables (`--wanim-code-font-family`, `--wanim-code-font-size`, etc.) from `.markdown-source-view.mod-cm6` to the host element.
  - `src/editor/stateStore.ts`:
    - Exposes `getPersistedBlockState(ctx: MarkdownPostProcessorContext, el: HTMLElement): WanimBlockState | undefined`.
    - Exposes `saveBlockState(ctx: MarkdownPostProcessorContext, el: HTMLElement, patch: BlockStatePatch): void`.
  - `src/engine/wanimBridge.ts`:
    - Exposes `executeWanimScene(options: WanimRunOptions, dependencies?: WanimBridgeDependencies): Promise<WanimExecutionController>`.
    - Note: `executeWanimScene` automatically calls `void controller.play()` upon initialization (line 318).
    - `controller.dispose()` cancels the frame scheduler, aborts the active run controller, and clears the canvas to black (lines 212–220).
  - `src/engine/errorFormatter.ts`:
    - Exposes `formatWanimError(error: unknown, sourceCode: string = ''): WanimFormattedError`.
    - Pure leaf function: normalizes syntax errors (with column `^` pointers), unsupported import diagnostics, and clean runtime tracebacks.
  - `styles.css`:
    - All selectors scoped under `.wanim-`:
      - `.wanim-block` (lines 7–16): wrapper div with `border-radius: 10px; background: var(--background-secondary); overflow: hidden;`.
      - `.wanim-block-header` (lines 19–30): flex header with `display: flex; align-items: center; gap: 8px; cursor: pointer;`.
      - `.wanim-collapse-caret` (lines 32–51): `display: inline-flex; font-size: 20px; line-height: 1; cursor: pointer;`.
      - `.wanim-block-controls` (lines 53–58): flex container with `gap: 6px;`.
      - `.wanim-run-button` (lines 87–95): `order: 1; display: inline-flex; align-items: center; gap: 6px;`.
      - `.wanim-button-icon` (lines 107–111) and `.wanim-run-label` (lines 113–115).
      - `.wanim-restart-button` (lines 117–134): `order: 2; display: inline-flex; align-items: center;`.
      - `.wanim-save-state` (lines 60–65): `order: 3; font-size: 11px; color: var(--text-muted);`.
      - `.wanim-code-editor` (lines 137–190): editor container with `.cm-scroller` constrained to `min-height: 220px; max-height: 320px;`.
      - `.wanim-canvas`, `.wanim-canvas-container` (lines 273–286): `aspect-ratio: 16 / 9; border-radius: 8px; background: #000000; overflow: hidden; display: flex; justify-content: center; align-items: center;`.
      - `.wanim-canvas-container canvas` (lines 306–314): `display: block; width: 100%; height: 100%; object-fit: contain;`.
      - `pre.wanim-error-panel` (lines 319–333): red border, reddish tint background (`color-mix(in srgb, var(--color-red) 8%, ...)`), `color: var(--text-error, var(--color-red))`, `font-family: var(--font-monospace)`, `white-space: pre-wrap`, `max-height: 220px; overflow: auto; display: none;`.

### 1.2 Reference Plugin Baseline (`obsidian-manim-plugin/src/manim/codeBlockProcessor.ts`)
- In the reference plugin:
  - Registers processor via `plugin.registerMarkdownCodeBlockProcessor('manim', async (source, el, ctx) => { ... })`.
  - DOM structure mounted inside `el`:
    1. `.manim-block`
    2. `.manim-block-header` > [`.manim-collapse-caret`, `.manim-block-controls` > [`.manim-run-button`, `.manim-restart-button`, `.manim-save-state`]]
    3. `.manim-code-editor.markdown-source-view.mod-cm6`
    4. `.manim-canvas`
    5. `pre.manim-error-panel`
  - Unconditional auto-run: reference calls `void execute();` unconditionally at line 315.
  - Lifecycle: `editorChild.register(() => { ... currentScene.dispose?.(); })` cleans up the active scene.

---

## 2. Logic Chain

1. **Processor Registration & Post-Processor Lifecycle**:
   - *Observation*: Obsidian's `plugin.registerMarkdownCodeBlockProcessor('manim', handler)` invokes `handler(source, el, ctx)` whenever a markdown fence ````manim ```` enters the DOM.
   - *Logic Step*: When Obsidian re-renders or unloads a block, child components registered via `ctx.addChild(editorChild)` are automatically notified and unloaded by Obsidian (`editorChild.unload()`).
   - *Logic Step*: By attaching a teardown hook via `editorChild.register(() => controller?.dispose())`, we guarantee that frame schedulers, requestAnimationFrame loops, and abort controllers are synchronously terminated, preventing background animation leaks and memory accumulation.

2. **DOM Hierarchy & CSS Alignment**:
   - *Observation*: The objective specifies mounting `.wanim-block` > [`.wanim-block-header`, `.wanim-code-editor`, `.wanim-canvas-container` enclosing `<canvas class="wanim-canvas">`, `pre.wanim-error-panel`].
   - *Logic Step*: In `styles.css`, `.wanim-canvas-container` enforces `aspect-ratio: 16 / 9` with a rounded container and black background, while `.wanim-canvas-container canvas` enforces responsive scaling with `object-fit: contain`.
   - *Logic Step*: Because `.wanim-canvas` selector in `styles.css` also includes `border: 1px solid ...`, styling the canvas element `<canvas class="wanim-canvas">` inside `.wanim-canvas-container` could create an unintended duplicate border unless explicitly reset with `border: none; border-radius: 0;` (see Caveats).

3. **Auto-Run on Open Condition**:
   - *Observation*: `plugin.settings.autoRunOnOpen` defaults to `true` (as defined in `types.ts`).
   - *Logic Step*: Unlike the reference plugin which unconditionally called `void execute()`, the Wanim processor must gate the initial execution call:
     ```ts
     if (plugin.settings.autoRunOnOpen) {
         void execute();
     }
     ```
   - *Logic Step*: If `autoRunOnOpen` is `false`, the editor, canvas, and header controls are mounted in an idle state: the canvas remains cleared black, the Run button displays `'Run'` (`play` icon), and the status indicator is hidden.

4. **Header Control State Machine**:
   - *Observation*: The Run/Pause button toggles execution state; the Restart button always runs from t=0; the Caret toggles code editor display; the status indicator reflects runtime state.
   - *Logic Step*: The block state machine transitions as follows:
     - `Idle / Finished / Aborted / Error`: Run button is `'Run'` (`play` icon); status indicator is hidden.
     - `Running / Playing`: Run button is `'Pause'` (`pause` icon); status indicator is `'Running...'`.
     - `Paused`: Run button is `'Run'` (`play` icon); status indicator is `'Paused'`.
     - Clicking `Run` when `Paused`: If code in editor matches `lastRanCode`, invoke `controller.resume()`. If code has changed, invoke fresh `execute()`.
     - Clicking `Restart`: Aborts current run and invokes fresh `execute()`.
     - Clicking `Caret` or Header background: Toggles editor `display: none` / `display: block`, updates caret to `'▸'` / `'▾'`, records state via `saveBlockState`, and calls `editorChild.requestMeasure()` when expanded.

5. **Red Error Panel Diagnostics**:
   - *Observation*: Syntax and compile errors from RapydScript, unsupported imports, and runtime errors must display without crashing Obsidian.
   - *Logic Step*: `src/engine/errorFormatter.ts` already formats every error into `WanimFormattedError` with clean caret pointer (`^`) or sanitized stack.
   - *Logic Step*: Wiring `onError` to `displayErrorInPanel(errorPanelEl, error, source)` sets `errorPanel.textContent = formatted.formattedText`, unhides the panel (`display: block`), and triggers `new Notice(\`Wanim render failed: ...\`)`. When a fresh execution or restart begins, `clearErrorPanel(errorPanelEl)` hides and empties the panel.

6. **Adherence to Architectural Guidelines (R5)**:
   - *Observation*: User guidelines require local reasoning, honest leaf functions, stacking bricks, empathetic signatures, and `{value}By{key}` naming.
   - *Logic Step*: Decomposing UI into 3 modules under `src/ui/`:
     - `src/ui/errorPanel.ts`: honest formatting and boundary DOM procedures for the red error panel.
     - `src/ui/headerControls.ts`: DOM builders, button/caret state transitions, and `{value}By{key}` mappings.
     - `src/ui/codeBlockProcessor.ts`: top-level orchestrator reading like a table of contents, with explicit dependency injection for headless testability.

---

## 3. Caveats

1. **Canvas Inner Border Selector Specificity**:
   - *Observation*: In `styles.css` lines 273–286, `.wanim-canvas, .wanim-canvas-container` defines `border: 1px solid var(--background-modifier-border)`.
   - *Caveat*: If `<canvas class="wanim-canvas">` is placed inside `<div class="wanim-canvas-container">`, the `<canvas>` will match the `.wanim-canvas` selector and receive an unnecessary inner border.
   - *Recommendation*: Add a rule in `styles.css` (or inline style reset):
     ```css
     .wanim-canvas-container canvas,
     .wanim-canvas-container .wanim-canvas {
         border: none !important;
         border-radius: 0 !important;
     }
     ```
2. **Dual-Plugin Community Settings Collision**:
   - *Observation*: Both `obsidian-manim-plugin` and `Obsidian Wanim Plugin` register tag `'manim'`.
   - *Caveat*: When testing in Obsidian, users must ensure the reference `obsidian-manim-plugin` is disabled in Obsidian Community Plugins to prevent handler conflict.
3. **Save Status Indicator Evolution in M5**:
   - *Observation*: In M4, `.wanim-save-state` displays execution states (`'Running...'`, `'Paused'`).
   - *Caveat*: In Milestone 5 (Source Persistence), debounced saving will also use this indicator for `'Saving...'` and `'Saved'`. The interface designed in M4 cleanly accommodates these statuses via `IndicatorStatus = 'hidden' | 'running' | 'paused' | 'saving' | 'saved'`.

---

## 4. Conclusion & Concrete Design Specification

Milestone 4 introduces three new modules under `src/ui/` in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`:
1. `src/ui/errorPanel.ts`
2. `src/ui/headerControls.ts`
3. `src/ui/codeBlockProcessor.ts`
And updates `src/main.ts` to call `registerWanimCodeBlockProcessor(this)` during `onload()`.

### 4.1 Module 1: `src/ui/errorPanel.ts`
- **Purpose**: Red error panel DOM component, visibility management, error formatting, and user notice triggering.
- **Key Types & Signatures**:
  ```ts
  export type NoticeDisplayFunction = (message: string) => void;

  export const defaultNoticeDisplay: NoticeDisplayFunction = (msg) => {
      new Notice(msg);
  };

  /** Boundary DOM builder creating pre.wanim-error-panel */
  export function createErrorPanel(containerEl: HTMLElement): HTMLPreElement;

  /** Boundary DOM procedure formatting and displaying error in panel */
  export function displayErrorInPanel(
      panelEl: HTMLPreElement,
      error: unknown,
      sourceCode: string = '',
      noticeFn: NoticeDisplayFunction = defaultNoticeDisplay
  ): WanimFormattedError;

  /** Boundary DOM procedure hiding and clearing error panel */
  export function clearErrorPanel(panelEl: HTMLPreElement): void;
  ```

### 4.2 Module 2: `src/ui/headerControls.ts`
- **Purpose**: Header DOM hierarchy creation, button state management, collapse caret transitions, and status indicator text.
- **Key Types & `{value}By{key}` Lookup Tables**:
  ```ts
  export type CollapseState = 'collapsed' | 'expanded';
  export type PlaybackButtonState = 'run' | 'pause';
  export type IndicatorStatus = 'hidden' | 'running' | 'paused' | 'saving' | 'saved';
  export type SetIconFunction = (parent: HTMLElement, iconId: string) => void;

  export const caretSymbolByCollapseState: Readonly<Record<CollapseState, string>> = Object.freeze({
      collapsed: '▸',
      expanded: '▾',
  });

  export const caretAriaLabelByCollapseState: Readonly<Record<CollapseState, string>> = Object.freeze({
      collapsed: 'Expand code',
      expanded: 'Collapse code',
  });

  export const iconNameByPlaybackState: Readonly<Record<PlaybackButtonState, string>> = Object.freeze({
      run: 'play',
      pause: 'pause',
  });

  export const labelByPlaybackState: Readonly<Record<PlaybackButtonState, string>> = Object.freeze({
      run: 'Run',
      pause: 'Pause',
  });

  export const ariaLabelByPlaybackState: Readonly<Record<PlaybackButtonState, string>> = Object.freeze({
      run: 'Run animation',
      pause: 'Pause animation',
  });

  export const labelByIndicatorStatus: Readonly<Record<IndicatorStatus, string>> = Object.freeze({
      hidden: '',
      running: 'Running...',
      paused: 'Paused',
      saving: 'Saving...',
      saved: 'Saved',
  });

  export interface HeaderControlsElements {
      readonly headerEl: HTMLElement;
      readonly caretEl: HTMLSpanElement;
      readonly controlsEl: HTMLElement;
      readonly runButtonEl: HTMLButtonElement;
      readonly runIconEl: HTMLSpanElement;
      readonly runLabelEl: HTMLSpanElement;
      readonly restartButtonEl: HTMLButtonElement;
      readonly saveStateEl: HTMLSpanElement;
  }
  ```
- **Key Pure & Boundary Procedures**:
  - `resolveCollapseState(isCollapsed: boolean): CollapseState` (Pure leaf)
  - `resolveOppositeCollapseState(current: CollapseState): CollapseState` (Pure leaf)
  - `applyCollapseState(codeEditorEl: HTMLElement, caretEl: HTMLElement, state: CollapseState): void` (Boundary DOM)
  - `applyPlaybackButtonState(btnEl: HTMLButtonElement, iconEl: HTMLElement, labelEl: HTMLElement, state: PlaybackButtonState, setIconFn?: SetIconFunction): void` (Boundary DOM)
  - `applyIndicatorStatus(indicatorEl: HTMLElement, status: IndicatorStatus): void` (Boundary DOM)
  - `buildHeaderControls(parent: HTMLElement, initialCollapsed: boolean, setIconFn?: SetIconFunction): HeaderControlsElements` (Stacking Bricks DOM Builder)

### 4.3 Module 3: `src/ui/codeBlockProcessor.ts`
- **Purpose**: Main orchestrator registering `plugin.registerMarkdownCodeBlockProcessor("manim", ...)`, constructing full DOM hierarchy, wiring CodeMirror 6 Python editor child, 16:9 responsive canvas, execution controller lifecycle, and error handling.
- **Exact DOM Hierarchy Mounted into `el`**:
  ```
  el (Obsidian Container)
  └── div.wanim-block (Wrapper)
      ├── div.wanim-block-header (Header)
      │   ├── span.wanim-collapse-caret [role="button", tabindex="0", aria-label]
      │   └── div.wanim-block-controls
      │       ├── button.wanim-control-button.wanim-run-button [type="button", order: 1]
      │       │   ├── span.wanim-button-icon (Obsidian SVG icon 'play' | 'pause')
      │       │   └── span.wanim-run-label ('Run' | 'Pause')
      │       ├── button.wanim-control-button.wanim-restart-button [type="button", order: 2]
      │       └── span.wanim-save-state [order: 3, display: none]
      ├── div.wanim-code-editor.markdown-source-view.mod-cm6 (Mounted via ctx.addChild(editorChild))
      ├── div.wanim-canvas-container (16:9 responsive aspect ratio div)
      │   └── canvas.wanim-canvas (HTML5 Canvas element)
      └── pre.wanim-error-panel (Initially hidden, display: none)
  ```
- **Lifecycle & Cleanup Contract**:
  - `editorChild.register(() => { lifecycle.isBlockUnloaded = true; lifecycle.controller?.dispose(); })` guarantees complete teardown when note is closed or re-rendered.
  - `executionId` counter ensures stale async scene resolution never mutates active DOM elements.
  - `if (plugin.settings.autoRunOnOpen) { void execute(); }` respects user configuration.
- **Dependency Injection**:
  - Optional `deps: { setIconFn?: SetIconFunction; noticeFn?: NoticeDisplayFunction }` enables 100% deterministic, headless unit and integration testing without mocking Obsidian singletons.

### 4.4 Plugin Registration (`src/main.ts`)
- In `src/main.ts`:
  ```ts
  import { registerWanimCodeBlockProcessor } from './ui/codeBlockProcessor';
  ...
  async onload(): Promise<void> {
      await this.initializeSettings();
      this.initializeRapydscript();
      this.registerVaultConfigListener();
      this.registerCodeBlockProcessor();
      this.logPluginLoaded();
  }

  private registerCodeBlockProcessor(): void {
      registerWanimCodeBlockProcessor(this);
  }
  ```

---

## 5. Verification Method

To independently verify the Milestone 4 design and downstream implementation:

1. **Build Compilation Verification**:
   Run the TypeScript compiler and esbuild production bundler:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npm run build
   ```
   *Expected Result*: Zero TypeScript compilation errors, valid `main.js` generated.

2. **DOM Structure & Hierarchy Unit Test**:
   Execute automated DOM verification test:
   - Instantiate JSDOM or mock HTMLElement container `rootEl`.
   - Call `buildWanimBlockDom(rootEl, false)`.
   - Assert:
     - `rootEl.querySelector('.wanim-block')` is truthy.
     - `rootEl.querySelector('.wanim-block-header .wanim-collapse-caret')` has text `'▾'`.
     - `rootEl.querySelector('.wanim-run-button .wanim-run-label')` has text `'Run'`.
     - `rootEl.querySelector('.wanim-restart-button')` is truthy.
     - `rootEl.querySelector('.wanim-canvas-container canvas.wanim-canvas')` is truthy.
     - `rootEl.querySelector('pre.wanim-error-panel')` has `style.display === 'none'`.

3. **Collapse / Expand State Verification**:
   - Call `applyCollapseState(codeEditorEl, caretEl, 'collapsed')`.
   - Assert `codeEditorEl.style.display === 'none'`, `caretEl.textContent === '▸'`.
   - Call `applyCollapseState(codeEditorEl, caretEl, 'expanded')`.
   - Assert `codeEditorEl.style.display === 'block'`, `caretEl.textContent === '▾'`.

4. **Error Panel Formatting Verification**:
   - Call `displayErrorInPanel(errorPanelEl, new Error("SyntaxError: unexpected token"), source, mockNoticeFn)`.
   - Assert `errorPanelEl.style.display === 'block'`.
   - Assert `errorPanelEl.textContent` contains syntax error details.
   - Assert `mockNoticeFn` called with `"Wanim render failed: ..."`.
   - Call `clearErrorPanel(errorPanelEl)`.
   - Assert `errorPanelEl.style.display === 'none'` and text is empty.

5. **Lifecycle Teardown Verification**:
   - Mount block and start execution.
   - Simulate markdown block unload by calling `editorChild.unload()`.
   - Assert `controller.dispose()` was invoked, cancelling scheduler and clearing canvas to black.

6. **Untouched Reference Directory Verification**:
   Verify `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` remains completely unmodified:
   ```powershell
   git status "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin"
   ```
   *Expected Result*: Zero modified or untracked files.
