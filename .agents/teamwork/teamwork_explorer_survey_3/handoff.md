# Handoff Report: CodeMirror 6 Python Integration, Vim Mode Synchronization, and Architecture Survey

## 1. Observation

Direct examination of the reference plugin at `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`, peer survey reports, and `C:\Users\angel\.gemini\antigravity-cli\brain\297f2c6b-e69a-4d05-b196-0b0d450a9639\wanim_implementation_plan.md` revealed the following exact technical facts:

### 1.1 CodeMirror 6 Setup for Python
- **Package Ecosystem**:
  - The reference plugin `package.json` includes:
    ```json
    "@codemirror/autocomplete": "^6.17.0",
    "@codemirror/commands": "6.10.3",
    "@codemirror/lang-javascript": "6.2.5",
    "@codemirror/language": "6.12.2",
    "@codemirror/state": "6.5.0",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "6.38.6",
    "@replit/codemirror-vim": "^6.4.0",
    "@uiw/codemirror-theme-github": "^4.25.8",
    "@uiw/codemirror-theme-monokai": "^4.25.8"
    ```
  - For Python support, `@codemirror/lang-python` (latest 6.2.1) exports `python()` which provides full Python grammar highlighting and indentation rules, directly replacing `@codemirror/lang-javascript`.
- **Indentation Configuration**:
  - In `obsidian-manim-plugin/src/manim/editorChild.ts` (lines 69–71), 4-space tab indentation is configured via:
    ```ts
    EditorState.tabSize.of(4),
    indentUnit.of('    '),
    keymap.of([indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    ```
  - In CSS (`obsidian-manim-plugin/styles.css`, line 165):
    ```css
    .manim-code-editor .cm-content {
        tab-size: 4 !important;
    }
    ```
- **Theme Support & Dynamic Compartments**:
  - `editorChild.ts` (lines 39, 65, 163–169) uses a CodeMirror 6 `Compartment`:
    ```ts
    private themeCompartment = new Compartment();
    // In extensions:
    this.themeCompartment.of(getEditorThemeExtension(this.theme))
    // Dispatch reconfiguration:
    this.editorView.dispatch({
        effects: this.themeCompartment.reconfigure(getEditorThemeExtension(newTheme)),
    });
    ```
  - Available themes:
    - `obsidian`: Native Obsidian theme matching vault styles (`[]` empty extension).
    - `github-light`: `@uiw/codemirror-theme-github` (`githubLight`).
    - `github-dark`: `@uiw/codemirror-theme-github` (`githubDark`).
    - `one-dark`: `@codemirror/theme-one-dark` (`oneDark`).
    - `monokai`: `@uiw/codemirror-theme-monokai` (`monokai`).

### 1.2 Obsidian Vim Mode Integration & Cursor Styling
- **Vim Mode Detection**:
  - `obsidian-manim-plugin/src/manim/editorChild.ts` (lines 15–33) implements multi-tier fallback detection:
    ```ts
    export function isVimEnabled(plugin: Plugin): boolean {
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
    }
    ```
- **Vim Synchronization**:
  - `obsidian-manim-plugin/src/main.ts` (lines 49–54) registers a listener on the Obsidian vault `config-changed` event:
    ```ts
    this.registerEvent(
        (this.app.vault as any).on('config-changed', () => {
            const isVim = isVimEnabled(this);
            this.updateAllEditorVim(isVim);
        })
    );
    ```
  - When invoked, each registered editor dispatches `this.vimCompartment.reconfigure(isVim ? vim() : [])`.
- **Vim Cursor Styling Implementation**:
  - Examination of `@replit/codemirror-vim/dist/index.js` (lines 1144, 1203, 1408–1412) confirms:
    - `@replit/codemirror-vim` mounts `.cm-cursorLayer.cm-vimCursorLayer` inside `scrollDOM`.
    - In Normal/Visual modes, it adds class `cm-vimMode` to `scrollDOM` and renders `.cm-fat-cursor`.
    - In Insert mode, it removes `cm-vimMode` from `scrollDOM`.
  - In `obsidian-manim-plugin/styles.css` (lines 188–238) and `editorStyle.ts` (lines 14–46):
    - **Normal Mode Bright Red Block Cursor**:
      ```css
      .cm-fat-cursor,
      .manim-code-editor .cm-fat-cursor,
      .manim-code-editor .cm-editor .cm-fat-cursor {
          display: inline-block !important;
          visibility: visible !important;
          position: absolute !important;
          background: #f10707 !important;
          background-color: #f10707 !important;
          color: #ffffff !important;
          min-width: 0.65em !important;
          border: none !important;
          outline: none !important;
          white-space: pre !important;
          z-index: 100 !important;
          opacity: 0.75 !important;
          pointer-events: none !important;
      }
      ```
    - **Insert Mode Thin White Line Cursor**:
      ```css
      .manim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
      }
      .manim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) {
          display: none !important;
      }
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
    - **Scroller Coordinate Anchor**:
      ```css
      .manim-code-editor .cm-scroller {
          position: relative !important;
      }
      ```

### 1.3 Code Fence Source Persistence
- **Change Tracking & Auto-Save**:
  - `editorChild.ts` (lines 72–79, 200–210) attaches an `EditorView.updateListener`:
    - Checks `update.docChanged`.
    - Updates UI label to `'Saving...'`.
    - Resets `saveTimer` with `window.setTimeout(..., delayMs)`.
    - On blur, block unmount (`onunload`), or execute click, triggers `flushPendingSave()`.
- **Document Splicing & Vault Write**:
  - `obsidian-manim-plugin/src/manim/sourcePersistence.ts` (lines 16–39):
    ```ts
    const sectionInfo = ctx.getSectionInfo(contextEl);
    if (!sectionInfo) return;
    const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) return;
    const original = await plugin.app.vault.cachedRead(file);
    const updatedSection = buildManimFenceFromSection(sectionInfo.text, code);
    const updatedDoc = replaceSectionByLineRange(original, sectionInfo.lineStart, sectionInfo.lineEnd, updatedSection);
    if (updatedDoc !== original) {
        await plugin.app.vault.modify(file, updatedDoc);
    }
    ```
- **State Preservation**:
  - `stateStore.ts` stores cursor (`anchor`, `head`), scroll (`top`, `left`), and `hadFocus` before `vault.modify` or unmount.
  - When Obsidian re-renders the block post-processor, `onload` restores cursor position and scroll coordinates, and regains focus via `requestAnimationFrame`.

### 1.4 Architectural Guidelines (R5)
- User guidelines require:
  1. Local reasoning & honest functions: Leaf functions accept explicit arguments, return data structures, and have zero side effects. Impure operations (vault I/O, DOM mutation) live strictly at the outermost boundary.
  2. One level of abstraction ("Stacking Bricks"): Uniform abstraction without mixing business logic and low-level character parsing or raw DOM assembly.
  3. Empathetic & invariant-rich signatures: Strongly typed options objects instead of boolean flags.
  4. `{value}By{key}` naming convention for all maps and dictionaries.

### 1.5 Implementation Plan Review (`wanim_implementation_plan.md`)
- Target folder: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`.
- Old plugin `obsidian-manim-plugin` remains 100% untouched.
- 5 User settings defined: `editorTheme`, `autoSaveDelaySeconds`, `defaultCollapsed`, `renderQuality`, `autoRunOnOpen`.
- Python execution via `@wanimjs/wanim/bridge` (`runPythonOnCanvas`).

---

## 2. Logic Chain

1. **Python Grammar Integration**:
   - *Observation*: `@codemirror/lang-python` provides the standard Lezer Python parser and indent service.
   - *Logic*: Importing `python` from `@codemirror/lang-python` and including `python()` in the extensions array enables full Python syntax highlighting, tokenization, and auto-indentation in CodeMirror 6.
2. **Indentation Precision**:
   - *Observation*: Python relies on exact indentation semantics.
   - *Logic*: Combining `EditorState.tabSize.of(4)`, `indentUnit.of("    ")`, `keymap.of([indentWithTab])`, and CSS `tab-size: 4` guarantees that pressing Tab always creates 4 spaces and aligns with Python standards without jumping out of the editor.
3. **Vim Synchronization & Isolation**:
   - *Observation*: Obsidian wraps notes in `.markdown-source-view.mod-cm6`. If Vim mode is enabled in Obsidian, Obsidian's parent container applies Vim styles.
   - *Logic*: To prevent Obsidian's outer Vim styling from corrupting or hiding the inner CodeMirror cursor, the inner editor requires scoped CSS selectors (`.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer` and `position: relative !important`).
   - *Logic*: Using a dedicated CodeMirror `Compartment` allows `vim()` to be toggled dynamically when Obsidian emits `config-changed` without recreating the editor instance or dropping document history.
4. **Vault Persistence Safety**:
   - *Observation*: `ctx.getSectionInfo(contextEl)` reports `lineStart` and `lineEnd` of the block.
   - *Logic*: Splicing lines between `lineStart` and `lineEnd` preserves all surrounding note contents cleanly.
   - *Logic*: Because `vault.modify` triggers an Obsidian post-processor re-render, caching block state (`cursor`, `scroll`, `hadFocus`) in `stateStore.ts` prevents typing interruption and cursor reset to position 0.
   - *Enhancement*: If lines above shifted due to an external edit before `sectionInfo` refreshed, defensive matching should verify that `lines[sectionInfo.lineStart]` begins with ````manim ````. If not, scan adjacent lines to locate the exact fence boundaries.
5. **R5 Architectural Refinements**:
   - *Observation*: The reference plugin in `editorThemes.ts` used a procedural `switch (theme)` statement, and `codeBlockProcessor.ts` contained a 300-line monolithic callback with inline DOM construction and state handling.
   - *Logic*: Refactoring `editorThemes.ts` into a pure dictionary `themeExtensionByThemeName: Record<WanimEditorTheme, Extension>` satisfies the `{value}By{key}` naming rule and honest function principle.
   - *Logic*: Decomposing `codeBlockProcessor.ts` into brick functions (`createBlockHeader`, `createRunButton`, `createRestartButton`, `createSaveIndicator`, `createCanvasMount`, `createErrorPanel`) enforces single-level abstraction.

---

## 3. Caveats

1. **Namespace Isolation**:
   - The reference plugin uses CSS classes prefixed with `.manim-` (`.manim-block`, `.manim-code-editor`, etc.).
   - The new plugin must use `.wanim-` prefixes (`.wanim-block`, `.wanim-code-editor`, `.wanim-collapse-caret`, etc.) in `styles.css` and TypeScript code to guarantee zero style collision if both plugins are installed.
2. **Context Section Info Availability**:
   - In rare contexts (e.g. Obsidian Canvas cards or complex transclusions), `ctx.getSectionInfo(contextEl)` can return `null`. Persistence logic must check for `null` and gracefully exit without throwing unhandled exceptions.
3. **Auto-Run Setting Honor**:
   - The reference plugin auto-ran immediately on mount (`void execute()`). In Wanim, `codeBlockProcessor.ts` must check `if (plugin.settings.autoRunOnOpen)` before executing on mount.
4. **Vim Visual Mode Behavior**:
   - In `@replit/codemirror-vim`, Visual mode sets the browser `::selection` background to transparent and renders selection highlights using CodeMirror's `.cm-selectionBackground`. Styling `.wanim-code-editor .cm-selectionBackground` with `var(--text-selection)` is mandatory for visual selection visibility.

---

## 4. Conclusion

1. **CodeMirror 6 Python Editor**:
   - Use `@codemirror/lang-python` with `python()`.
   - Configure 4 spaces via `EditorState.tabSize.of(4)`, `indentUnit.of("    ")`, `indentWithTab`, and CSS `tab-size: 4`.
   - Theme switching is cleanly handled by `themeExtensionByThemeName: Record<WanimEditorTheme, Extension>` inside a dynamic `Compartment`.
2. **Obsidian Vim Integration**:
   - Detect Vim status via `isVimEnabled(plugin)` checking `app.vault.getConfig('vimMode')` with fallbacks.
   - Dynamically reconfigure the `vimCompartment` via `this.app.vault.on('config-changed')`.
   - Style Normal Mode with bright red block cursor `#f10707` (`opacity: 0.75; min-width: 0.65em; position: absolute; z-index: 100`).
   - Style Insert Mode with thin white line cursor (`border-left: 2px solid #ffffff; width: 0`).
   - Enforce `.wanim-code-editor .cm-scroller { position: relative !important; }`.
3. **Source Persistence**:
   - Implement debounced auto-save (1–300s, default 60s) via `EditorView.updateListener`.
   - Update markdown notes using `replaceSectionByLineRange` with defensive line boundary detection.
   - Cache editor selection, scroll coordinates, and focus in `stateStore.ts` to seamlessly handle Obsidian re-renders caused by `vault.modify`.
4. **R5 Architectural Design**:
   - All proposed components conform to honest functions, boundary-isolated side effects, brick-composed orchestrators, invariant-rich interfaces (`EditorChildOptions`, `WanimPluginSettings`), and `{value}By{key}` naming.

---

## 5. Verification Method

1. **CodeMirror 6 & Python Indentation**:
   - Inspect package configuration:
     `npm list @codemirror/lang-python @codemirror/state @codemirror/view` inside the plugin directory.
   - Verify 4-space tab behavior by pressing Tab in an empty line and asserting that 4 space characters are inserted (`"    "`).
2. **Vim Mode & Cursor Styling Verification**:
   - In Obsidian, open Settings > Editor > toggle "Vim key bindings" ON.
   - In the Wanim code editor, observe the cursor in Normal mode: verify it renders as a bright red `#f10707` block cursor with white text.
   - Press `i` to enter Insert mode: verify cursor turns into a thin 2px white line cursor.
   - Press `Escape` followed by `v`: verify Visual mode selection highlights text while preserving the red block cursor at the anchor.
   - In Obsidian Settings > Editor > toggle "Vim key bindings" OFF: verify the editor dynamically updates to standard editor cursor without page reload.
3. **Source Persistence & Vault Integrity**:
   - Edit Python code inside a ````manim ```` fence block. Wait for the debounce delay (or trigger save).
   - Check the enclosing markdown file in the Obsidian vault and confirm:
     * Only the code fence contents between ````manim ```` and ```` ```` are replaced.
     * Surrounding markdown text, headers, and other blocks remain 100% intact.
     * The cursor does not jump to position 0 and keyboard focus remains active.
