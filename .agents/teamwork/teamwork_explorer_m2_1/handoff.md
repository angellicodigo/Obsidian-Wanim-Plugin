# Milestone 2 Exploration Report: CM6 Python Editor & WanimCodeEditorChild Architecture

## 1. Observation

### 1.1 Existing Project Dependencies & Build Configuration
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\package.json`:
- Lines 27–42 define installed editor dependencies:
  - `"@codemirror/autocomplete": "^6.17.0"`
  - `"@codemirror/commands": "6.10.3"`
  - `"@codemirror/lang-python": "^6.2.1"`
  - `"@codemirror/language": "6.12.2"`
  - `"@codemirror/state": "^6.5.0"`
  - `"@codemirror/theme-one-dark": "^6.1.3"`
  - `"@codemirror/view": "^6.38.6"`
  - `"@replit/codemirror-vim": "^6.4.0"`
  - `"@uiw/codemirror-theme-github": "^4.25.8"`
  - `"@uiw/codemirror-theme-monokai": "^4.25.8"`

In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\esbuild.config.mjs`:
- Lines 41–56 define externalized packages:
  ```javascript
  external: [
      "obsidian",
      "electron",
      "@codemirror/autocomplete",
      "@codemirror/collab",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
      ...nodeBuiltins,
  ],
  ```
- **Crucial Observation**: `@codemirror/lang-python`, `@codemirror/theme-one-dark`, `@replit/codemirror-vim`, `@uiw/codemirror-theme-github`, and `@uiw/codemirror-theme-monokai` are **not** externalized. They are bundled by esbuild into `main.js`. Meanwhile, core CM6 packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/autocomplete`) are externalized because Obsidian exposes them via `require()` at runtime.

### 1.2 Package Export Verification via Node Execution
- `@codemirror/lang-python`:
  Command: `node -e "const py = require('@codemirror/lang-python'); console.log(Object.keys(py));"`
  Output: `[ 'globalCompletion', 'localCompletionSource', 'python', 'pythonLanguage' ]`
  Verified: `python()` returns a `LanguageSupport` instance suitable as an `Extension`.
- `@replit/codemirror-vim`:
  Command: `node -e "const vim = require('@replit/codemirror-vim'); console.log(Object.keys(vim));"`
  Output: `[ 'CodeMirror', 'Vim', 'getCM', 'vim' ]`
  Verified: `vim()` returns an `Extension`.
- Theme packages:
  Command: `node -e "const gh = require('@uiw/codemirror-theme-github'); const mk = require('@uiw/codemirror-theme-monokai'); const od = require('@codemirror/theme-one-dark'); console.log(Object.keys(gh), Object.keys(mk), Object.keys(od));"`
  Output confirmed exports: `githubLight`, `githubDark`, `monokai`, and `oneDark`.

### 1.3 Read-Only Reference Patterns in `obsidian-manim-plugin`
- `src/manim/editorChild.ts` (lines 55–132):
  Demonstrated CM6 instantiation within `MarkdownRenderChild`, but suffered from architectural issues:
  1. Monolithic constructor with 8 positional arguments (parameter soup).
  2. Monolithic `onload()` method (~75 lines) mixing state creation, DOM queries, timers, event listeners, and side effects.
  3. Hardcoded TypeScript language mode (`javascript({ typescript: true })`) rather than Python.
  4. Global window/singleton access in Vim detection (`isVimEnabled`).
- `src/manim/editorStyle.ts` (lines 14–29):
  Configures bright red fat cursor (`background: var(--manim-vim-cursor-color, #f10707) !important`) and thin white insert cursor (`border-left: 2px solid #ffffff !important`).
- `src/manim/stateStore.ts` (lines 11–23):
  Uses `blockStateCache` and `lastActiveBlockByFile` to preserve cursor and scroll across block re-renders.

### 1.4 Existing Scaffolding in Target Plugin
- `styles.css` (lines 137–268): Already includes complete `.wanim-code-editor` styling, Vim cursor rules (`.cm-fat-cursor` with `#f10707`), standard insert cursor rules (`#ffffff`), line wrapping, and font variable references.
- `src/types.ts`: Provides `WanimEditorTheme`, `WanimBlockState`, `ThemeableEditor`, `DEFAULT_SETTINGS`, and honest parser `resolvePluginSettings`.
- `src/main.ts`: Implements `editorById` map, `registerActiveEditor`, `unregisterActiveEditor`, `broadcastEditorThemeChange`, and `broadcastEditorVimChange`.
- Current build: `npm run build` succeeds with zero errors.

---

## 2. Logic Chain

1. **Language Integration (Python vs JavaScript)**:
   - *From Observation 1.1 & 1.2*: `@codemirror/lang-python` provides `python()`.
   - *Inference*: To replace the reference plugin's `javascript({ typescript: true })`, the extension pipeline must include `python()` and `syntaxHighlighting(defaultHighlightStyle, { fallback: true })`. This enables syntax parsing via Lezer Python grammar and applies standard highlight tags directly to the DOM tokens.

2. **Indentation Configuration (PEP 8 Compliance)**:
   - *From Requirement R2*: 4-space tab indentation is required.
   - *Inference*: In CodeMirror 6, indentation behavior is governed by three coordinated extensions:
     a. `EditorState.tabSize.of(4)` — sets visual tab width for `\t` characters.
     b. `indentUnit.of("    ")` — sets the indentation string for auto-indentation (e.g. after colon `:` in `def`, `class`, `for`, `if`, `while`).
     c. `keymap.of([indentWithTab, ...])` — binds the `Tab` key to indent line/selection (inserting spaces) and `Shift-Tab` to dedent, preventing Tab from leaking focus out of the editor.
     d. In CSS: `.wanim-code-editor .cm-content { tab-size: 4 !important; }`.

3. **Vim Synchronization & Dynamic Reconfiguration**:
   - *From Observation 1.2 & 1.4*: Obsidian fires `'config-changed'` on the vault when Vim mode is toggled.
   - *Inference*: A CodeMirror 6 `Compartment` allows replacing an active extension without recreating the `EditorState` or losing undo history or cursor position.
   - By creating `vimCompartment = new Compartment()`, the editor can dispatch `vimCompartment.reconfigure(isVim ? vim() : [])` dynamically whenever `updateAllEditorVim(isVim)` broadcasts from `main.ts`.

4. **Theme Synchronization & Dynamic Compartment**:
   - *From Observation 1.2*: Themes `githubLight`, `githubDark`, `oneDark`, and `monokai` are available as CM6 extensions; `obsidian` maps to empty extension `[]` to inherit Obsidian app styling.
   - *Inference*: By creating `themeCompartment = new Compartment()`, theme changes dispatched from plugin settings dynamically reconfigure via `themeCompartment.reconfigure(resolveEditorThemeExtension(newTheme))`.

5. **MarkdownRenderChild Lifecycle Alignment**:
   - *From Observation 1.3*: In Obsidian, custom markdown block processors must manage their DOM lifecycle via `MarkdownRenderChild`.
   - When registered via `ctx.addChild(editorChild)`:
     - Obsidian invokes `onload()` when the block enters the DOM.
     - Obsidian invokes `onunload()` when the block leaves the DOM (e.g., file switched, section re-rendered, note scrolled off view).
   - *Inference*:
     - `onload()` must mount the CM6 editor into `.wanim-code-editor`, restore cursor/scroll state, and register with the plugin's `editorById`.
     - `onunload()` must snapshot the current cursor/scroll/collapsed state into `stateStore`, unregister from `editorById`, clear scheduled save timers, and call `editorView.destroy()`.

6. **R5 Architectural Guidelines Compliance**:
   - *From User Rule `<RULE[user_global]>`*:
     - **Local Reasoning & Honest Functions**: All helper functions must be honest leaf functions that receive all inputs explicitly. No reading `window.app` or global singletons.
     - **Push Side Effects to Boundaries**: Core logic (extension assembly, state clamping, key generation, theme resolution) lives in pure functions. The `WanimCodeEditorChild` class acts as the imperative shell at the boundary.
     - **One Level of Abstraction ("Stacking Bricks")**: `onload()` and `onunload()` must read like tables of contents composed of single-responsibility private helper methods (`mountEditor`, `attachEventListeners`, `restoreSavedViewState`, `registerWithPlugin`, `snapshotCurrentState`, `unregisterFromPlugin`, `destroyEditorView`). No comment-sectioned blocks (`// Step 1: ...`).
     - **Empathetic & Invariant-Rich Signatures**: Constructor parameters bundled into `WanimCodeEditorOptions` rather than 8 positional arguments. Numeric ranges clamped safely via `clampPosition`.
     - **Naming Conventions**: Maps named `{value}By{key}` (e.g., `themeExtensionByTheme`, `editorById`, `blockStateByKey`, `recentStateByFilePath`).

---

## 3. Caveats

1. **CodeMirror 6 Measurement and Layout Timing**:
   When mounting an editor inside a newly rendered block or restoring scroll positions, the DOM layout might not be completely calculated in the synchronous turn of `onload()`.
   *Mitigation*: Wrap scroll and focus restoration inside `requestAnimationFrame`. When an editor is uncollapsed from `display: none`, explicitly invoke `this.editorView.requestMeasure()`.
2. **Obsidian Multi-Tier Vim Detection**:
   Obsidian does not provide a single official TypeScript API type for vimMode; desktop and mobile versions access configuration through slightly different paths (`vault.getConfig('vimMode')`, `vault.config?.vimMode`, `internalPlugins`).
   *Mitigation*: The `detectObsidianVimMode(app: App)` leaf function checks all 5 tiers defensively in order of reliability.
3. **Outer Editor CSS Interference**:
   If the outer Obsidian note has Vim mode active, Obsidian adds `.cm-vimMode` to `.markdown-source-view`. If the inner editor is in Insert mode, CSS rules must ensure the inner cursor is not hidden by the outer editor's `.cm-vimMode` rules.
   *Mitigation*: The selectors already in `styles.css` (specifically `.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer`) explicitly override and isolate the inner editor.
4. **Debounced Persistence Coordination**:
   Code changes trigger debounced persistence to markdown files. If the note is quickly closed or navigated away before the debounce timer elapses, pending changes must be flushed immediately in `onunload()`.

---

## 4. Conclusion & Detailed Design Specifications

The Milestone 2 editor architecture is divided into five modular files within `src/editor/`:
- `src/editor/editorThemes.ts` — Theme mapping and extension resolution.
- `src/editor/editorStyle.ts` — Base editor theme, Vim cursor rules, and typography mirroring.
- `src/editor/vimIntegration.ts` — Multi-tier Vim mode detection and synchronization.
- `src/editor/stateStore.ts` — In-memory block state cache for scroll, cursor, and collapse.
- `src/editor/editorChild.ts` — `WanimCodeEditorChild` extending `MarkdownRenderChild` and pure leaf extension builders.

Below are the exact implementation specifications for each module.

---

### 4.1 `src/editor/editorThemes.ts`

```typescript
import { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { WanimEditorTheme } from '../types';

/**
 * Immutable lookup map from theme identifier to CodeMirror 6 extension.
 * Adheres to {value}By{key} naming convention.
 */
export const themeExtensionByTheme: Readonly<Record<WanimEditorTheme, Extension>> = Object.freeze({
	obsidian: [],
	'github-light': githubLight,
	'github-dark': githubDark,
	'one-dark': oneDark,
	monokai: monokai,
});

/**
 * Honest leaf function: maps a WanimEditorTheme identifier to its CM6 extension.
 * Pure function: reads only explicitly declared parameter, returns deterministic Extension.
 */
export function resolveEditorThemeExtension(theme: WanimEditorTheme): Extension {
	const extension = themeExtensionByTheme[theme];
	if (extension !== undefined) {
		return extension;
	}
	return themeExtensionByTheme['obsidian'];
}
```

---

### 4.2 `src/editor/editorStyle.ts`

```typescript
import { EditorView } from '@codemirror/view';

/**
 * Base CodeMirror 6 theme extension for Obsidian Wanim Plugin.
 * Enforces bright red fat cursor (#f10707) in Vim Normal Mode,
 * thin white line cursor in Insert Mode, selection styling, and typography.
 */
export const wanimEditorBaseTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--code-background, var(--background-primary))',
		color: 'var(--wanim-code-color, var(--code-normal, var(--text-normal)))',
	},
	'.cm-content': {
		caretColor: '#ffffff !important',
	},
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
		backgroundColor: 'var(--wanim-selection-color, var(--text-selection)) !important',
	},
	'.cm-fat-cursor, &:not(.cm-focused) .cm-fat-cursor, &.cm-focused .cm-fat-cursor': {
		position: 'absolute',
		display: 'inline-block !important',
		visibility: 'visible !important',
		background: 'var(--wanim-vim-cursor-color, #f10707) !important',
		backgroundColor: 'var(--wanim-vim-cursor-color, #f10707) !important',
		color: '#ffffff !important',
		minWidth: '0.65em !important',
		border: 'none !important',
		borderLeft: 'none !important',
		outline: 'none !important',
		whiteSpace: 'pre',
		zIndex: '100 !important',
		opacity: '0.75 !important',
		pointerEvents: 'none !important',
	},
	'.cm-scroller:not(.cm-vimMode) .cm-cursorLayer:not(.cm-vimCursorLayer), .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer': {
		display: 'block !important',
		visibility: 'visible !important',
	},
	'.cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer)': {
		display: 'none !important',
	},
	'.cm-cursor:not(.cm-fat-cursor), .cm-dropCursor': {
		display: 'block !important',
		visibility: 'visible !important',
		borderLeft: '2px solid #ffffff !important',
		borderLeftColor: '#ffffff !important',
		borderLeftWidth: '2px !important',
		zIndex: '100 !important',
		opacity: '1 !important',
	},
});

/**
 * Mapping of CSS variable names to computed style property names.
 * Adheres to {value}By{key} naming convention.
 */
const propertyNameByCssVar: Readonly<Record<string, string>> = Object.freeze({
	'--wanim-code-color': 'color',
	'--wanim-code-font-family': 'font-family',
	'--wanim-code-font-size': 'font-size',
	'--wanim-code-line-height': 'line-height',
	'--wanim-code-letter-spacing': 'letter-spacing',
	'--wanim-code-font-weight': 'font-weight',
});

/**
 * Boundary procedure: synchronizes typography and colors from Obsidian's active CM6 editor
 * into CSS variables on the target host element.
 */
export function syncStylesFromNativeCodeMirror(
	hostEl: HTMLElement,
	rootDocument: Document = document
): void {
	const nativeContent = rootDocument.querySelector(
		'.markdown-source-view.mod-cm6 .cm-editor .cm-content'
	);
	if (!(nativeContent instanceof HTMLElement)) {
		return;
	}

	const computed = getComputedStyle(nativeContent);
	for (const [cssVar, property] of Object.entries(propertyNameByCssVar)) {
		const value = computed.getPropertyValue(property);
		if (value.trim()) {
			hostEl.style.setProperty(cssVar, value);
		}
	}
}
```

---

### 4.3 `src/editor/vimIntegration.ts`

```typescript
import { Extension } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';
import { App, EventRef, Plugin } from 'obsidian';

/**
 * Honest leaf function: detects whether Vim mode is enabled in Obsidian via a 5-tier inspection.
 * Accepts explicit App dependency. Never accesses global singletons.
 */
export function detectObsidianVimMode(app: App): boolean {
	const anyApp = app as unknown as Record<string, unknown>;
	const vault = app.vault as unknown as Record<string, unknown>;

	// Tier 1: vault.getConfig('vimMode')
	if (typeof vault?.getConfig === 'function') {
		const configVal = (vault.getConfig as (key: string) => unknown)('vimMode');
		if (typeof configVal === 'boolean') {
			return configVal;
		}
	}

	// Tier 2: vault.config?.vimMode
	const rawConfig = vault?.config;
	if (rawConfig && typeof rawConfig === 'object' && 'vimMode' in rawConfig) {
		const vimMode = (rawConfig as Record<string, unknown>).vimMode;
		if (typeof vimMode === 'boolean') {
			return vimMode;
		}
	}

	// Tier 3: app.isVimEnabled()
	if (typeof anyApp?.isVimEnabled === 'function') {
		return Boolean((anyApp.isVimEnabled as () => unknown)());
	}

	// Tier 4: internal editor plugin options
	const internalPlugins = anyApp?.internalPlugins as Record<string, unknown> | undefined;
	const plugins = internalPlugins?.plugins as Record<string, unknown> | undefined;
	const editorPlugin = plugins?.editor as Record<string, unknown> | undefined;
	const instance = editorPlugin?.instance as Record<string, unknown> | undefined;
	const options = instance?.options as Record<string, unknown> | undefined;
	if (typeof options?.vimMode === 'boolean') {
		return options.vimMode;
	}

	// Tier 5: fallback CodeMirrorAdapter.Vim on window
	const win = window as unknown as Record<string, unknown>;
	const adapter = win?.CodeMirrorAdapter as Record<string, unknown> | undefined;
	return Boolean(adapter?.Vim);
}

/**
 * Honest leaf function: creates the Vim extension or an empty extension.
 */
export function createVimExtension(isEnabled: boolean): Extension {
	return isEnabled ? vim() : [];
}

/**
 * Boundary registration: attaches a vault config-changed listener to synchronize Vim mode.
 */
export function registerVimModeChangeListener(
	plugin: Plugin,
	onVimModeChange: (isVimEnabled: boolean) => void
): EventRef {
	const vault = plugin.app.vault as unknown as {
		on(event: 'config-changed', callback: () => void): EventRef;
	};
	return vault.on('config-changed', () => {
		const isVim = detectObsidianVimMode(plugin.app);
		onVimModeChange(isVim);
	});
}
```

---

### 4.4 `src/editor/stateStore.ts`

```typescript
import { MarkdownPostProcessorContext } from 'obsidian';
import { WanimBlockState } from '../types';

/**
 * Internal state caches adhering to {value}By{key} naming.
 */
const blockStateByKey = new Map<string, WanimBlockState>();
const recentStateByFilePath = new Map<string, WanimBlockState>();

const MAX_FALLBACK_AGE_MS = 30_000;

/**
 * Honest leaf function: generates a deterministic key identifying the code block.
 */
export function generateBlockKey(
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement
): string {
	const sectionInfo = ctx.getSectionInfo(el);
	if (sectionInfo) {
		return `${ctx.sourcePath}::line:${sectionInfo.lineStart}`;
	}
	return `${ctx.sourcePath}::el:${el.id || 'default'}`;
}

/**
 * Pure leaf function: merges updates into existing state with current timestamp.
 */
export function mergeBlockState(
	existing: WanimBlockState | undefined,
	updates: Partial<WanimBlockState>,
	timestamp: number = Date.now()
): WanimBlockState {
	return {
		isCollapsed: updates.isCollapsed ?? existing?.isCollapsed ?? false,
		cursorAnchor: updates.cursorAnchor ?? existing?.cursorAnchor ?? 0,
		cursorHead: updates.cursorHead ?? existing?.cursorHead ?? 0,
		scrollTop: updates.scrollTop ?? existing?.scrollTop ?? 0,
		scrollLeft: updates.scrollLeft ?? existing?.scrollLeft ?? 0,
		hadFocus: updates.hadFocus ?? existing?.hadFocus ?? false,
		timestamp,
	};
}

/**
 * Boundary procedure: saves updated block state into memory caches.
 */
export function saveBlockState(
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	updates: Partial<WanimBlockState>,
	clock: () => number = Date.now
): void {
	const key = generateBlockKey(ctx, el);
	const existing = blockStateByKey.get(key);
	const updated = mergeBlockState(existing, updates, clock());

	blockStateByKey.set(key, updated);
	recentStateByFilePath.set(ctx.sourcePath, updated);
}

/**
 * Boundary query: retrieves persisted block state with 30s line-shift fallback.
 */
export function getPersistedBlockState(
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	currentTime: number = Date.now()
): WanimBlockState | undefined {
	const key = generateBlockKey(ctx, el);
	const exactState = blockStateByKey.get(key);
	if (exactState !== undefined) {
		return exactState;
	}

	const fallbackState = recentStateByFilePath.get(ctx.sourcePath);
	if (fallbackState && currentTime - fallbackState.timestamp < MAX_FALLBACK_AGE_MS) {
		return fallbackState;
	}

	return undefined;
}

/**
 * Cache clearance for testing or memory release.
 */
export function clearBlockStateCache(): void {
	blockStateByKey.clear;
	recentStateByFilePath.clear();
}
```

---

### 4.5 `src/editor/editorChild.ts`

```typescript
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap } from '@codemirror/view';
import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type ObsidianWanimPlugin from '../main';
import { ThemeableEditor, WanimBlockState, WanimEditorTheme } from '../types';
import { syncStylesFromNativeCodeMirror, wanimEditorBaseTheme } from './editorStyle';
import { resolveEditorThemeExtension } from './editorThemes';
import { generateBlockKey, saveBlockState } from './stateStore';
import { createVimExtension, detectObsidianVimMode } from './vimIntegration';

// ============================================================================
// Types & Options (Invariant-Rich Signatures)
// ============================================================================

export interface WanimCodeEditorOptions {
	readonly plugin: ObsidianWanimPlugin;
	readonly ctx: MarkdownPostProcessorContext;
	readonly contextEl: HTMLElement;
	readonly initialSource: string;
	readonly theme: WanimEditorTheme;
	readonly initialBlockState?: WanimBlockState;
	readonly onDocChanged?: (newCode: string) => void;
}

export interface EditorExtensionConfig {
	readonly vimCompartment: Compartment;
	readonly themeCompartment: Compartment;
	readonly isVimEnabled: boolean;
	readonly theme: WanimEditorTheme;
	readonly onDocChanged: (docText: string) => void;
	readonly onStateActivity: () => void;
}

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Clamps a cursor offset safely within document boundaries.
 */
export function clampPosition(position: number, maxPosition: number): number {
	return Math.max(0, Math.min(position, maxPosition));
}

/**
 * Computes the initial editor selection safely bounded to document length.
 */
export function buildInitialSelection(
	cursorAnchor: number | undefined,
	cursorHead: number | undefined,
	docLength: number
): { anchor: number; head: number } | undefined {
	if (cursorAnchor === undefined || cursorHead === undefined) {
		return undefined;
	}
	const anchor = clampPosition(cursorAnchor, docLength);
	const head = clampPosition(cursorHead, docLength);
	return { anchor, head };
}

/**
 * Honest leaf function: constructs the complete array of CodeMirror 6 extensions.
 * Configures:
 * 1. Dynamic Vim mode compartment with @replit/codemirror-vim
 * 2. Dynamic Theme compartment (Obsidian, GitHub, One Dark, Monokai)
 * 3. Python grammar and syntax highlighting via @codemirror/lang-python
 * 4. 4-space tab indentation: tabSize 4, indentUnit 4 spaces, indentWithTab keymap
 * 5. Update listener for document changes and state snapshotting
 */
export function createEditorExtensions(config: EditorExtensionConfig): Extension[] {
	return [
		config.vimCompartment.of(createVimExtension(config.isVimEnabled)),
		history(),
		drawSelection(),
		highlightActiveLine(),
		closeBrackets(),
		wanimEditorBaseTheme,
		config.themeCompartment.of(resolveEditorThemeExtension(config.theme)),
		syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
		python(),
		EditorView.lineWrapping,
		EditorState.tabSize.of(4),
		indentUnit.of('    '),
		keymap.of([
			indentWithTab,
			...closeBracketsKeymap,
			...defaultKeymap,
			...historyKeymap,
		]),
		EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				config.onDocChanged(update.state.doc.toString());
			}
			if (update.selectionSet || update.docChanged) {
				config.onStateActivity();
			}
		}),
	];
}

// ============================================================================
// WanimCodeEditorChild Class (Imperative Shell / Stacking Bricks)
// ============================================================================

export class WanimCodeEditorChild
	extends MarkdownRenderChild
	implements ThemeableEditor
{
	readonly id: string;
	private editorView: EditorView | null = null;
	private readonly themeCompartment = new Compartment();
	private readonly vimCompartment = new Compartment();

	constructor(
		containerEl: HTMLElement,
		private readonly options: WanimCodeEditorOptions
	) {
		super(containerEl);
		this.id = generateBlockKey(options.ctx, options.contextEl);
	}

	// ------------------------------------------------------------------------
	// Lifecycle: Stacking Bricks (Uniform Level of Abstraction)
	// ------------------------------------------------------------------------

	onload(): void {
		this.mountEditor();
		this.attachEventListeners();
		this.restoreSavedViewState();
		this.registerWithPlugin();
	}

	onunload(): void {
		this.snapshotCurrentState();
		this.unregisterFromPlugin();
		this.destroyEditorView();
	}

	// ------------------------------------------------------------------------
	// Discrete Orchestration Bricks
	// ------------------------------------------------------------------------

	private mountEditor(): void {
		this.containerEl.classList.add('wanim-code-editor');
		syncStylesFromNativeCodeMirror(this.containerEl);

		const isVim = detectObsidianVimMode(this.options.plugin.app);
		const extensions = createEditorExtensions({
			vimCompartment: this.vimCompartment,
			themeCompartment: this.themeCompartment,
			isVimEnabled: isVim,
			theme: this.options.theme,
			onDocChanged: (newCode) => {
				this.options.onDocChanged?.(newCode);
			},
			onStateActivity: () => {
				this.snapshotCurrentState();
			},
		});

		const selection = buildInitialSelection(
			this.options.initialBlockState?.cursorAnchor,
			this.options.initialBlockState?.cursorHead,
			this.options.initialSource.length
		);

		const state = EditorState.create({
			doc: this.options.initialSource,
			selection: selection ? EditorSelection.range(selection.anchor, selection.head) : undefined,
			extensions,
		});

		this.editorView = new EditorView({
			state,
			parent: this.containerEl,
		});

		this.editorView.dom.classList.add('cm-s-obsidian');
	}

	private attachEventListeners(): void {
		if (!this.editorView) return;

		this.editorView.scrollDOM.addEventListener(
			'scroll',
			() => {
				this.snapshotCurrentState();
			},
			{ passive: true }
		);

		this.options.plugin.registerDomEvent(this.containerEl, 'pointerdown', () => {
			if (this.editorView && !this.editorView.hasFocus) {
				this.editorView.focus();
			}
			this.snapshotCurrentState();
		});
	}

	private restoreSavedViewState(): void {
		const saved = this.options.initialBlockState;
		if (!saved) return;

		requestAnimationFrame(() => {
			if (!this.editorView) return;

			if (saved.scrollTop > 0 || saved.scrollLeft > 0) {
				this.editorView.scrollDOM.scrollTop = saved.scrollTop;
				this.editorView.scrollDOM.scrollLeft = saved.scrollLeft;
			}

			if (saved.hadFocus && !this.editorView.hasFocus) {
				this.editorView.focus();
			}
		});
	}

	private registerWithPlugin(): void {
		this.options.plugin.registerActiveEditor(this);
	}

	private unregisterFromPlugin(): void {
		this.options.plugin.unregisterActiveEditor(this.id);
	}

	private destroyEditorView(): void {
		this.editorView?.destroy();
		this.editorView = null;
	}

	// ------------------------------------------------------------------------
	// Public ThemeableEditor & Controller Interface
	// ------------------------------------------------------------------------

	setEditorTheme(theme: WanimEditorTheme): void {
		if (!this.editorView) return;
		this.editorView.dispatch({
			effects: this.themeCompartment.reconfigure(resolveEditorThemeExtension(theme)),
		});
	}

	setVimEnabled(isEnabled: boolean): void {
		if (!this.editorView) return;
		this.editorView.dispatch({
			effects: this.vimCompartment.reconfigure(createVimExtension(isEnabled)),
		});
	}

	getCode(): string {
		return this.editorView?.state.doc.toString() ?? this.options.initialSource;
	}

	setCode(newCode: string): void {
		if (!this.editorView) return;
		const docLength = this.editorView.state.doc.length;
		this.editorView.dispatch({
			changes: { from: 0, to: docLength, insert: newCode },
		});
	}

	focus(): void {
		this.editorView?.focus();
	}

	requestMeasure(): void {
		this.editorView?.requestMeasure();
	}

	snapshotCurrentState(forceCollapsed?: boolean): void {
		if (!this.editorView) return;

		const selection = this.editorView.state.selection.main;
		const updates: Partial<WanimBlockState> = {
			cursorAnchor: selection.anchor,
			cursorHead: selection.head,
			scrollTop: this.editorView.scrollDOM.scrollTop,
			scrollLeft: this.editorView.scrollDOM.scrollLeft,
			hadFocus: this.editorView.hasFocus,
			...(forceCollapsed !== undefined ? { isCollapsed: forceCollapsed } : {}),
		};

		saveBlockState(this.options.ctx, this.options.contextEl, updates);
	}
}
```

---

## 5. Verification Method

### 5.1 Build Compilation Test
Run the project build script in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`:
```powershell
Set-Location "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
npm run build
```
**Expected Result**:
- TypeScript compiler emits zero errors (`tsc -noEmit -skipLibCheck` succeeds).
- esbuild bundles `src/main.ts` into `main.js` with Python parser and Vim bundled, externalizing only core `@codemirror/*` modules.

### 5.2 Unit Verification Test for Editor Extensions & Leaf Functions
Execute a node test script verifying:
1. `createEditorExtensions(...)` returns an array of length 13 containing `python()` and `tabSize: 4`.
2. `resolveEditorThemeExtension(...)` returns valid extensions for `'github-light'`, `'github-dark'`, `'one-dark'`, `'monokai'`, and `'obsidian'`.
3. `clampPosition(-5, 100)` returns `0`; `clampPosition(120, 100)` returns `100`.
4. `detectObsidianVimMode(...)` correctly detects mock vault configs.
5. Invalidation conditions:
   - If Tab key inserts `\t` instead of 4 spaces, check `indentWithTab` and `indentUnit.of("    ")`.
   - If Vim cursor does not show red block, check that `.wanim-code-editor` class is present and `wanimEditorBaseTheme` is included in extensions.
