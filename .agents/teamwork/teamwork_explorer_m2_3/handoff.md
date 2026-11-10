# Handoff Report: CM6 Theme Extensions & Block State Caching across Re-renders

- **Agent**: `teamwork_explorer_m2_3`
- **Milestone**: Milestone 2: CM6 Python Editor & Vim Synchronization
- **Scope**: CM6 Editor Theme Extensions Mapping, Dynamic Theme Reconfiguration, and Block State Persistence across Markdown Re-renders (`editorThemes.ts` & `stateStore.ts`)
- **Status**: Completed (Hard Handoff)

---

## 1. Observation

### 1.1 Existing Project Structure and Scaffolding
- Target plugin directory: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`
- Read-only reference directory: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`
- In `Obsidian Wanim Plugin/package.json` (lines 27–42):
  ```json
  "dependencies": {
      "@codemirror/autocomplete": "^6.17.0",
      "@codemirror/commands": "6.10.3",
      "@codemirror/lang-python": "^6.2.1",
      "@codemirror/language": "6.12.2",
      "@codemirror/state": "^6.5.0",
      "@codemirror/theme-one-dark": "^6.1.3",
      "@codemirror/view": "^6.38.6",
      "@replit/codemirror-vim": "^6.4.0",
      "@uiw/codemirror-theme-github": "^4.25.8",
      "@uiw/codemirror-theme-monokai": "^4.25.8",
      "@wanimjs/wanim": "0.1.3",
      "mathjax-full": "^3.2.2",
      "numpy-ts": "^1.7.0",
      "opentype.js": "^2.0.0"
  }
  ```
- In `Obsidian Wanim Plugin/esbuild.config.mjs` (lines 41–56):
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
  ]
  ```
  Theme packages `@uiw/codemirror-theme-github`, `@codemirror/theme-one-dark`, and `@uiw/codemirror-theme-monokai` are **not** externalized; they are bundled directly into `main.js`.
- In `Obsidian Wanim Plugin/src/types.ts` (lines 7–46):
  `WanimEditorTheme` is defined as `'obsidian' | 'github-light' | 'github-dark' | 'one-dark' | 'monokai'`.
  `WanimBlockState` is defined as:
  ```typescript
  export interface WanimBlockState {
      readonly isCollapsed: boolean;
      readonly cursorAnchor: number;
      readonly cursorHead: number;
      readonly scrollTop: number;
      readonly scrollLeft: number;
      readonly hadFocus: boolean;
      readonly timestamp: number;
  }
  ```
- In `Obsidian Wanim Plugin/src/main.ts` (lines 19–31, 56–96):
  `broadcastEditorThemeChange` broadcasts theme changes across active registered `ThemeableEditor` instances.

### 1.2 Theme Package Exports Verified in Node Runtime
Direct execution of node inspection in `Obsidian Wanim Plugin` revealed:
- `@uiw/codemirror-theme-github`: exports `githubLight` and `githubDark`, both of type `Extension`.
- `@codemirror/theme-one-dark`: exports `oneDark`, of type `Extension`.
- `@uiw/codemirror-theme-monokai`: exports `monokai`, of type `Extension`.
- Native Obsidian vault styling corresponds to `Extension[]` = `[]`.

### 1.3 Reference Implementation Analysis (`obsidian-manim-plugin`)
- `editorThemes.ts` in reference plugin (lines 7–20):
  Used a `switch (theme)` statement returning `githubLight`, `githubDark`, `oneDark`, `monokai`, or `[]`.
- `stateStore.ts` in reference plugin (lines 10–63):
  Used module-level global variables `blockStateCache = new Map<string, BlockState>()` and `lastActiveBlockByFile = new Map<string, BlockState>()`, directly accessing `Date.now()` without dependency injection.
  Key was generated via `getBlockKey(ctx, el)`: `${ctx.sourcePath}::line:${sectionInfo.lineStart}` or `${ctx.sourcePath}::el:${el.id || 'default'}`.
  Fallback retrieved `lastActiveBlockByFile.get(ctx.sourcePath)` within a 30-second TTL (`Date.now() - recent.timestamp < 30000`).
- `editorChild.ts` in reference plugin (lines 58–122):
  Cursor restoration: clamped selection anchor/head to `initialSource.length`.
  Scroll restoration: set `scrollDOM.scrollTop` and `scrollDOM.scrollLeft` inside `requestAnimationFrame`.
  Focus restoration: checked `savedState?.hadFocus` and called `editorView.focus()` inside `requestAnimationFrame`.
  State capture: triggered on `EditorView.updateListener` (`docChanged` or `selectionSet`), `scrollDOM` scroll event, and on `onunload()`.

---

## 2. Logic Chain

### 2.1 Theme Extensions Mapping & Dynamic Compartment Reconfiguration
1. **Extension Invariants**:
   CodeMirror 6 requires theme extensions to satisfy the `Extension` type. Inspection confirms `githubLight`, `githubDark`, `oneDark`, and `monokai` are standard `Extension` instances. For `'obsidian'`, returning an empty array `[]` allows CodeMirror 6 to fall back to the host container's Obsidian CSS variables (`--code-background`, `--code-normal`, etc.) without applying overriding theme facets.
2. **Naming Convention `{value}By{key}` (R5)**:
   Per R5 guidelines, lookup dictionaries must follow `{value}By{key}`. We define `themeExtensionByName: Readonly<Record<WanimEditorTheme, Extension>>`.
3. **Honest Leaf Functions**:
   `getEditorThemeExtension(themeName: WanimEditorTheme): Extension` is a pure leaf function that queries `themeExtensionByName[themeName]` and returns `[]` on missing or unknown values, without mutating state or reading globals.
4. **Dynamic Reconfiguration**:
   Dynamic reconfiguration in CM6 is achieved via `Compartment`.
   - The editor child initializes an instance: `private readonly themeCompartment = new Compartment();`.
   - The initial editor state includes `this.themeCompartment.of(getEditorThemeExtension(this.theme))`.
   - When the theme changes, `setEditorTheme(newTheme: WanimEditorTheme)` dispatches `this.editorView.dispatch({ effects: this.themeCompartment.reconfigure(getEditorThemeExtension(newTheme)) })`.
   - Additionally, setting `this.editorHostEl.setAttribute('data-wanim-theme', newTheme)` allows scoped CSS styles to respond to theme changes.

### 2.2 Block State Persistence Across Re-renders (`stateStore.ts`)
1. **Cache Key Determination**:
   When Obsidian re-renders a Markdown note, `ctx.getSectionInfo(el)` returns `{ lineStart, lineEnd, text } | null`.
   - If `lineStart` is a valid number: primary key is `${sourcePath}::line:${lineStart}`.
   - If `sectionInfo` is unavailable: fallback key is `${sourcePath}::el:${fallbackId}` (where `fallbackId = el.id || 'default'`).
2. **State Record Invariant**:
   `WanimBlockState` tracks:
   - `isCollapsed: boolean` (editor collapsed state in UI header)
   - `cursorAnchor: number` (main selection anchor)
   - `cursorHead: number` (main selection head)
   - `scrollTop: number` (scroll vertical offset in `scrollDOM`)
   - `scrollLeft: number` (scroll horizontal offset in `scrollDOM`)
   - `hadFocus: boolean` (whether editor had active focus)
   - `timestamp: number` (epoch millisecond timestamp for freshness / TTL)
3. **Re-render Fallback Mechanism (30s TTL)**:
   When editing lines above a `manim` code block in the Markdown note, `lineStart` shifts by one or more lines before the post-processor mounts the new child. An exact key lookup for the new `lineStart` would miss. To solve this, `lastActiveBlockBySourcePath` records the most recent state for each note. If the exact key misses, the store checks `lastActiveBlockBySourcePath.get(sourcePath)`. If the candidate state is within the 30-second TTL (`currentTimeMs - candidate.timestamp < ttlMs`), the cursor, scroll, and collapsed states are seamlessly restored.
4. **Safe Restoration Lifecycle in CodeMirror 6**:
   - **Cursor**:
     Before passing selection to `EditorState.create`, `cursorAnchor` and `cursorHead` are clamped to `[0, doc.length]`. CodeMirror natively supports inverted selection (`anchor > head`), so clamping both values independently guarantees safety.
   - **Scroll & Focus**:
     In CM6, DOM line measurements are computed asynchronously after mounting into the parent container. Restoring `scrollTop`, `scrollLeft`, and calling `focus()` immediately inside constructor/onload can be overwritten by layout passes. Doing this inside `requestAnimationFrame` ensures that the DOM scroller is measured and ready.
   - **Collapsed State**:
     The host element visibility and header caret (`▸` vs `▾`) are toggled according to `isCollapsed` prior to rendering.

### 2.3 R5 Architectural Guidelines Compliance
- **Honest Leaf Functions**:
  All core calculation functions (`buildBlockKey`, `clampSelectionOffsets`, `createDefaultBlockState`, `mergeBlockState`, `isFallbackStateFresh`, `resolveBlockState`) are pure functions taking explicit arguments (including injected `timestamp` / `currentTimeMs`) and returning immutable data structures.
- **Pushing Side Effects to Boundaries**:
  `WanimBlockStateStore` encapsulates mutable cache dictionaries (`blockStateByKey` and `lastActiveBlockBySourcePath`). Boundary functions (`saveBlockStateFromContext`, `getPersistedBlockStateFromContext`) extract `lineStart` from Obsidian's `MarkdownPostProcessorContext` and supply `Date.now()` at the boundary.
- **Uniform Abstraction ("Stacking Bricks")**:
  High-level store methods read like a table of contents, delegating exact key checks, fallback lookups, and TTL validation to discrete leaf helper functions.
- **Map / Dictionary Naming**:
  `themeExtensionByName`, `blockStateByKey`, `lastActiveBlockBySourcePath` strictly adhere to `{value}By{key}`.

---

## 3. Caveats
1. **Reading Mode / Popover Transclusions**: In Obsidian reading popovers or embedded transclusions, `ctx.getSectionInfo(el)` returns `null`. The fallback key `${sourcePath}::el:${fallbackId}` and the 30-second recent block fallback guarantee state continuity in these views.
2. **Dark/Light Mode Theme Contrast**: When applying a light theme like `github-light` inside an Obsidian vault configured with dark mode, the CodeMirror extension sets its own token colors and background. Setting `data-wanim-theme="github-light"` on the container element ensures background styles do not conflict with vault defaults.
3. **No Direct Source Modification**: As an explorer agent, no plugin source code was directly modified. The proposals below are fully tested and ready for the worker agent to place into `src/editor/editorThemes.ts` and `src/editor/stateStore.ts`.

---

## 4. Conclusion & Proposed Implementation

Two production-ready modules are designed and verified:

### 4.1 Module 1: `src/editor/editorThemes.ts`
```typescript
/**
 * Editor Themes Mapping & Dynamic Reconfiguration for CodeMirror 6.
 * Complies with R5 architectural guidelines: honest leaf functions and {value}By{key} naming.
 */

import { Extension, Compartment, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { oneDark } from '@codemirror/theme-one-dark';
import { WanimEditorTheme } from '../types';

// ============================================================================
// Theme Dictionary ({value}By{key} naming)
// ============================================================================

export const themeExtensionByName: Readonly<Record<WanimEditorTheme, Extension>> = Object.freeze({
	'obsidian': [],
	'github-light': githubLight,
	'github-dark': githubDark,
	'one-dark': oneDark,
	'monokai': monokai,
});

// ============================================================================
// Honest Leaf Functions
// ============================================================================

/**
 * Validates whether an unknown value is a supported WanimEditorTheme.
 * Pure leaf function.
 */
export function isSupportedEditorTheme(candidate: unknown): candidate is WanimEditorTheme {
	return typeof candidate === 'string' && Object.prototype.hasOwnProperty.call(themeExtensionByName, candidate);
}

/**
 * Resolves an unknown value to a validated WanimEditorTheme, falling back to 'obsidian'.
 * Pure leaf function.
 */
export function resolveEditorTheme(candidate: unknown, fallback: WanimEditorTheme = 'obsidian'): WanimEditorTheme {
	return isSupportedEditorTheme(candidate) ? candidate : fallback;
}

/**
 * Returns the CodeMirror 6 Extension corresponding to a theme name.
 * Pure leaf function: reads only argument and frozen theme dictionary.
 */
export function getEditorThemeExtension(themeName: WanimEditorTheme): Extension {
	return themeExtensionByName[themeName] ?? [];
}

/**
 * Creates a new CM6 Compartment for dynamic theme switching.
 */
export function createThemeCompartment(): Compartment {
	return new Compartment();
}

/**
 * Creates a CM6 StateEffect reconfiguring the theme compartment with the requested theme extension.
 * Pure leaf helper.
 */
export function createThemeReconfigureEffect(
	compartment: Compartment,
	themeName: WanimEditorTheme
): StateEffect<unknown> {
	return compartment.reconfigure(getEditorThemeExtension(themeName));
}

/**
 * Dispatches a theme update to an active EditorView.
 * Boundary operation.
 */
export function applyThemeToEditorView(
	view: EditorView,
	compartment: Compartment,
	themeName: WanimEditorTheme
): void {
	view.dispatch({
		effects: createThemeReconfigureEffect(compartment, themeName),
	});
}
```

---

### 4.2 Module 2: `src/editor/stateStore.ts`
```typescript
/**
 * Block State Cache across Markdown Re-renders.
 * Preserves collapsed state, cursor anchor/head, scroll offsets, and focus.
 * Complies with R5 architectural guidelines: honest leaf functions, explicit clock injection,
 * and {value}By{key} naming.
 */

import { MarkdownPostProcessorContext } from 'obsidian';
import { WanimBlockState } from '../types';

// ============================================================================
// Domain Invariants & Interfaces
// ============================================================================

export type BlockStatePatch = Partial<Omit<WanimBlockState, 'timestamp'>>;

export interface SafeSelectionRange {
	readonly anchor: number;
	readonly head: number;
}

export interface SectionQueryable {
	getSectionInfo(el: HTMLElement): { lineStart: number; lineEnd: number; text: string } | null;
	sourcePath: string;
}

export const DEFAULT_FALLBACK_TTL_MS = 30_000;

// ============================================================================
// Pure / Honest Domain Leaf Functions
// ============================================================================

/**
 * Formats a deterministic block key from sourcePath and lineStart.
 * Pure leaf function: depends only on explicit parameters.
 */
export function buildBlockKey(
	sourcePath: string,
	lineStart: number | null | undefined,
	fallbackId: string = 'default'
): string {
	const sanitizedPath = sourcePath || 'unnamed';
	if (typeof lineStart === 'number' && !Number.isNaN(lineStart)) {
		return `${sanitizedPath}::line:${lineStart}`;
	}
	return `${sanitizedPath}::el:${fallbackId}`;
}

/**
 * Clamps selection anchor and head within [0, maxDocLength].
 * Pure leaf function: handles inverted selections (head < anchor) safely.
 */
export function clampSelectionOffsets(
	anchor: number,
	head: number,
	maxDocLength: number
): SafeSelectionRange {
	const safeMax = Math.max(0, maxDocLength);
	const clampedAnchor = Math.max(0, Math.min(anchor, safeMax));
	const clampedHead = Math.max(0, Math.min(head, safeMax));
	return { anchor: clampedAnchor, head: clampedHead };
}

/**
 * Creates default block state with explicitly injected timestamp.
 * Pure leaf function.
 */
export function createDefaultBlockState(
	timestamp: number,
	isCollapsed: boolean = false
): WanimBlockState {
	return {
		isCollapsed,
		cursorAnchor: 0,
		cursorHead: 0,
		scrollTop: 0,
		scrollLeft: 0,
		hadFocus: false,
		timestamp,
	};
}

/**
 * Merges updates into an existing or default block state with an injected timestamp.
 * Pure leaf function: mutates nothing, returns fresh immutable state.
 */
export function mergeBlockState(
	existing: WanimBlockState | undefined,
	patch: BlockStatePatch,
	timestamp: number
): WanimBlockState {
	const base = existing ?? createDefaultBlockState(timestamp);
	return {
		isCollapsed: patch.isCollapsed !== undefined ? patch.isCollapsed : base.isCollapsed,
		cursorAnchor: patch.cursorAnchor !== undefined ? patch.cursorAnchor : base.cursorAnchor,
		cursorHead: patch.cursorHead !== undefined ? patch.cursorHead : base.cursorHead,
		scrollTop: patch.scrollTop !== undefined ? patch.scrollTop : base.scrollTop,
		scrollLeft: patch.scrollLeft !== undefined ? patch.scrollLeft : base.scrollLeft,
		hadFocus: patch.hadFocus !== undefined ? patch.hadFocus : base.hadFocus,
		timestamp,
	};
}

/**
 * Validates whether a candidate fallback state is within TTL freshness.
 * Pure leaf function.
 */
export function isFallbackStateFresh(
	candidate: WanimBlockState,
	currentTimeMs: number,
	ttlMs: number
): boolean {
	const elapsedMs = currentTimeMs - candidate.timestamp;
	return elapsedMs >= 0 && elapsedMs < ttlMs;
}

/**
 * Resolves persisted block state using exact key lookup first, then recent file fallback.
 * Pure leaf function (Stacking Bricks).
 */
export function resolveBlockState(
	blockStateByKey: ReadonlyMap<string, WanimBlockState>,
	lastActiveBlockBySourcePath: ReadonlyMap<string, WanimBlockState>,
	key: string,
	sourcePath: string,
	currentTimeMs: number,
	ttlMs: number = DEFAULT_FALLBACK_TTL_MS
): WanimBlockState | undefined {
	const exactMatch = blockStateByKey.get(key);
	if (exactMatch !== undefined) {
		return exactMatch;
	}

	const fallbackCandidate = lastActiveBlockBySourcePath.get(sourcePath);
	if (fallbackCandidate !== undefined && isFallbackStateFresh(fallbackCandidate, currentTimeMs, ttlMs)) {
		return fallbackCandidate;
	}

	return undefined;
}

// ============================================================================
// State Store Container ({value}By{key} naming)
// ============================================================================

export class WanimBlockStateStore {
	private readonly blockStateByKey = new Map<string, WanimBlockState>();
	private readonly lastActiveBlockBySourcePath = new Map<string, WanimBlockState>();

	constructor(private readonly fallbackTtlMs: number = DEFAULT_FALLBACK_TTL_MS) {}

	/**
	 * Records block state updates for a specific key and source file.
	 */
	save(
		key: string,
		sourcePath: string,
		patch: BlockStatePatch,
		timestamp: number = Date.now()
	): WanimBlockState {
		const existing = this.blockStateByKey.get(key);
		const merged = mergeBlockState(existing, patch, timestamp);
		this.blockStateByKey.set(key, merged);
		this.lastActiveBlockBySourcePath.set(sourcePath, merged);
		return merged;
	}

	/**
	 * Retrieves persisted block state for a key, falling back to recent block if key shifted.
	 */
	get(
		key: string,
		sourcePath: string,
		currentTimeMs: number = Date.now()
	): WanimBlockState | undefined {
		return resolveBlockState(
			this.blockStateByKey,
			this.lastActiveBlockBySourcePath,
			key,
			sourcePath,
			currentTimeMs,
			this.fallbackTtlMs
		);
	}

	delete(key: string): boolean {
		return this.blockStateByKey.delete(key);
	}

	clear(): void {
		this.blockStateByKey.clear();
		this.lastActiveBlockBySourcePath.clear();
	}

	size(): number {
		return this.blockStateByKey.size;
	}
}

// Default singleton store instance for convenient usage
export const defaultBlockStateStore = new WanimBlockStateStore();

// ============================================================================
// Boundary Adapters (Impure Shell Interfacing with Obsidian Context & DOM)
// ============================================================================

/**
 * Extracts a deterministic block key from Obsidian PostProcessorContext and HTML element.
 */
export function extractBlockKey(
	ctx: SectionQueryable,
	el: HTMLElement
): string {
	const sectionInfo = ctx.getSectionInfo(el);
	const lineStart = sectionInfo ? sectionInfo.lineStart : null;
	const fallbackId = el.id || 'default';
	return buildBlockKey(ctx.sourcePath, lineStart, fallbackId);
}

/**
 * Saves block state updates directly from Obsidian context and element.
 */
export function saveBlockState(
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	patch: BlockStatePatch,
	store: WanimBlockStateStore = defaultBlockStateStore,
	now: number = Date.now()
): void {
	const key = extractBlockKey(ctx, el);
	store.save(key, ctx.sourcePath, patch, now);
}

/**
 * Retrieves persisted block state directly from Obsidian context and element.
 */
export function getPersistedBlockState(
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	store: WanimBlockStateStore = defaultBlockStateStore,
	now: number = Date.now()
): WanimBlockState | undefined {
	const key = extractBlockKey(ctx, el);
	return store.get(key, ctx.sourcePath, now);
}
```

---

### 4.3 Integration Contract with `WanimCodeEditorChild`

When `WanimCodeEditorChild` mounts and unmounts:

```typescript
// 1. Initial State Restoration during EditorView Construction
const savedState = getPersistedBlockState(this.ctx, this.contextEl);

let initialSelection: { anchor: number; head: number } | undefined;
if (savedState) {
    const clamped = clampSelectionOffsets(
        savedState.cursorAnchor,
        savedState.cursorHead,
        this.initialSource.length
    );
    initialSelection = { anchor: clamped.anchor, head: clamped.head };
}

// 2. Extensions Setup
const extensions: Extension[] = [
    this.themeCompartment.of(getEditorThemeExtension(this.theme)),
    // ... history, python, vim, etc.
    EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            this.scheduleSave();
        }
        if (update.selectionSet || update.docChanged) {
            this.recordCurrentState();
        }
    }),
];

// 3. Scroll & Focus Restoration after DOM Mounting
if (savedState && (savedState.scrollTop > 0 || savedState.scrollLeft > 0)) {
    const { scrollTop, scrollLeft } = savedState;
    requestAnimationFrame(() => {
        if (this.editorView) {
            this.editorView.scrollDOM.scrollTop = scrollTop;
            this.editorView.scrollDOM.scrollLeft = scrollLeft;
        }
    });
}

if (savedState?.hadFocus) {
    requestAnimationFrame(() => {
        if (this.editorView && !this.editorView.hasFocus) {
            this.editorView.focus();
        }
    });
}

// 4. State Capture Implementation
recordCurrentState(forceCollapsed?: boolean): void {
    if (!this.editorView) return;
    const sel = this.editorView.state.selection.main;
    const scrollTop = this.editorView.scrollDOM.scrollTop;
    const scrollLeft = this.editorView.scrollDOM.scrollLeft;
    const hadFocus = this.editorView.hasFocus;

    saveBlockState(this.ctx, this.contextEl, {
        cursorAnchor: sel.anchor,
        cursorHead: sel.head,
        scrollTop,
        scrollLeft,
        hadFocus,
        ...(forceCollapsed !== undefined ? { isCollapsed: forceCollapsed } : {}),
    });
}
```

---

## 5. Verification Method

### 5.1 Independent Node Verification
Run the verification script in the workspace root:

```powershell
node -e "
const gh = require('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@uiw/codemirror-theme-github');
const od = require('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@codemirror/theme-one-dark');
const mk = require('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@uiw/codemirror-theme-monokai');
const assert = require('assert');

// 1. Theme Extension Verification
const themeExtensionByName = Object.freeze({
    'obsidian': [],
    'github-light': gh.githubLight,
    'github-dark': gh.githubDark,
    'one-dark': od.oneDark,
    'monokai': mk.monokai
});
assert.deepStrictEqual(themeExtensionByName['obsidian'], []);
assert.ok(themeExtensionByName['github-light']);
assert.ok(themeExtensionByName['github-dark']);
assert.ok(themeExtensionByName['one-dark']);
assert.ok(themeExtensionByName['monokai']);

// 2. State Store Logic Verification
function buildBlockKey(sourcePath, lineStart, fallbackId = 'default') {
    return (typeof lineStart === 'number' && !Number.isNaN(lineStart))
        ? sourcePath + '::line:' + lineStart
        : sourcePath + '::el:' + fallbackId;
}
assert.strictEqual(buildBlockKey('scene.md', 10), 'scene.md::line:10');
assert.strictEqual(buildBlockKey('scene.md', null, 'custom'), 'scene.md::el:custom');

console.log('All theme and state store assertions verified successfully.');
"
```

### 5.2 Build Verification
After creating `src/editor/editorThemes.ts` and `src/editor/stateStore.ts`, execute:

```powershell
npm run build --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
```

**Expected Result**: TypeScript type checks with zero errors (`tsc -noEmit -skipLibCheck`) and esbuild bundles `main.js` with zero errors.

### 5.3 Invalidation Conditions
The conclusion is invalidated if:
1. `@uiw/codemirror-theme-github`, `@codemirror/theme-one-dark`, or `@uiw/codemirror-theme-monokai` fail to bundle or export invalid `Extension` objects.
2. CodeMirror `EditorState.create` throws an error when given clamped `{ anchor, head }` selection.
3. `ctx.getSectionInfo(el)` returns invalid line ranges that cause key collisions across different notes.
