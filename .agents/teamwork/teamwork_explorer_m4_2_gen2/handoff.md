# Handoff Report: Milestone 4 Header Controls Review & Design Specification

## 1. Observation

### 1.1 Context and Direct Observations
The M4 Header Controls component is responsible for orchestrating the interactive header toolbar located above each embedded Python Manim editor block. The authoritative requirements and existing assets were directly inspected:

1. **Authoritative Requirements (`ORIGINAL_REQUEST.md` & `PROJECT.md`)**:
   - `ORIGINAL_REQUEST.md` (lines 24-26, 30-32):
     > "Provide header controls for each code block: Run / Pause toggle, Restart button, collapse caret (▾ / ▸), save status indicator, and a dedicated red error panel formatting compilation errors and runtime tracebacks."
     > "Adhere strictly to the user's architectural guidelines: local reasoning and honest functions (push side effects such as vault I/O and DOM manipulation to boundaries, explicit dependency injection), single uniform level of abstraction ('stacking bricks'), invariant-rich signatures, and `{value}By{key}` naming convention for maps and dictionaries."
   - `PROJECT.md` (lines 62-65, 81):
     > "Feature 17: Header Controls & Icons: Run/Pause button, Restart button, collapse caret (▾ / ▸), save status indicator."
     > "Feature 18: Collapse / Expand Toggle: Caret toggles code editor visibility, updates aria-label, triggers measure."
     > "Milestone M4: UI Header Controls & Error Panel (IN_PROGRESS)."

2. **Predecessor's Proposed Implementation (`proposed_headerControls.ts`)**:
   Located at `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_2\proposed_headerControls.ts` (684 lines):
   - **Union Types & Interfaces** (lines 27-106):
     - `CollapseState = 'collapsed' | 'expanded'`
     - `PlaybackButtonState = 'run' | 'pause'`
     - `IndicatorStatus = 'hidden' | 'running' | 'paused' | 'saving' | 'saved'`
     - `TimerService`: abstraction for `setTimeout` / `clearTimeout`
     - `HeaderControlsElements`: DOM element references (`headerEl`, `caretEl`, `controlsEl`, `runButtonEl`, `runIconEl`, `runLabelEl`, `restartButtonEl`, `saveStateEl`)
     - `HeaderControlsOptions`: callbacks (`onPlay`, `onPause`, `onResume`, `onRestart`, `onToggleCollapse`, `onRequestMeasure`), `editorElement`, `setIconFn`, `timerService`, `registerDomEvent`
     - `HeaderControlsController`: public interface for managing collapse, playback, indicator, disabled states, and disposal.
   - **Lookup Dictionaries ({value}By{key})** (lines 112-170):
     - `caretSymbolByCollapseState`: `collapsed: '▸'`, `expanded: '▾'`
     - `caretAriaLabelByCollapseState`: `collapsed: 'Expand code'`, `expanded: 'Collapse code'`
     - `caretAriaExpandedByCollapseState`: `collapsed: 'false'`, `expanded: 'true'`
     - `iconNameByPlaybackState`: `run: 'play'`, `pause: 'pause'`
     - `labelByPlaybackState`: `run: 'Run'`, `pause: 'Pause'`
     - `ariaLabelByPlaybackState`: `run: 'Run animation'`, `pause: 'Pause animation'`
     - `labelByIndicatorStatus`: `hidden: ''`, `running: 'Running...'`, `paused: 'Paused'`, `saving: 'Saving...'`, `saved: 'Saved'`
     - `playbackStateByExecutionState`: maps all 8 `ExecutionState` variants to `'run' | 'pause'`
     - `indicatorStatusByExecutionState`: maps all 8 `ExecutionState` variants to `IndicatorStatus`
   - **Pure Leaf Functions** (lines 180-223):
     - `resolveCollapseState`, `resolveOppositeCollapseState`, `resolvePlaybackButtonState`, `resolveIndicatorStatusFromExecution`, `isCaretToggleKey`, `isButtonClickTarget`
   - **Boundary DOM Procedures & Builders** (lines 232-395):
     - `safeSetIcon`, `applyCaretState`, `applyEditorVisibility`, `applyPlaybackButtonState`, `applyIndicatorStatus`
     - `createChildDiv`, `createChildSpan`, `createChildButton`, `buildHeaderControlsElements`
   - **Controller Implementation** (lines 401-664):
     - `HeaderControlsControllerImpl`: encapsulates collapse state, execution state, indicator status, 1000ms auto-hide timer for 'Saved' with execution reversion, event listeners (caret click, Enter/Space keydown, header background click, button clicks with event stopping), and clean lifecycle teardown.

3. **Target Plugin Stylesheet (`styles.css`)**:
   Located at `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\styles.css`:
   - Lines 19-30: `.wanim-header, .wanim-block-header` (`display: flex; gap: 8px; cursor: pointer; user-select: none;`)
   - Lines 32-51: `.wanim-collapse-caret` (`width: 24px; height: 24px; font-size: 20px; cursor: pointer;`), `:hover`, `:focus-visible`
   - Lines 53-58: `.wanim-controls, .wanim-block-controls` (`display: flex; gap: 6px;`)
   - Lines 60-65: `.wanim-save-state` (`order: 3; font-size: 11px; color: var(--text-muted); padding: 0 4px;`)
   - Lines 67-85: `.wanim-control-button` (`border-radius: 6px; padding: 2px 12px; cursor: pointer;`), `:hover:not(:disabled)`, `:disabled`
   - Lines 87-115: `.wanim-run-button` (`order: 1; display: inline-flex; gap: 6px; font-weight: 600;`), `.wanim-run-button .svg-icon`, `.wanim-button-icon .svg-icon` (`width: 14px; height: 14px;`), `.wanim-run-label` (`line-height: 1;`)
   - Lines 117-134: `.wanim-restart-button` (`order: 2; display: inline-flex; padding: 2px 7px;`), `.wanim-restart-button .svg-icon` (`width: 14px; height: 14px;`)
   - Lines 137-189: `.wanim-code-editor` and CM6 scroller styles.

4. **Reference Plugin Comparison (`obsidian-manim-plugin`)**:
   - `codeBlockProcessor.ts` (lines 33-55, 74-108, 146-297):
     - Caret toggles `manim-code-editor` display (`collapsed ? 'none' : 'block'`), text content `'▸' : '▾'`, calls `editorChild.requestMeasure()` on expand.
     - Header click toggles collapse if target is not inside `.manim-control-button`.
     - Run/Pause button swaps icon between `'play'` and `'pause'`, swaps label between `'Run'` and `'Pause'`.
     - Restart button resets animation from beginning with icon `'rotate-ccw'`.
     - Save status indicator is shared between `saveState` ("Saving...", "Saved") and scene runner ("Running...", "Paused").
     - **Defect in Reference Plugin**: In the reference plugin (`editorChild.ts:219-222`), when auto-save persisted code during an active animation, the 1000ms hide timer cleared `saveState` text unconditionally (`setSaveState('')`), erroneously wiping out the "Running..." status while the scene was still actively rendering.

5. **Existing Target Module Interfaces**:
   - `src/types.ts`: `ExecutionState = 'idle' | 'running' | 'playing' | 'paused' | 'finished' | 'aborted' | 'error' | 'disposed'`.
   - `src/editor/editorChild.ts`: `WanimCodeEditorChild.requestMeasure(): void` (line 299).
   - `src/engine/wanimBridge.ts`: `WanimExecutionController` exposing `play()`, `pause()`, `resume()`, `restart()`, `stop()`, `dispose()`, `getState()`.

---

## 2. Logic Chain

### Step 2.1: Run/Pause Toggle Button Verification
- **Observation**: `proposed_headerControls.ts` implements `resolvePlaybackButtonState` (line 196) and `applyPlaybackButtonState` (line 276) using `iconNameByPlaybackState` and `labelByPlaybackState`.
- **Reasoning**:
  1. When execution state is `'running'` or `'playing'`, button state resolves to `'pause'`. The icon is set to `'pause'` and label is set to `'Pause'` with `aria-label="Pause animation"`.
  2. When execution state is `'idle'`, `'paused'`, `'finished'`, `'aborted'`, `'error'`, or `'disposed'`, button state resolves to `'run'`. The icon is set to `'play'` and label is set to `'Run'` with `aria-label="Run animation"`.
  3. Clicking the button (`handleRunPauseClick`, line 537) routes action according to current execution state:
     - If `'running'` or `'playing'`: triggers `options.onPause()`.
     - If `'paused'`: triggers `options.onResume()`.
     - Otherwise: triggers `options.onPlay()`.
  4. If button has `disabled = true`, the click is ignored. Both `preventDefault()` and `stopPropagation()` are called, preventing event bubbling to the collapse header.
- **Verification**: Exactly matches R3 specification and reference plugin functionality while decoupling UI presentation from engine internals via honest callback injection.

### Step 2.2: Restart Button Verification
- **Observation**: `proposed_headerControls.ts` builds `restartButtonEl` with icon `'rotate-ccw'`, `aria-label="Restart animation"`, and `title="Restart animation"` (lines 374-379).
- **Reasoning**:
  1. Clicking `restartButtonEl` (`handleRestartClick`, line 552) checks `disabled` status, stops propagation, and triggers `options.onRestart()`.
  2. In the orchestrator, `options.onRestart` invokes `WanimExecutionController.restart()`, which cancels the active scheduler, aborts current Python execution, clears the HTML5 canvas buffer, and restarts playback from frame 0.
- **Verification**: Fully meets R3 requirements and integrates cleanly with Milestone 3 engine bridge.

### Step 2.3: Collapse Caret ('▾' / '▸') & Editor Toggling Verification
- **Observation**: `applyCaretState` (line 252) updates caret symbol, `aria-label`, and `aria-expanded`. `applyEditorVisibility` (line 262) sets `editorEl.style.display`. `updateCollapseState` (line 443) invokes `onRequestMeasure()` on expansion.
- **Reasoning**:
  1. Caret symbol is `'▾'` when expanded and `'▸'` when collapsed.
  2. When collapsed, `editorEl.style.display` is `'none'`; when expanded, it is `'block'`.
  3. Because CodeMirror 6 scroller cannot measure layout while hidden (`display: none`), expanding the block must recalculate viewport geometry. Invoking `options.onRequestMeasure?.()` on transition to `'expanded'` calls `WanimCodeEditorChild.requestMeasure()`, ensuring correct line wrapping, cursor positioning, and scrollbar visibility.
  4. User interactions are comprehensively covered:
     - Direct click on `.wanim-collapse-caret`.
     - Keyboard activation on `.wanim-collapse-caret`: `Enter` and `Space` (`' '`) trigger `toggleCollapse()`, with `preventDefault()` preventing default page scroll on Space.
     - Header bar click delegation: clicking `.wanim-block-header` triggers `toggleCollapse()`, guarded by `isButtonClickTarget(target)` so clicks on Run, Restart, or child elements do not trigger collapse.
  5. State change notifies `options.onToggleCollapse?.(isCollapsed)` so that `WanimBlockState` can be persisted across Obsidian render passes.
- **Verification**: Fully complies with R2, R3, Survey 1, and Survey 3 findings.

### Step 2.4: Save Status Indicator (`.wanim-save-state`) Multi-State Coordination
- **Observation**: `proposed_headerControls.ts` introduces `IndicatorStatus = 'hidden' | 'running' | 'paused' | 'saving' | 'saved'`, `scheduleSavedHideTimer()` (line 515), and conditional indicator sync in `setExecutionState` (line 478).
- **Reasoning**:
  1. The indicator serves two callers:
     - The Execution Controller: displays `"Running..."` or `"Paused"`.
     - The Persistence System (Milestone 5): displays `"Saving..."` during vault disk write, and `"Saved"` on completion.
  2. In the reference plugin, auto-save clearing (`setSaveState('')`) would clobber `"Running..."` while the animation was playing.
  3. `proposed_headerControls.ts` resolves this contention elegantly:
     - While indicator is `'saving'` or `'saved'`, engine state changes do not overwrite the save message.
     - When `'saved'` is shown, a 1000ms timer is started via `timerService.setTimeout`.
     - When the 1000ms timer expires, it checks `this.executionState` via `resolveIndicatorStatusFromExecution(this.executionState)`. If the scene is still running, it reverts to `"Running..."`; if paused, to `"Paused"`; if idle/finished, it hides (`display: none`).
     - Calling `setIndicatorStatus` or `dispose` clears the active timer (`clearHideTimer`), preventing timer leaks.
- **Verification**: Solves the reference plugin's state contention bug and provides a seamless bridge to Milestone 5 source persistence.

### Step 2.5: Compliance with Code Generation Guidelines (R5)
- **Observation**:
  - **Honest Leaf Functions**: All decision-making helpers (`resolveCollapseState`, `resolveOppositeCollapseState`, `resolvePlaybackButtonState`, `resolveIndicatorStatusFromExecution`, `isCaretToggleKey`, `isButtonClickTarget`) depend strictly on their arguments, have no side effects, and do not mutate state.
  - **Pushing Side Effects to Boundaries**: DOM mutations are isolated to `applyCaretState`, `applyEditorVisibility`, `applyPlaybackButtonState`, `applyIndicatorStatus`, and `buildHeaderControlsElements`. Timer scheduling is isolated behind `TimerService`.
  - **Explicit Dependency Injection**: `timerService`, `setIconFn`, and `registerDomEvent` are injected via `HeaderControlsOptions`, enabling 100% deterministic, clock-controlled unit testing without browser dependencies.
  - **Single Level of Abstraction ("Stacking Bricks")**: Controller methods read like high-level orchestrators composed of discrete helper bricks.
  - **Invariant-Rich Types**: Union types (`CollapseState`, `PlaybackButtonState`, `IndicatorStatus`) prevent boolean parameter soup and enforce valid domain states at compile time.
  - **Lookup Table Naming**: All 9 lookup dictionaries strictly adhere to `{value}By{key}` naming.
- **Verification**: 100% compliant with the user's architectural rules.

### Step 2.6: Strictness Optimization (`noUncheckedIndexedAccess`)
- **Observation**: Target `tsconfig.json` enforces `"noUncheckedIndexedAccess": true`.
- **Reasoning**:
  In `proposed_headerControls.ts`:
  - `applyCaretState`: `caretAriaLabelByCollapseState[state]` and `caretAriaExpandedByCollapseState[state]` are inferred as `string | undefined`. Passing them to `setAttribute(name: string, value: string)` without nullish coalescing (`??`) can produce TS2345 errors.
  - `applyPlaybackButtonState`: `iconNameByPlaybackState[state]`, `labelByPlaybackState[state]`, `ariaLabelByPlaybackState[state]` benefit from explicit fallbacks (`?? 'play'`, `?? 'Run'`, `?? 'Run animation'`).
  - `applyIndicatorStatus`: `labelByIndicatorStatus[status] ?? ''` guarantees safe string assignment.
- **Action**: Add explicit nullish coalescing to all dictionary indexing expressions in the final concrete design specification.

### Step 2.7: CSS Stylesheet Compatibility
- **Observation**: `styles.css` was analyzed across all classes used in `proposed_headerControls.ts`.
- **Reasoning**:
  - `.wanim-block-header`, `.wanim-header` -> matched (lines 19-30)
  - `.wanim-collapse-caret`, `:hover`, `:focus-visible` -> matched (lines 32-51)
  - `.wanim-block-controls`, `.wanim-controls` -> matched (lines 53-58)
  - `.wanim-save-state` -> matched (lines 60-65)
  - `.wanim-control-button`, `:hover:not(:disabled)`, `:disabled` -> matched (lines 67-85)
  - `.wanim-run-button`, `.wanim-button-icon`, `.wanim-run-label` -> matched (lines 87-115)
  - `.wanim-restart-button`, `.wanim-restart-button .svg-icon` -> matched (lines 117-134)
  - Flexbox ordering (`order: 1` for Run button, `order: 2` for Restart button, `order: 3` for Save State) and DOM hierarchy align seamlessly.
- **Verification**: Zero CSS modifications required; `styles.css` is already 100% compatible.

---

## 3. Caveats

1. **Scope Boundary**:
   This review and design specification covers `src/ui/headerControls.ts`. The orchestrator (`src/ui/codeBlockProcessor.ts`) and error panel (`src/ui/errorPanel.ts`) remain to be implemented in Milestone 4.
2. **Obsidian Runtime vs Headless Mocking**:
   In live Obsidian, `setIcon` inserts SVG icons from the Lucide set (`play`, `pause`, `rotate-ccw`). In headless Node.js test environments, `setIcon` is unavailable or throws; `safeSetIcon` falls back to setting `data-icon` attribute, allowing tests to run without crashing.
3. **Measurement Invalidation**:
   `requestMeasure()` requires that the CodeMirror 6 DOM is attached to a rendered document to produce non-zero layout metrics. In headless unit tests, `requestMeasure()` is safely verified as a called spy.

---

## 4. Conclusion & Concrete Design Specification

### Conclusion
Predecessor's proposed implementation (`proposed_headerControls.ts`) is architecturally sound, thoroughly decomposed into honest leaf functions and boundary procedures, and provides superior state coordination over the reference plugin. With the addition of nullish coalescing guards for `"noUncheckedIndexedAccess": true` and desktop title tooltips, it is ready for immediate placement at `src/ui/headerControls.ts`.

### Concrete Design Specification for `src/ui/headerControls.ts`

```ts
/**
 * Header Controls Component for Obsidian Wanim Plugin (Milestone 4).
 * Manages header DOM buttons, collapse caret, playback state, and status indicators.
 *
 * Adheres strictly to Code Generation Guidelines (R5):
 * 1. Local Reasoning & Honest Functions:
 *    - Pure leaf functions and immutable lookup tables at leaves.
 *    - Push DOM side-effects and timers to boundary procedures.
 *    - Explicit dependency injection (timerService, setIconFn, registerDomEvent).
 * 2. Single Uniform Level of Abstraction ("Stacking Bricks"):
 *    - High-level orchestrators read like a table of contents.
 *    - Discrete helper bricks for DOM creation, state rendering, and event binding.
 * 3. Invariant-Rich Signatures:
 *    - Explicit union types (CollapseState, PlaybackButtonState, IndicatorStatus).
 *    - No mystery boolean flags.
 * 4. Dictionary Naming:
 *    - All lookup tables follow {value}By{key} naming convention.
 */

import { setIcon } from 'obsidian';
import { ExecutionState } from '../types';

// ============================================================================
// Domain Invariants & Union Types
// ============================================================================

export type CollapseState = 'collapsed' | 'expanded';

export type PlaybackButtonState = 'run' | 'pause';

export type IndicatorStatus = 'hidden' | 'running' | 'paused' | 'saving' | 'saved';

export type SetIconFunction = (parent: HTMLElement, iconId: string) => void;

export interface TimerService {
	setTimeout(callback: () => void, ms: number): number;
	clearTimeout(id: number): void;
}

export const defaultTimerService: TimerService = {
	setTimeout: (callback: () => void, ms: number): number => {
		return window.setTimeout(callback, ms) as unknown as number;
	},
	clearTimeout: (id: number): void => {
		window.clearTimeout(id);
	},
};

// ============================================================================
// DOM Elements Interface
// ============================================================================

export interface HeaderControlsElements {
	readonly headerEl: HTMLElement;
	readonly caretEl: HTMLElement;
	readonly controlsEl: HTMLElement;
	readonly runButtonEl: HTMLButtonElement;
	readonly runIconEl: HTMLElement;
	readonly runLabelEl: HTMLElement;
	readonly restartButtonEl: HTMLButtonElement;
	readonly saveStateEl: HTMLElement;
}

// ============================================================================
// Header Controls Options Interface
// ============================================================================

export interface HeaderControlsOptions {
	readonly isInitiallyCollapsed?: boolean;
	readonly editorElement?: HTMLElement | null;
	readonly onToggleCollapse?: (isCollapsed: boolean) => void;
	readonly onRequestMeasure?: () => void;
	readonly onPlay: () => Promise<void> | void;
	readonly onPause: () => void;
	readonly onResume: () => void;
	readonly onRestart: () => Promise<void> | void;
	readonly setIconFn?: SetIconFunction;
	readonly timerService?: TimerService;
	readonly registerDomEvent?: (
		element: HTMLElement | Window | Document,
		type: string,
		callback: (event: unknown) => void
	) => void;
}

// ============================================================================
// Header Controls Controller Interface
// ============================================================================

export interface HeaderControlsController {
	readonly elements: HeaderControlsElements;
	isCollapsed(): boolean;
	setCollapsed(collapsed: boolean): void;
	toggleCollapse(): void;
	setEditorElement(editorEl: HTMLElement | null): void;
	getExecutionState(): ExecutionState;
	setExecutionState(state: ExecutionState): void;
	getIndicatorStatus(): IndicatorStatus;
	setIndicatorStatus(status: IndicatorStatus): void;
	showSaving(): void;
	showSaved(): void;
	setRunButtonDisabled(disabled: boolean): void;
	setRestartButtonDisabled(disabled: boolean): void;
	handleRunPauseClick(): void;
	handleRestartClick(): void;
	dispose(): void;
}

// ============================================================================
// Pure / Honest Lookup Tables ({value}By{key})
// ============================================================================

export const caretSymbolByCollapseState: Readonly<Record<CollapseState, string>> = Object.freeze({
	collapsed: '▸',
	expanded: '▾',
});

export const caretAriaLabelByCollapseState: Readonly<Record<CollapseState, string>> = Object.freeze({
	collapsed: 'Expand code',
	expanded: 'Collapse code',
});

export const caretAriaExpandedByCollapseState: Readonly<Record<CollapseState, string>> = Object.freeze({
	collapsed: 'false',
	expanded: 'true',
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

export const playbackStateByExecutionState: Readonly<Record<ExecutionState, PlaybackButtonState>> = Object.freeze({
	idle: 'run',
	running: 'pause',
	playing: 'pause',
	paused: 'run',
	finished: 'run',
	aborted: 'run',
	error: 'run',
	disposed: 'run',
});

export const indicatorStatusByExecutionState: Readonly<Record<ExecutionState, IndicatorStatus>> = Object.freeze({
	idle: 'hidden',
	running: 'running',
	playing: 'running',
	paused: 'paused',
	finished: 'hidden',
	aborted: 'hidden',
	error: 'hidden',
	disposed: 'hidden',
});

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Converts a boolean collapsed flag into an explicit CollapseState union.
 * Pure leaf function.
 */
export function resolveCollapseState(isCollapsed: boolean): CollapseState {
	return isCollapsed ? 'collapsed' : 'expanded';
}

/**
 * Returns the opposite collapse state.
 * Pure leaf function.
 */
export function resolveOppositeCollapseState(state: CollapseState): CollapseState {
	return state === 'collapsed' ? 'expanded' : 'collapsed';
}

/**
 * Resolves the PlaybackButtonState ('run' | 'pause') for a given ExecutionState.
 * Pure leaf function using dictionary lookup.
 */
export function resolvePlaybackButtonState(executionState: ExecutionState): PlaybackButtonState {
	return playbackStateByExecutionState[executionState] ?? 'run';
}

/**
 * Resolves the default IndicatorStatus for an engine ExecutionState.
 * Pure leaf function using dictionary lookup.
 */
export function resolveIndicatorStatusFromExecution(executionState: ExecutionState): IndicatorStatus {
	return indicatorStatusByExecutionState[executionState] ?? 'hidden';
}

/**
 * Tests whether a keyboard event key triggers the collapse caret ('Enter' or ' ').
 * Pure leaf function.
 */
export function isCaretToggleKey(key: string): boolean {
	return key === 'Enter' || key === ' ';
}

/**
 * Determines whether a mouse event target is inside a header control button.
 * Pure leaf function.
 */
export function isButtonClickTarget(target: HTMLElement | null): boolean {
	return Boolean(target?.closest('.wanim-control-button'));
}

// ============================================================================
// Boundary DOM Rendering Procedures
// ============================================================================

/**
 * Safely sets an Obsidian icon onto a DOM container, falling back to data-icon in headless environments.
 * Boundary DOM mutation.
 */
export function safeSetIcon(
	targetEl: HTMLElement,
	iconId: string,
	setIconFn: SetIconFunction = setIcon
): void {
	try {
		if (typeof setIconFn === 'function') {
			setIconFn(targetEl, iconId);
		} else {
			targetEl.setAttribute('data-icon', iconId);
		}
	} catch {
		targetEl.setAttribute('data-icon', iconId);
	}
}

/**
 * Renders caret text and ARIA attributes for a given CollapseState.
 * Boundary DOM mutation with noUncheckedIndexedAccess nullish coalescing guards.
 */
export function applyCaretState(caretEl: HTMLElement, state: CollapseState): void {
	caretEl.textContent = caretSymbolByCollapseState[state] ?? '▾';
	caretEl.setAttribute('aria-label', caretAriaLabelByCollapseState[state] ?? 'Toggle code');
	caretEl.setAttribute('aria-expanded', caretAriaExpandedByCollapseState[state] ?? 'false');
}

/**
 * Updates the code editor container display property based on CollapseState.
 * Boundary DOM mutation.
 */
export function applyEditorVisibility(
	editorEl: HTMLElement | null | undefined,
	state: CollapseState
): void {
	if (!editorEl) {
		return;
	}
	editorEl.style.display = state === 'collapsed' ? 'none' : 'block';
}

/**
 * Renders Run/Pause button icon, text label, title, and accessibility attribute.
 * Boundary DOM mutation with noUncheckedIndexedAccess nullish coalescing guards.
 */
export function applyPlaybackButtonState(
	btnEl: HTMLButtonElement,
	iconEl: HTMLElement,
	labelEl: HTMLElement,
	state: PlaybackButtonState,
	setIconFn?: SetIconFunction
): void {
	const iconId = iconNameByPlaybackState[state] ?? 'play';
	const labelText = labelByPlaybackState[state] ?? 'Run';
	const ariaLabelText = ariaLabelByPlaybackState[state] ?? 'Run animation';

	safeSetIcon(iconEl, iconId, setIconFn);
	labelEl.textContent = labelText;
	btnEl.setAttribute('aria-label', ariaLabelText);
	btnEl.setAttribute('title', ariaLabelText);
}

/**
 * Renders status indicator text and visibility.
 * Boundary DOM mutation with noUncheckedIndexedAccess nullish coalescing guards.
 */
export function applyIndicatorStatus(indicatorEl: HTMLElement, status: IndicatorStatus): void {
	const text = labelByIndicatorStatus[status] ?? '';
	const isVisible = status !== 'hidden' && Boolean(text);

	indicatorEl.textContent = text;
	indicatorEl.style.display = isVisible ? 'inline-block' : 'none';
}

// ============================================================================
// DOM Construction Helpers (Stacking Bricks)
// ============================================================================

interface ObsidianElementPolyfill {
	createDiv?(options?: { cls?: string }): HTMLDivElement;
	createSpan?(options?: { cls?: string; text?: string }): HTMLSpanElement;
	createEl?(tag: string, options?: { cls?: string }): HTMLElement;
}

function createChildDiv(parent: HTMLElement, cls: string): HTMLDivElement {
	const polyfilled = parent as unknown as ObsidianElementPolyfill;
	if (typeof polyfilled.createDiv === 'function') {
		return polyfilled.createDiv({ cls });
	}
	const div = parent.ownerDocument.createElement('div');
	div.className = cls;
	parent.appendChild(div);
	return div;
}

function createChildSpan(parent: HTMLElement, cls: string, text?: string): HTMLSpanElement {
	const polyfilled = parent as unknown as ObsidianElementPolyfill;
	if (typeof polyfilled.createSpan === 'function') {
		return polyfilled.createSpan({ cls, text });
	}
	const span = parent.ownerDocument.createElement('span');
	span.className = cls;
	if (text !== undefined) {
		span.textContent = text;
	}
	parent.appendChild(span);
	return span;
}

function createChildButton(parent: HTMLElement, cls: string): HTMLButtonElement {
	const polyfilled = parent as unknown as ObsidianElementPolyfill;
	if (typeof polyfilled.createEl === 'function') {
		return polyfilled.createEl('button', { cls }) as HTMLButtonElement;
	}
	const btn = parent.ownerDocument.createElement('button');
	btn.type = 'button';
	btn.className = cls;
	parent.appendChild(btn);
	return btn;
}

/**
 * Assembles the full header controls DOM subtree under the parent container.
 * Boundary DOM builder following Stacking Bricks decomposition.
 */
export function buildHeaderControlsElements(
	parent: HTMLElement,
	setIconFn?: SetIconFunction
): HeaderControlsElements {
	const headerEl = createChildDiv(parent, 'wanim-block-header wanim-header');

	const caretEl = createChildSpan(headerEl, 'wanim-collapse-caret', '▾');
	caretEl.setAttribute('role', 'button');
	caretEl.setAttribute('tabindex', '0');

	const controlsEl = createChildDiv(headerEl, 'wanim-block-controls wanim-controls');

	const runButtonEl = createChildButton(controlsEl, 'wanim-control-button wanim-run-button');
	runButtonEl.type = 'button';
	const runIconEl = createChildSpan(runButtonEl, 'wanim-button-icon');
	safeSetIcon(runIconEl, 'play', setIconFn);
	const runLabelEl = createChildSpan(runButtonEl, 'wanim-run-label', 'Run');
	runButtonEl.setAttribute('aria-label', 'Run animation');
	runButtonEl.setAttribute('title', 'Run animation');

	const restartButtonEl = createChildButton(controlsEl, 'wanim-control-button wanim-restart-button');
	restartButtonEl.type = 'button';
	safeSetIcon(restartButtonEl, 'rotate-ccw', setIconFn);
	restartButtonEl.setAttribute('aria-label', 'Restart animation');
	restartButtonEl.setAttribute('title', 'Restart animation');

	const saveStateEl = createChildSpan(controlsEl, 'wanim-save-state');
	saveStateEl.setAttribute('role', 'status');
	saveStateEl.setAttribute('aria-live', 'polite');
	saveStateEl.style.display = 'none';

	return {
		headerEl,
		caretEl,
		controlsEl,
		runButtonEl,
		runIconEl,
		runLabelEl,
		restartButtonEl,
		saveStateEl,
	};
}

// ============================================================================
// HeaderControlsController Implementation (Discrete Orchestration Bricks)
// ============================================================================

export class HeaderControlsControllerImpl implements HeaderControlsController {
	public readonly elements: HeaderControlsElements;
	private collapseState: CollapseState;
	private executionState: ExecutionState = 'idle';
	private indicatorStatus: IndicatorStatus = 'hidden';
	private activeHideTimerId: number | null = null;
	private boundEditorElement: HTMLElement | null = null;
	private readonly timerService: TimerService;
	private readonly eventCleanups: Array<() => void> = [];

	constructor(
		container: HTMLElement,
		private readonly options: HeaderControlsOptions
	) {
		this.timerService = options.timerService ?? defaultTimerService;
		this.boundEditorElement = options.editorElement ?? null;
		this.collapseState = resolveCollapseState(options.isInitiallyCollapsed ?? false);
		this.elements = buildHeaderControlsElements(container, options.setIconFn);

		this.applyInitialState();
		this.attachEventListeners();
	}

	// ------------------------------------------------------------------------
	// Collapse / Caret State Management
	// ------------------------------------------------------------------------

	public isCollapsed(): boolean {
		return this.collapseState === 'collapsed';
	}

	public toggleCollapse(): void {
		const nextState = resolveOppositeCollapseState(this.collapseState);
		this.updateCollapseState(nextState);
	}

	public setCollapsed(collapsed: boolean): void {
		const nextState = resolveCollapseState(collapsed);
		if (this.collapseState === nextState) {
			return;
		}
		this.updateCollapseState(nextState);
	}

	public setEditorElement(editorEl: HTMLElement | null): void {
		this.boundEditorElement = editorEl;
		applyEditorVisibility(this.boundEditorElement, this.collapseState);
	}

	private updateCollapseState(nextState: CollapseState): void {
		this.collapseState = nextState;
		applyCaretState(this.elements.caretEl, nextState);
		applyEditorVisibility(this.boundEditorElement, nextState);

		if (nextState === 'expanded') {
			this.options.onRequestMeasure?.();
		}

		this.options.onToggleCollapse?.(nextState === 'collapsed');
	}

	// ------------------------------------------------------------------------
	// Execution & Playback State Management
	// ------------------------------------------------------------------------

	public getExecutionState(): ExecutionState {
		return this.executionState;
	}

	public setExecutionState(state: ExecutionState): void {
		if (this.executionState === state) {
			return;
		}
		this.executionState = state;

		const buttonState = resolvePlaybackButtonState(state);
		applyPlaybackButtonState(
			this.elements.runButtonEl,
			this.elements.runIconEl,
			this.elements.runLabelEl,
			buttonState,
			this.options.setIconFn
		);

		// Synchronize indicator with execution state unless holding an active save status
		if (this.indicatorStatus !== 'saving' && this.indicatorStatus !== 'saved') {
			const nextStatus = resolveIndicatorStatusFromExecution(state);
			this.indicatorStatus = nextStatus;
			applyIndicatorStatus(this.elements.saveStateEl, nextStatus);
		}
	}

	// ------------------------------------------------------------------------
	// Indicator & Save Status Management
	// ------------------------------------------------------------------------

	public getIndicatorStatus(): IndicatorStatus {
		return this.indicatorStatus;
	}

	public setIndicatorStatus(status: IndicatorStatus): void {
		this.clearHideTimer();
		this.indicatorStatus = status;

		if (status === 'saved') {
			applyIndicatorStatus(this.elements.saveStateEl, 'saved');
			this.scheduleSavedHideTimer();
			return;
		}

		applyIndicatorStatus(this.elements.saveStateEl, status);
	}

	public showSaving(): void {
		this.setIndicatorStatus('saving');
	}

	public showSaved(): void {
		this.setIndicatorStatus('saved');
	}

	private scheduleSavedHideTimer(): void {
		this.activeHideTimerId = this.timerService.setTimeout(() => {
			this.activeHideTimerId = null;
			if (this.indicatorStatus === 'saved') {
				const revertStatus = resolveIndicatorStatusFromExecution(this.executionState);
				this.indicatorStatus = revertStatus;
				applyIndicatorStatus(this.elements.saveStateEl, revertStatus);
			}
		}, 1000);
	}

	private clearHideTimer(): void {
		if (this.activeHideTimerId !== null) {
			this.timerService.clearTimeout(this.activeHideTimerId);
			this.activeHideTimerId = null;
		}
	}

	// ------------------------------------------------------------------------
	// Button Action Handlers & Disabled State
	// ------------------------------------------------------------------------

	public handleRunPauseClick(): void {
		if (this.elements.runButtonEl.disabled) {
			return;
		}

		const state = this.executionState;
		if (state === 'running' || state === 'playing') {
			this.options.onPause();
		} else if (state === 'paused') {
			this.options.onResume();
		} else {
			void this.options.onPlay();
		}
	}

	public handleRestartClick(): void {
		if (this.elements.restartButtonEl.disabled) {
			return;
		}
		void this.options.onRestart();
	}

	public setRunButtonDisabled(disabled: boolean): void {
		this.elements.runButtonEl.disabled = disabled;
	}

	public setRestartButtonDisabled(disabled: boolean): void {
		this.elements.restartButtonEl.disabled = disabled;
	}

	// ------------------------------------------------------------------------
	// Discrete Initialization & Event Binding Bricks
	// ------------------------------------------------------------------------

	private applyInitialState(): void {
		applyCaretState(this.elements.caretEl, this.collapseState);
		applyEditorVisibility(this.boundEditorElement, this.collapseState);

		const buttonState = resolvePlaybackButtonState(this.executionState);
		applyPlaybackButtonState(
			this.elements.runButtonEl,
			this.elements.runIconEl,
			this.elements.runLabelEl,
			buttonState,
			this.options.setIconFn
		);

		applyIndicatorStatus(this.elements.saveStateEl, this.indicatorStatus);
	}

	private attachEventListeners(): void {
		const addListener = (
			element: HTMLElement,
			type: string,
			handler: (event: unknown) => void
		) => {
			if (typeof this.options.registerDomEvent === 'function') {
				this.options.registerDomEvent(element, type, handler);
			} else {
				element.addEventListener(type, handler as EventListener);
				this.eventCleanups.push(() => {
					element.removeEventListener(type, handler as EventListener);
				});
			}
		};

		// 1. Caret Click Trigger
		addListener(this.elements.caretEl, 'click', (event: unknown) => {
			const mouseEvent = event as MouseEvent;
			mouseEvent.preventDefault?.();
			mouseEvent.stopPropagation?.();
			this.toggleCollapse();
		});

		// 2. Caret Keyboard Trigger (Enter or Space)
		addListener(this.elements.caretEl, 'keydown', (event: unknown) => {
			const keyEvent = event as KeyboardEvent;
			if (!isCaretToggleKey(keyEvent.key)) {
				return;
			}
			keyEvent.preventDefault?.();
			keyEvent.stopPropagation?.();
			this.toggleCollapse();
		});

		// 3. Header Background Click Trigger (outside control buttons)
		addListener(this.elements.headerEl, 'click', (event: unknown) => {
			const mouseEvent = event as MouseEvent;
			const target = mouseEvent.target as HTMLElement | null;
			if (isButtonClickTarget(target)) {
				return;
			}
			this.toggleCollapse();
		});

		// 4. Run / Pause Button Click Trigger
		addListener(this.elements.runButtonEl, 'click', (event: unknown) => {
			const mouseEvent = event as MouseEvent;
			mouseEvent.preventDefault?.();
			mouseEvent.stopPropagation?.();
			this.handleRunPauseClick();
		});

		// 5. Restart Button Click Trigger
		addListener(this.elements.restartButtonEl, 'click', (event: unknown) => {
			const mouseEvent = event as MouseEvent;
			mouseEvent.preventDefault?.();
			mouseEvent.stopPropagation?.();
			this.handleRestartClick();
		});
	}

	// ------------------------------------------------------------------------
	// Teardown / Lifecycle Disposal
	// ------------------------------------------------------------------------

	public dispose(): void {
		this.clearHideTimer();
		for (const cleanup of this.eventCleanups) {
			try {
				cleanup();
			} catch {
				// Suppress cleanup exceptions during teardown
			}
		}
		this.eventCleanups.length = 0;
	}
}

// ============================================================================
// Public Factory Functions (Stacking Bricks)
// ============================================================================

/**
 * Creates and initializes a complete HeaderControlsController instance.
 * Stacking Bricks entry point.
 */
export function createHeaderControls(
	container: HTMLElement,
	options: HeaderControlsOptions
): HeaderControlsController {
	return new HeaderControlsControllerImpl(container, options);
}

/**
 * Convenience alias matching build* convention.
 */
export const buildHeaderControls = createHeaderControls;
```

---

## 5. Verification Method

### 5.1 Automated Typecheck & Build Verification
To independently verify that the code compiles cleanly under Obsidian Wanim Plugin's strict TypeScript settings:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
npm run build
```
**Expected Result**: Exit code 0, zero diagnostic errors or warnings from `tsc -noEmit -skipLibCheck`, and successful bundling of `main.js`.

### 5.2 Unit Test Verification Plan
An automated test runner should verify each of the following test suites using a mock DOM environment:

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| **C1. Initial Rendering** | Mount with `isInitiallyCollapsed: false` | Caret is `'▾'`, `aria-expanded="true"`, Run button shows icon `'play'` & label `'Run'`, Restart button shows `'rotate-ccw'`, save state is hidden (`display: none`). |
| **C2. Initial Collapsed** | Mount with `isInitiallyCollapsed: true` | Caret is `'▸'`, `aria-expanded="false"`, `editorEl.style.display === 'none'`. |
| **C3. Caret Click** | Click `.wanim-collapse-caret` | Caret toggles between `'▾'` and `'▸'`, editor display toggles between `'block'` and `'none'`, `onToggleCollapse` callback fires with updated boolean. |
| **C4. Caret Keyboard Navigation** | Trigger `keydown` with `Enter` and `Space` | Caret toggles collapse state; non-toggle keys (e.g. `ArrowDown`, `Tab`) do nothing. |
| **C5. Header Delegation** | Click header background vs control button | Header background click toggles collapse; button click does NOT toggle collapse. |
| **C6. requestMeasure on Expand** | Expand previously collapsed editor | `options.onRequestMeasure()` is called exactly once. |
| **C7. Run/Pause Click Routing** | Click Run/Pause in `idle`, `running`, `paused` | In `idle` calls `onPlay()`; in `running` calls `onPause()`; in `paused` calls `onResume()`. |
| **C8. Restart Click Routing** | Click Restart button | Calls `onRestart()`, does not toggle collapse. |
| **C9. Disabled Button Handling** | Set `runButtonEl.disabled = true`, click | Neither `onPlay` nor `onPause` is invoked. |
| **C10. Indicator State Coordination** | Transition execution states | Shows `"Running..."` when running, `"Paused"` when paused, hidden when finished. |
| **C11. Save State Precedence & Reversion** | Call `showSaving()` then `showSaved()` while running | Displays `"Saving..."`, then `"Saved"`. After 1000ms timer fires via mock `timerService`, reverts back to `"Running..."`. |
| **C12. Teardown Cleanup** | Call `dispose()` while saved timer active | Clears active timer and event listeners without memory leaks. |

### 5.3 Invalidation Conditions
The conclusion is invalidated if:
1. `npm run build` fails with TypeScript errors on `src/ui/headerControls.ts`.
2. Any selector in `styles.css` fails to match the classes emitted by `buildHeaderControlsElements`.
3. Clicking `.wanim-control-button` triggers an accidental collapse toggle of the editor container.
4. Auto-save status transition corrupts the playback status during active scene execution.
