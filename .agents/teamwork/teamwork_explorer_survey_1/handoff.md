# Handoff Report: Survey of Reference Plugin & Wanim Implementation Plan

## 1. Observation

Direct examination of `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` (read-only reference) and `C:\Users\angel\.gemini\antigravity-cli\brain\297f2c6b-e69a-4d05-b196-0b0d450a9639\wanim_implementation_plan.md` revealed the following exact files, structures, line references, and behaviors.

### 1.1 Project Structure & Build Tooling
- **Root Directory Files**:
  - `manifest.json`: Defines `id: "manim-plugin"`, `name: "Manim Plugin"`, `version: "1.0.0"`, `minAppVersion: "0.15.0"`, `isDesktopOnly: false`.
  - `package.json`: 
    - `type: "module"`, `main: "main.js"`.
    - `scripts`: `"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"`, `"dev": "node esbuild.config.mjs"`.
    - Key dependencies: `obsidian: "latest"`, `manim-web: "^0.40.1"`, `sucrase: "^3.35.1"`, `@codemirror/view: "6.38.6"`, `@codemirror/state: "6.5.0"`, `@codemirror/language: "6.12.2"`, `@codemirror/commands: "6.10.3"`, `@codemirror/autocomplete: "^6.17.0"`, `@codemirror/lang-javascript: "6.2.5"`, `@replit/codemirror-vim: "^6.4.0"`, `@codemirror/theme-one-dark: "^6.1.3"`, `@uiw/codemirror-theme-github: "^4.25.8"`, `@uiw/codemirror-theme-monokai: "^4.25.8"`.
  - `tsconfig.json`:
    - `baseUrl: "src"`, `module: "ESNext"`, `target: "ES6"`, `moduleResolution: "node"`, `isolatedModules: true`, `strictNullChecks: true`, `lib: ["DOM", "ES5", "ES6", "ES7"]`.
  - `esbuild.config.mjs`:
    - Bundles `src/main.ts` into `main.js` targeting `es2018`, format `cjs`.
    - Externalizes: `obsidian`, `electron`, `@codemirror/autocomplete`, `@codemirror/collab`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lint`, `@codemirror/search`, `@codemirror/state`, `@codemirror/view`, `@lezer/common`, `@lezer/highlight`, `@lezer/lr`, and `...builtinModules`.
    - Does *not* externalize `@replit/codemirror-vim`, `@codemirror/theme-one-dark`, `@uiw/*`, `manim-web`, or `sucrase` (they are bundled).
  - `styles.css`: Complete styling for `.manim-block`, header, controls, CM6 container, fat cursor, thin cursor, canvas, and error panel.
- **Source Modules (`src/`)**:
  - `src/main.ts`: Plugin lifecycle (`onload`, `onunload`, `loadSettings`, `saveSettings`, `updateAllEditorThemes`, `updateAllEditorVim`), registers `config-changed` event to detect Vim mode toggling, registers code block processor.
  - `src/settings.ts`: `MyPluginSettings` interface (`editorTheme`, `autoSaveDelaySeconds`, `defaultCollapsed`), `DEFAULT_SETTINGS`, `SampleSettingTab` implementing Obsidian `PluginSettingTab`.
  - `src/manim/codeBlockProcessor.ts`: Processor callback registering `"manim"` blocks, creates DOM elements, binds event listeners, handles play/pause/restart and collapse states.
  - `src/manim/editorChild.ts`: `ManimCodeEditorChild` extending `MarkdownRenderChild`, mounts CodeMirror 6, configures Vim Compartment and Theme Compartment, handles tab indentation, scroll/cursor caching, and debounced auto-saving.
  - `src/manim/editorStyle.ts`: `manimEditorTheme` CodeMirror theme extension configuring cursor rules, plus `syncStylesFromNativeCodeMirror` for inheriting font and color CSS variables from native Obsidian editor.
  - `src/manim/editorThemes.ts`: `getEditorThemeExtension` mapping theme names to CM6 extensions.
  - `src/manim/runtime.ts`: Transpilation via `sucrase`, DOM proxy sandbox, scene lifecycle management (`construct`, `play`, `wait`, `pause`, `resume`, `stop`, `dispose`), and player adapter.
  - `src/manim/sourcePersistence.ts`: `persistManimCode` using `ctx.getSectionInfo()`, `vault.cachedRead()`, and `vault.modify()`.
  - `src/manim/stateStore.ts`: Memory cache for block states (isCollapsed, cursor anchor/head, scroll top/left, hadFocus, timestamp) keyed by `${sourcePath}::line:${lineStart}`.

### 1.2 Code Block Processor Architecture & DOM Mounting (`src/manim/codeBlockProcessor.ts`)
- Registration:
  ```ts
  plugin.registerMarkdownCodeBlockProcessor('manim', async (source, el, ctx) => { ... });
  ```
- Exact DOM hierarchy mounted into `el`:
  1. `.manim-block` (wrapper div)
     - `syncStylesFromNativeCodeMirror(wrapper)` called immediately to mirror Obsidian CSS variables.
  2. `.manim-block-header` (header div)
     - `.manim-collapse-caret` (span, `role="button"`, `tabindex="0"`, text `'▾'` or `'▸'`)
     - `.manim-block-controls` (controls div)
       - `.manim-control-button.manim-run-button` (`<button type="button">`, CSS `order: 1`)
         - `.manim-button-icon` (`<span>` with Obsidian `play` or `pause` icon via `setIcon`)
         - `.manim-run-label` (`<span>` with text `'Run'` or `'Pause'`)
       - `.manim-control-button.manim-restart-button` (`<button type="button">`, CSS `order: 2`, icon `rotate-ccw`)
       - `.manim-save-state` (`<span>`, CSS `order: 3`, initially `display: none`)
  3. `.manim-code-editor.markdown-source-view.mod-cm6` (editor container div)
     - Mounted with `ManimCodeEditorChild(plugin, ctx, el, codeEditor, source, saveState, theme, savedState)`
     - Registered to lifecycle: `ctx.addChild(editorChild)`
  4. `.manim-canvas` (canvas div)
     - In runtime, contains `.manim-canvas-viewport` > `.manim-canvas-mount` (16:9 aspect ratio)
  5. `pre.manim-error-panel` (error panel element, initially `display: none`)
- Lifecycle & auto-run:
  - Processor calls `void execute();` immediately at line 315.
  - `editorChild.register(() => { ... })` unloads active animations and calls `currentScene.dispose?.()`.

### 1.3 UI Layout & Control Behaviors
- **Collapse Caret (`▾` / `▸`)**:
  - `setCollapsedState(codeEditorEl, collapseCaretEl, collapsed)` sets `codeEditorEl.style.display = collapsed ? 'none' : 'block'`, updates caret text, and updates `aria-label`.
  - Toggling occurs on:
    1. Clicking `.manim-collapse-caret`
    2. Keydown ('Enter' or ' ') on `.manim-collapse-caret`
    3. Clicking `.manim-block-header` outside `.manim-control-button`
  - When expanded, triggers `editorChild.requestMeasure()`.
  - State persisted via `saveBlockState(ctx, el, { isCollapsed })`.
- **Run / Pause Button**:
  - Clicking when idle or stopped triggers `execute()`.
  - Clicking while `isRunning` triggers `currentScene.pause?.()`, changes button label to `'Run'` with `play` icon, and sets `saveState.textContent = 'Paused'`.
  - Clicking while `isPaused` triggers `currentScene.resume?.()` if code has not changed; if code changed, re-runs `execute()`.
- **Restart Button**:
  - Clicking restarts scene execution from the start (`execute()`).
- **Save State Indicator (`.manim-save-state`)**:
  - During editing debounce: `'Saving...'` (`display: inline-block`).
  - Upon successful disk persistence: `'Saved'` (visible for 1000ms, then hidden).
  - During animation execution: `'Running...'`.
  - When paused: `'Paused'`.
- **Error Display (`pre.manim-error-panel`)**:
  - Styled with red border and background (`color-mix(in srgb, var(--color-red), transparent ...)`), `color: var(--text-error, var(--color-red))`, `font-family: var(--font-monospace)`, `white-space: pre-wrap`, `max-height: 220px; overflow: auto;`.
  - Formatted by `formatRuntimeError(error)` showing `error.name: error.message\n\nstack`. Also raises an Obsidian `new Notice("Manim render failed: ...")`.

### 1.4 CodeMirror Editor & Vim Integration (`src/manim/editorChild.ts`, `editorStyle.ts`)
- **Vim Mode Detection**:
  - In `isVimEnabled(plugin)`:
    ```ts
    const app = plugin.app as any;
    if (typeof app?.vault?.getConfig === 'function') {
        const val = app.vault.getConfig('vimMode');
        if (typeof val === 'boolean') return val;
    }
    if (typeof app?.vault?.config?.vimMode === 'boolean') return app.vault.config.vimMode;
    if (typeof app?.isVimEnabled === 'function') return Boolean(app.isVimEnabled());
    if (typeof app?.internalPlugins?.plugins?.['editor']?.instance?.options?.vimMode === 'boolean')
        return Boolean(app.internalPlugins.plugins['editor'].instance.options.vimMode);
    return Boolean((window as any)?.CodeMirrorAdapter?.Vim);
    ```
- **Vim Mode Synchronization**:
  - In `main.ts`:
    ```ts
    this.registerEvent(
        (this.app.vault as any).on('config-changed', () => {
            const isVim = isVimEnabled(this);
            this.updateAllEditorVim(isVim);
        })
    );
    ```
  - `ManimCodeEditorChild.setVimEnabled(enabled)` dispatches `this.vimCompartment.reconfigure(enabled ? vim() : [])`.
- **Vim Cursor Styling Rules**:
  - Normal Mode Red Block Cursor:
    ```css
    .manim-code-editor .cm-fat-cursor,
    .cm-fat-cursor {
        display: inline-block !important;
        visibility: visible !important;
        position: absolute !important;
        background: var(--manim-vim-cursor-color, #f10707) !important;
        background-color: var(--manim-vim-cursor-color, #f10707) !important;
        color: #ffffff !important;
        min-width: 0.65em !important;
        opacity: 0.75 !important;
        z-index: 100 !important;
        pointer-events: none !important;
    }
    .manim-code-editor .cm-vimCursorLayer {
        display: block !important;
        visibility: visible !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 100 !important;
        pointer-events: none !important;
    }
    ```
  - Insert Mode Thin White Cursor:
    ```css
    .manim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer,
    .manim-code-editor .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    .manim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) {
        display: none !important;
    }
    .manim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursor,
    .manim-code-editor .cm-cursor:not(.cm-fat-cursor) {
        display: block !important;
        visibility: visible !important;
        border-left: 2px solid #ffffff !important;
        border-left-width: 2px !important;
        border-left-color: #ffffff !important;
        width: 0 !important;
        background: transparent !important;
        z-index: 100 !important;
        opacity: 1 !important;
    }
    ```
  - Scroller Positioning: `.manim-code-editor .cm-scroller { position: relative !important; min-height: 220px; max-height: 320px; overflow: auto; }`.

### 1.5 Settings & Vault Persistence (`src/settings.ts`, `sourcePersistence.ts`, `stateStore.ts`)
- **Settings in Reference Plugin**:
  1. `editorTheme`: `'obsidian' | 'github-light' | 'github-dark' | 'one-dark' | 'monokai'` (default: `'obsidian'`)
  2. `autoSaveDelaySeconds`: number (default: `60`, validation range 1–300)
  3. `defaultCollapsed`: boolean (default: `false`)
- **Vault File Editing Mechanism (`sourcePersistence.ts`)**:
  - `ctx.getSectionInfo(contextEl)` returns `{ text: string, lineStart: number, lineEnd: number }`.
  - Gets `TFile` via `plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)`.
  - Reads raw note content: `const original = await plugin.app.vault.cachedRead(file);`.
  - Preserves opening fence format:
    ```ts
    const openingFence = sectionText.match(/^```manim[^\n]*/m)?.[0] ?? '```manim';
    const updatedSection = `${openingFence}\n${code}\n\```;
    ```
  - Line replacement:
    ```ts
    const lines = fullText.split('\n');
    lines.splice(safeStart, safeEnd - safeStart + 1, ...replacement.split('\n'));
    return lines.join('\n');
    ```
  - Commits with `await plugin.app.vault.modify(file, updatedDoc)` if `updatedDoc !== original`.
- **State Store (`stateStore.ts`)**:
  - Caches cursor `{ anchor, head }`, scroll `{ top, left }`, `hadFocus`, and `isCollapsed`.
  - Primary key: `${ctx.sourcePath}::line:${sectionInfo.lineStart}`.
  - Fallback key: `${ctx.sourcePath}::el:${el.id || 'default'}`.
  - Second-chance fallback: `lastActiveBlockByFile.get(ctx.sourcePath)` (if under 30s old).

### 1.6 Implementation Plan Inspection (`wanim_implementation_plan.md`)
Comparing `wanim_implementation_plan.md` against `obsidian-manim-plugin`:
1. **Target Directory**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` (isolated, completely separate).
2. **Old Plugin**: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` left strictly untouched.
3. **Execution Engine**:
   - Reference: JavaScript/TypeScript via `manim-web` and `sucrase`.
   - Wanim: Python via `@wanimjs/wanim` (`0.1.3`) browser bridge `runPythonOnCanvas` (powered by RapydScript compiler & NumPy-TS).
4. **Editor Language Extension**:
   - Reference: `@codemirror/lang-javascript` (`javascript({ typescript: true })`).
   - Wanim: `@codemirror/lang-python` (`python()`).
5. **Indentation**: 4 spaces (`tabSize: 4`, `indentUnit: 4`, `indentWithTab`).
6. **Settings Schema**:
   - Wanim expands the schema from 3 settings to 5 settings:
     1. `editorTheme` (`obsidian` default, `github-light`, `github-dark`, `one-dark`, `monokai`)
     2. `autoSaveDelaySeconds` (1–300, default `60`)
     3. `defaultCollapsed` (default `false`)
     4. `renderQuality` (`'-qm'` 720p/30fps default, `'-ql'` 480p/15fps, `'-qh'` 1080p/60fps)
     5. `autoRunOnOpen` (default `true`)
7. **Auto-Run Behavior**:
   - Reference runs unconditionally on mount (`void execute()`).
   - Wanim checks `if (plugin.settings.autoRunOnOpen) { void execute(); }`.
8. **Architectural Principles**:
   - Wanim enforces honest functions, boundaries for I/O, stacking bricks decomposition, and `{value}By{key}` naming (e.g. `themeExtensionByThemeName`).

---

## 2. Logic Chain

1. **Build & Bundling Feasibility**:
   - *Observation*: Reference plugin uses `esbuild.config.mjs` targeting `es2018`, `cjs` format, bundling into `main.js`. External dependencies are specified in `external: [...]`.
   - *Inference*: In Obsidian plugins, npm packages that Obsidian does not export globally must be bundled into `main.js`. Specifically, `@wanimjs/wanim`, `@codemirror/lang-python`, and `@replit/codemirror-vim` must be bundled and NOT externalized.
   - *Inference*: Because `@wanimjs/wanim` may use ESM features internally (e.g. `import.meta.url`), `esbuild.config.mjs` must define `define: { 'import.meta.url': 'import_meta_url' }` or similar shim to prevent esbuild CJS build failure.

2. **UI & CodeBlockProcessor Consistency**:
   - *Observation*: Reference plugin mounts `.manim-block` containing `.manim-block-header`, `.manim-code-editor`, `.manim-canvas`, and `pre.manim-error-panel`.
   - *Inference*: Replicating these exact class names and DOM hierarchy ensures compatibility with existing Obsidian CSS styling, themes, and community expectations.
   - *Inference*: The 16:9 canvas container in reference is mounted via `.manim-canvas` > `.manim-canvas-viewport` > `.manim-canvas-mount`. For Wanim, mounting the `<canvas>` element inside `.manim-canvas` with responsive 16:9 aspect ratio (`aspect-ratio: 16 / 9`) directly matches both Obsidian layout and `@wanimjs/wanim` expectations.

3. **Vim Cursor Styling Mechanics**:
   - *Observation*: Obsidian's native editor can apply `.cm-vimMode` classes to outer scroll containers, which can inadvertently hide inner CodeMirror 6 cursors if standard cursor layers are suppressed.
   - *Inference*: The exact CSS selectors in `styles.css` (specifically lines 177–238) and `editorStyle.ts`:
     - `.manim-code-editor .cm-vimCursorLayer` (forced visible, absolute, z-index 100)
     - `.manim-code-editor .cm-fat-cursor` (bright red `#f10707`, opacity 0.75, min-width 0.65em)
     - `.manim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursor` (forced thin white cursor `border-left: 2px solid #ffffff`)
     - `.manim-code-editor .cm-scroller` (`position: relative !important;`)
     are strictly required to prevent cursor displacement, disappearance, or jumping.

4. **Vault Persistence & Debounced Auto-Save**:
   - *Observation*: `sourcePersistence.ts` accurately identifies the code fence using `ctx.getSectionInfo(contextEl)` and replaces lines in `originalDoc` using `replaceSectionByLineRange`.
   - *Inference*: This approach is robust and avoids AST re-parsing overhead. When coupled with `stateStore.ts` tracking cursor and scroll positions, note edits and background saves maintain seamless UX without jarring scroll resets.
   - *Inference*: In Wanim, adopting this exact persistence logic ensures user Python edits are saved directly back to the markdown note after `autoSaveDelaySeconds`.

5. **Architectural Guidelines Alignment**:
   - *Observation*: User guidelines mandate local reasoning, push side effects to boundaries, and `{value}By{key}` naming.
   - *Inference*: Decomposing `codeBlockProcessor.ts` into pure DOM builders (`createBlockHeader`, `createRunButton`, `createRestartButton`, `createCanvasMount`) and honest persistence functions (`buildWanimFenceFromSection`, `replaceSectionByLineRange`) directly fulfills these requirements.

---

## 3. Caveats

1. **Browser Bridge Runtime**:
   - In `@wanimjs/wanim`, `runPythonOnCanvas` executes Python in-browser via RapydScript transpilation and canvas rendering. Complex Python Manim scenes requiring heavy external C-extensions (like raw scipy or OpenCV) are unsupported by Wanim, though standard Manim Community mobjects, animations, LaTeX, and NumPy transforms run smoothly.
2. **Dual-Plugin Code Block Tag**:
   - Both `obsidian-manim-plugin` and `Obsidian Wanim Plugin` register tag `'manim'`. As planned, users testing the new plugin should toggle off the reference plugin in Obsidian Community Plugins to avoid processor collision.
3. **No Caveats on Reference Source**:
   - The reference plugin was completely inspected in read-only mode without any modifications or side effects.

---

## 4. Conclusion

The reference plugin `obsidian-manim-plugin` provides an exceptionally clean, well-architected blueprint for `Obsidian Wanim Plugin`:
1. **Scaffolding**: An independent plugin under `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` can replicate the build structure (`package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`), swapping `manim-web` + `sucrase` for `@wanimjs/wanim` + `@codemirror/lang-python`.
2. **UI & DOM Structure**: Reusing `.manim-block`, `.manim-block-header`, `.manim-collapse-caret`, `.manim-run-button`, `.manim-restart-button`, `.manim-save-state`, `.manim-code-editor`, `.manim-canvas`, and `.manim-error-panel` ensures visual and behavioral fidelity.
3. **Vim Mode**: The exact CSS and Compartment mechanics from `editorStyle.ts` and `styles.css` deliver the required `#f10707` fat block cursor in Normal Mode and thin white line cursor in Insert Mode.
4. **Settings & Persistence**: Expanding `settings.ts` to include `renderQuality` and `autoRunOnOpen`, while keeping the `sourcePersistence.ts` line-slicing logic and `stateStore.ts` cursor caching, satisfies all feature requirements.
5. **Implementation Path**: The project is completely unblocked and ready for immediate implementation following the 5-step roadmap in `wanim_implementation_plan.md`.

---

## 5. Verification Method

To independently verify these findings:
1. **Inspect Reference Source Files**:
   - Verify `package.json` dependencies: `Get-Content "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\package.json"`
   - Verify CSS cursor selectors: `Get-Content "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\styles.css" | Select-String "cm-fat-cursor"`
   - Verify DOM processor hierarchy: `Get-Content "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\src\manim\codeBlockProcessor.ts"`
   - Verify file persistence algorithm: `Get-Content "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\src\manim\sourcePersistence.ts"`
2. **Inspect Implementation Plan**:
   - Read `C:\Users\angel\.gemini\antigravity-cli\brain\297f2c6b-e69a-4d05-b196-0b0d450a9639\wanim_implementation_plan.md` to confirm the 5 settings, Python language support, and `@wanimjs/wanim` integration points.
3. **Verify Read-Only Integrity**:
   - Run `git status` or file timestamp check on `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` to guarantee no files were created, touched, or modified during this survey.
