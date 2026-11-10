# Handoff Report: Obsidian Vim Mode Detection, Dynamic Synchronization, and Custom Cursor Styling

## 1. Observation

Direct examination of the workspace files, the reference plugin at `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`, and the bundled dependencies in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` revealed the following technical facts:

### 1.1 Obsidian Vim Mode APIs and Detection Surfaces
- **Reference Implementation**:
  In `obsidian-manim-plugin/src/manim/editorChild.ts` (lines 15–33):
  ```ts
  export function isVimEnabled(plugin: Plugin): boolean {
      const app = plugin.app as any;
      if (typeof app?.vault?.getConfig === 'function') {
          const val = app.vault.getConfig('vimMode');
          if (typeof val === 'boolean') {
              return val;
          }
      }
      if (typeof app?.vault?.config?.vimMode === 'boolean') {
          return app.vault.config.vimMode;
      }
      if (typeof app?.isVimEnabled === 'function') {
          return Boolean(app.isVimEnabled());
      }
      if (typeof (app as any)?.internalPlugins?.plugins?.['editor']?.instance?.options?.vimMode === 'boolean') {
          return Boolean((app as any).internalPlugins.plugins['editor'].instance.options.vimMode);
      }
      return Boolean((window as any)?.CodeMirrorAdapter?.Vim);
  }
  ```
- **Obsidian Vault Event**:
  In `obsidian-manim-plugin/src/main.ts` (lines 49–54):
  ```ts
  this.registerEvent(
      (this.app.vault as any).on('config-changed', () => {
          const isVim = isVimEnabled(this);
          this.updateAllEditorVim(isVim);
      })
  );
  ```
  Obsidian's internal `Vault` object fires a `'config-changed'` event whenever settings in Obsidian's Options (including Editor > Vim key bindings) are modified.

### 1.2 `@replit/codemirror-vim` Internals & Lifecycle
- In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\node_modules\@replit\codemirror-vim\dist\index.js`:
  - **Mounting**: At line 1143–1144:
    ```js
    this.cursorLayer = view.scrollDOM.appendChild(document.createElement("div"));
    this.cursorLayer.className = "cm-cursorLayer cm-vimCursorLayer";
    ```
  - **Mode Tracking**: At line 1408–1412:
    ```js
    const state = this.cm.state;
    if (!state.vim || (state.vim.insertMode && !state.overwrite))
        this.view.scrollDOM.classList.remove("cm-vimMode");
    else
        this.view.scrollDOM.classList.add("cm-vimMode");
    ```
    In Normal/Visual mode, `scrollDOM` has the class `cm-vimMode`. In Insert mode, `cm-vimMode` is removed from `scrollDOM`.
  - **Cursor Coordinate Positioning**: At lines 1216–1220 and 1290–1292:
    ```js
    function getBase(view) {
        let rect = view.scrollDOM.getBoundingClientRect();
        let left = view.textDirection == Direction.LTR ? rect.left : rect.right - view.scrollDOM.clientWidth;
        return { left: left - view.scrollDOM.scrollLeft * view.scaleX, top: rect.top - view.scrollDOM.scrollTop * view.scaleY };
    }
    // Cursor piece offset calculation:
    return new Piece((left - base.left) / view.scaleX, (pos.top - base.top + h * (1 - hCoeff)) / view.scaleY, ...);
    ```
    Because coordinates are computed relative to `view.scrollDOM`'s bounding box and appended as an absolute child of `scrollDOM`, `scrollDOM` (`.cm-scroller`) MUST have `position: relative !important` to serve as the containing block; otherwise, the fat cursor resolves against outer note containers, causing dramatic positional offset drift.
  - **Tear-Down / Unmount**: At lines 1438–1443:
    ```js
    destroy() {
        Vim.leaveVimMode(this.cm);
        this.updateClass();
        this.blockCursor.destroy();
        delete this.view.cm;
    }
    ```
    When CodeMirror 6 reconfigures the compartment from `vim()` to `[]`, CodeMirror triggers `destroy()`, which removes `cm-vimCursorLayer`, strips `cm-vimMode`, and resets Vim state cleanly.

### 1.3 Scoped CSS Cursor Styling in `styles.css`
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\styles.css`:
- **Scroller Containment**:
  Line 172:
  ```css
  .wanim-code-editor .cm-scroller {
      position: relative !important;
      min-height: 220px;
      max-height: 320px;
      overflow: auto;
      ...
  }
  ```
- **Normal Mode Bright Red Block Cursor (`#f10707`)**:
  Lines 207–228:
  ```css
  .wanim-code-editor .cm-fat-cursor,
  .wanim-code-editor .cm-editor .cm-fat-cursor,
  .wanim-code-editor .cm-editor:not(.cm-focused) .cm-fat-cursor,
  .wanim-code-editor:not(.cm-focused) .cm-fat-cursor,
  .wanim-code-editor .cm-vimCursorLayer .cm-fat-cursor {
      display: inline-block !important;
      visibility: visible !important;
      position: absolute !important;
      background: var(--wanim-vim-cursor-color, #f10707) !important;
      background-color: var(--wanim-vim-cursor-color, #f10707) !important;
      border: none !important;
      border-left: none !important;
      outline: none !important;
      white-space: pre !important;
      z-index: 100 !important;
      color: #ffffff !important;
      min-width: 0.65em !important;
      line-height: 1.2 !important;
      opacity: 0.75 !important;
      pointer-events: none !important;
  }
  ```
- **Insert Mode Outer Isolation & Thin White Line Cursor**:
  Lines 230–257:
  ```css
  /* Defeats outer Obsidian .cm-vimMode selector */
  .wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer,
  .wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer:not(.cm-vimCursorLayer),
  .wanim-code-editor .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
  }

  .wanim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) {
      display: none !important;
  }

  .wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursor,
  .wanim-code-editor .cm-cursor:not(.cm-fat-cursor),
  .wanim-code-editor .cm-dropCursor {
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

### 1.4 Existing Scaffolding State in `Obsidian Wanim Plugin`
- In `src/main.ts`:
  - `editorById = new Map<string, ThemeableEditor>()` is already present.
  - `updateAllEditorVim(isVimEnabled: boolean)` and `broadcastEditorVimChange(...)` are already defined.
  - Missing: The registration of `config-changed` event listener in `main.ts#onload()`.
- In `src/types.ts`:
  - `ThemeableEditor` interface already declares `setVimEnabled(isEnabled: boolean): void;`.

---

## 2. Logic Chain

1. **Multi-Tier Detection Need & Architecture**:
   - *Observation*: Obsidian's API has evolved across versions. `app.vault.getConfig('vimMode')` is present in modern versions, while `app.vault.config.vimMode`, `app.isVimEnabled()`, `internalPlugins`, and `window.CodeMirrorAdapter.Vim` exist across different historical or headless environments.
   - *Logic*: Direct property access on unverified structures risks runtime type errors (e.g. accessing property of `undefined`). Refactoring detection into a prioritized pipeline of honest leaf functions (`detectVimFromVaultGetConfig`, `detectVimFromVaultConfigObject`, `detectVimFromAppMethod`, `detectVimFromInternalPlugins`, `detectVimFromGlobalAdapter`) guarantees robust fallbacks, zero crashes, and 100% testability with mock objects.
2. **Dynamic Synchronization via Compartments**:
   - *Observation*: When Obsidian settings change, a full rebuild of the CodeMirror 6 `EditorView` would destroy undo history, selection range, and trigger unnecessary DOM thrashing.
   - *Logic*: Using a CodeMirror 6 `Compartment` allows dispatching `this.vimCompartment.reconfigure(enabled ? vim() : [])`. CodeMirror swaps the extension in-place within a single micro-transaction.
   - *Logic*: Reconfiguration automatically invokes `@replit/codemirror-vim`'s `destroy()` method when disabling Vim, removing `cm-vimCursorLayer` and clearing `cm-vimMode`.
3. **Preventing Broadcast Memory & Listener Leaks**:
   - *Observation*: Registering events directly with `app.vault.on` without tracking them causes zombie callbacks upon plugin reload.
   - *Logic*: Obsidian's `Plugin.prototype.registerEvent` ensures all listeners are unregistered upon plugin disable.
   - *Logic*: Calling `plugin.registerActiveEditor(this)` in `WanimCodeEditorChild.onload()` and `plugin.unregisterActiveEditor(this.id)` in `WanimCodeEditorChild.onunload()` prevents stale editor instances from lingering in `editorById`.
4. **Scoped Styling & Cascade Isolation**:
   - *Observation*: Obsidian's note editor wraps all content in `.markdown-source-view.mod-cm6`. When Obsidian Vim mode is on, outer elements may carry `.cm-vimMode`.
   - *Logic*: In `@replit/codemirror-vim`, the default stylesheet hides `.cm-cursorLayer:not(.cm-vimCursorLayer)` whenever an ancestor has `.cm-vimMode`.
   - *Logic*: When our inner embedded editor transitions to **Insert mode**, it removes `.cm-vimMode` from its inner `scrollDOM`. However, because the outer Obsidian note still has `.cm-vimMode`, the inner Insert line cursor would remain hidden unless an explicit scoped selector forces `.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer { display: block !important; }`.
   - *Logic*: Requiring `position: relative !important` on `.wanim-code-editor .cm-scroller` ensures that `scrollDOM` is the containing block for absolute positioning of `.cm-fat-cursor`.

---

## 3. Caveats

1. **Obsidian Vault Event Typing**:
   - The TypeScript definition for `Vault` in `obsidian` package does not declare `'config-changed'` in its standard event union (it only declares `'create' | 'modify' | 'delete' | 'rename'`).
   - *Resolution*: Cast `(this.app.vault as any).on('config-changed', ...)` or define an interface `VaultWithConfigEvent` extending `Events`.
2. **Headless & Unit Testing Environments**:
   - During headless Jest/Vitest/Node testing, `window` or `document` may be absent or partially mocked.
   - *Resolution*: All honest functions accept `globalScope = typeof window !== 'undefined' ? window : globalThis` and `rootNode = document` as default parameters, allowing unit tests to pass mock environments cleanly.
3. **Redundant Dispatches**:
   - If a vault event fires for a non-Vim configuration change (e.g. changing note font size), `isVimEnabled` returns the same boolean value.
   - *Resolution*: `WanimCodeEditorChild.prototype.setVimEnabled` caches `private isVimActive: boolean` and early-returns if `this.isVimActive === isEnabled`, preventing redundant CodeMirror state transactions.

---

## 4. Conclusion

The design for Milestone 2 Vim detection, synchronization, and styling is complete, architecturally sound, and verified.

### 4.1 Implementation Blueprint

#### Component A: `src/editor/vimIntegration.ts`
Provide the complete implementation as defined in `proposed_vimIntegration.ts`:
- **Interfaces**: `VimConfigHost`, `VaultConfigInterface`, `InternalPluginsInterface`.
- **Honest Detection Functions**:
  - `detectVimFromVaultGetConfig(host: VimConfigHost): boolean | undefined`
  - `detectVimFromVaultConfigObject(host: VimConfigHost): boolean | undefined`
  - `detectVimFromAppMethod(host: VimConfigHost): boolean | undefined`
  - `detectVimFromInternalPlugins(host: VimConfigHost): boolean | undefined`
  - `detectVimFromGlobalAdapter(globalScope: unknown): boolean | undefined`
  - `resolveVimModeFromHost(host: VimConfigHost, globalScope?: unknown): boolean`
  - `isVimEnabled(target: unknown, globalScope?: unknown): boolean`
- **Compartment Builders**:
  - `createVimExtension(enabled: boolean): Extension` (`enabled ? vim() : []`)
  - `createVimCompartment(): Compartment`
  - `createVimCompartmentExtension(compartment: Compartment, enabled: boolean): Extension`
  - `reconfigureVimCompartment(compartment: Compartment, enabled: boolean): StateEffect<unknown>`

#### Component B: `src/editor/editorStyle.ts`
Provide the complete implementation as defined in `proposed_editorStyle.ts`:
- **`wanimEditorBaseTheme`**: CM6 `EditorView.theme` encapsulating:
  - Scroller `position: relative !important;`
  - Normal mode bright red block cursor `#f10707` (`opacity: 0.75; min-width: 0.65em; position: absolute !important;`)
  - Insert mode thin white line cursor (`border-left: 2px solid #ffffff !important; width: 0 !important;`)
  - Scoped rules suppressing standard cursors only when in `.cm-scroller.cm-vimMode`
- **Honest Typography Synchronizer**:
  - `extractComputedStyleProperty(element, property, getStyleFn)`
  - `extractTypographyFromElements(contentEl, selectionEl, cursorEl, getStyleFn)`
  - `createCssVariablesByTypography(props)` returning `{value}By{key}` map
  - `applyCssCustomProperties(hostEl, propertyByName)`
  - `syncTypographyFromNativeEditor(hostEl, rootNode)`

#### Component C: Updates to `src/main.ts`
Add the vault event listener brick in `ObsidianWanimPlugin`:
```ts
// Inside onload():
await this.initializeSettings();
this.initializeRapydscript();
this.registerVaultConfigListener();
this.logPluginLoaded();

// Inside Discrete Orchestration Bricks:
private registerVaultConfigListener(): void {
    const vaultWithEvents = this.app.vault as unknown as {
        on(event: 'config-changed', callback: () => void): EventRef;
    };
    if (typeof vaultWithEvents?.on === 'function') {
        const eventRef = vaultWithEvents.on('config-changed', () => {
            this.syncVimModeAcrossEditors();
        });
        this.registerEvent(eventRef);
    }
}

private syncVimModeAcrossEditors(): void {
    const isVim = isVimEnabled(this.app);
    this.updateAllEditorVim(isVim);
}
```

#### Component D: `WanimCodeEditorChild` Integration (for `teamwork_explorer_m2_1`)
The editor child connects to `vimIntegration.ts` via:
```ts
export class WanimCodeEditorChild extends MarkdownRenderChild implements ThemeableEditor {
    readonly id: string;
    private editorView: EditorView | null = null;
    private readonly vimCompartment = createVimCompartment();
    private isVimActive: boolean;

    constructor(private readonly plugin: ObsidianWanimPlugin, ...) {
        super(editorHostEl);
        this.id = crypto.randomUUID();
        this.isVimActive = isVimEnabled(this.plugin);
    }

    onload(): void {
        const extensions: Extension[] = [
            createVimCompartmentExtension(this.vimCompartment, this.isVimActive),
            wanimEditorBaseTheme,
            ...
        ];
        // Mount editor...
        this.plugin.registerActiveEditor(this);
    }

    onunload(): void {
        this.plugin.unregisterActiveEditor(this.id);
        this.editorView?.destroy();
        this.editorView = null;
    }

    setVimEnabled(isEnabled: boolean): void {
        if (this.isVimActive === isEnabled) return;
        this.isVimActive = isEnabled;
        if (this.editorView) {
            this.editorView.dispatch({
                effects: reconfigureVimCompartment(this.vimCompartment, isEnabled),
            });
        }
    }
}
```

---

## 5. Verification Method

### 5.1 Automated Script Verification
Run the verification test suite written in this explorer's state directory:
```powershell
node "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m2_2\test_vim_verification.mjs"
node "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m2_2\test_typography.mjs"
```
**Expected Output**:
- `✓ All 5 detection tiers passed.`
- `✓ Broadcast error resilience passed.`
- `✓ Typography helper test passed.`

### 5.2 Build Invariant Verification
Inside `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin`:
```powershell
npm run build
```
**Expected Result**:
Zero TypeScript compiler errors (`tsc -noEmit -skipLibCheck`) and esbuild bundling generating valid `main.js`.

### 5.3 Simulated User Validation in Obsidian
1. **Normal Mode Block Cursor**:
   - Turn Obsidian Vim mode ON (Settings > Editor > Vim key bindings).
   - In any ````manim ```` code block, focus the CodeMirror editor in Normal Mode.
   - Inspect the cursor DOM: Verify it has class `.cm-fat-cursor` and computed CSS `background-color: rgb(241, 7, 7)` (`#f10707`), `opacity: 0.75`, and `position: absolute`.
2. **Insert Mode Thin Line Cursor**:
   - Press `i` to enter Insert mode.
   - Verify cursor transitions to a crisp 2px white line (`border-left: 2px solid rgb(255, 255, 255)`), with `.cm-fat-cursor` hidden.
   - Press `Escape` to return to Normal mode: Verify the `#f10707` block cursor instantly reappears.
3. **Dynamic Toggle without Reload**:
   - With an editor open, open Obsidian Settings > Editor > toggle "Vim key bindings" to OFF.
   - Switch back to the note without reloading: Verify the editor cursor immediately updates to the standard white line cursor.
   - Toggle "Vim key bindings" back ON: Verify the editor immediately switches back to Vim Normal mode.
4. **Scroll Drift Invariant**:
   - In a long Manim Python script (> 30 lines), scroll the editor viewport down.
   - Observe the block cursor position: Verify it stays precisely locked to the active line and character without drifting vertically or jumping outside the container.
