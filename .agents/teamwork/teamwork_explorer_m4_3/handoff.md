# Milestone 4 Exploration Report: Error Panel Design & DOM Interaction

**Agent**: teamwork_explorer_m4_3 (Exploration Agent, Milestone 4)  
**Parent Agent**: 20c2d47d-d294-467c-9e69-233a08f70b0d  
**State Folder**: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_3\`  
**Target Codebase**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`  
**Reference Directory**: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` (strictly untouched)

---

## 1. Observation

### 1.1 Existing CSS & Error Panel Styles
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\styles.css` (lines 316–333):
```css
/* ==========================================================================
   Red Error Panel
   ========================================================================== */
.wanim-error-panel {
    margin-top: 8px;
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--color-red) 60%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-red) 8%, var(--background-primary));
    color: var(--text-error, var(--color-red));
    font-family: var(--font-monospace);
    font-size: var(--code-size, 0.9em);
    line-height: 1.45;
    white-space: pre-wrap;
    overflow: auto;
    max-height: 220px;
    display: none;
}
```
Direct observations:
- Red border: `border: 1px solid color-mix(in srgb, var(--color-red) 60%, transparent);`
- Translucent red background: `background: color-mix(in srgb, var(--color-red) 8%, var(--background-primary));`
- Monospace font: `font-family: var(--font-monospace);`
- Wrapping: `white-space: pre-wrap;`
- Constraint: `max-height: 220px; overflow: auto;`
- Initial visibility: `display: none;`

### 1.2 Error Formatter Engine Subsystem
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\engine\errorFormatter.ts`:
- Leaf functions available:
  - `cleanStackTrace(rawStack: string): string[]` (lines 58–92)
  - `sanitizeStackTrace(rawStack: string): string` (lines 98–100)
  - `buildSourceLineMap(source: string): SourceLineMap` (lines 142–183)
  - `formatCompileError(error: unknown, sourceCode: string): FormattedCompileError` (lines 280–338)
  - `formatUnsupportedImport(error: unknown): FormattedImportError | null` (lines 373–408)
  - `formatRuntimeError(error: unknown): FormattedRuntimeError` (lines 414–432)
  - `formatGenericError(error: unknown): FormattedGenericError` (lines 438–457)
  - `formatWanimError(error: unknown, sourceCode: string): WanimFormattedError` (lines 464–496)
- In `src/types.ts` (lines 112–154):
  - `WanimErrorKind = 'compile' | 'unsupported_import' | 'runtime' | 'unknown'`
  - All four variants of `WanimFormattedError` implement `readonly formattedText: string`.

### 1.3 Canvas Bridge Integration & Error Forwarding
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\engine\wanimBridge.ts`:
- In `WanimExecutionControllerImpl.executeRunLoop()` (lines 277–288):
  ```typescript
  } catch (error) {
      if (this.generation !== currentGen) {
          return;
      }
      if (this.abortController.signal.aborted) {
          this.transitionState('aborted');
      } else {
          this.transitionState('error');
          const formatted = formatWanimError(error, this.source);
          this.options.onError?.(formatted);
      }
  }
  ```
- `WanimRunOptions.onError?: (error: WanimFormattedError | string) => void` forwards formatted errors directly to code block orchestrators.

### 1.4 Reference Plugin UI & Notice Behavior
In `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\src\manim\codeBlockProcessor.ts`:
- Line 71–72:
  ```typescript
  const canvas = wrapper.createDiv({ cls: 'manim-canvas' });
  const errorPanel = wrapper.createEl('pre', { cls: 'manim-error-panel' });
  errorPanel.style.display = 'none';
  ```
- Lines 168–169 (before execution run):
  ```typescript
  errorPanel.style.display = 'none';
  errorPanel.textContent = '';
  ```
- Lines 237–242 (catch block on render failure):
  ```typescript
  const message = error instanceof Error ? error.message : String(error);
  saveState.textContent = '';
  saveState.style.display = 'none';
  errorPanel.textContent = formatRuntimeError(error);
  errorPanel.style.display = 'block';
  new Notice(`Manim render failed: ${message}`);
  ```

### 1.5 Headless Test Harness & Obsidian Mock
In `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\tests\run_tests.mjs` (lines 30–32):
```javascript
alias: {
    obsidian: path.resolve(__dirname, 'mocks', 'obsidian.ts'),
},
```
In `tests/mocks/obsidian.ts` (lines 1–50):
- Exports `Component`, `MarkdownRenderChild`, `Plugin`, `EventRef`, `MarkdownPostProcessorContext`.
- `Notice` is not yet exported in `tests/mocks/obsidian.ts`.

---

## 2. Logic Chain

1. **DOM Placement & Element Tagging (Objective 1)**:
   - *Observation*: `styles.css` defines `.wanim-error-panel` with monospace font, pre-wrap, and max-height 220px. The reference plugin creates `wrapper.createEl('pre', { cls: 'manim-error-panel' })` directly below the canvas.
   - *Deduction*: Placing `<pre class="wanim-error-panel">` immediately below the canvas container in `.wanim-block` maintains uniform document flow. Using `<pre>` natively preserves indentation and column carets (`^`) generated by `formatCompileError`.
   - *Refinement*: To prevent browser `<pre>` quirks (such as default bottom margins and content-box width blowout), `.wanim-error-panel` should also enforce `box-sizing: border-box; word-break: break-word; margin: 8px 0 0 0;`.
   - *Accessibility*: Adding `role="alert"`, `aria-live="assertive"`, and `aria-atomic="true"` ensures assistive technologies immediately announce execution errors.

2. **Controller Lifecycle & XSS Immunity (Objective 2)**:
   - *Observation*: Compilation and traceback errors frequently contain raw code snippets, HTML tags (e.g. `<anonymous>`, `<module>`), or user-defined variable names.
   - *Deduction*: Setting `element.textContent = errorText` in `showError()` and resetting `element.textContent = ''` in `clearError()` completely eliminates XSS vectors while rendering raw symbols verbatim.
   - *Visibility Toggle*: `showError()` sets `element.style.display = 'block'` and resets `element.scrollTop = 0` (so the user starts at the top of the error message/caret). `clearError()` resets `element.style.display = 'none'`.

3. **Notice Text Formatting vs. Panel Full Output (Objective 3)**:
   - *Observation*: Obsidian's transient `Notice` is a small floating toast (lasting ~5 seconds). Wanim error traces can span 20–60 lines with source pointers and stack frames. Dumping a 50-line trace into `Notice` breaks UI layout.
   - *Deduction*: Separation of concerns:
     1. The **Error Panel** renders the full formatted text (`formatted.formattedText`), including multi-line carets and stack traces.
     2. The **Obsidian Notice** displays a concise single-line summary with the required `"Wanim render failed: "` prefix.
   - *Pure Leaf Extraction*: An honest leaf function `extractNoticeErrorMessage(error)` parses `WanimFormattedError`, raw `Error`, or strings to produce clean, concise messages (e.g. `"SyntaxError: Unexpected token ':' (line 3)"`, `"Python module 'os' is unavailable in browser Manim"`, or `"NameError: name 'Circle' is not defined"`).

4. **Adherence to R5 Architectural Guidelines (Objective 4)**:
   - *Local Reasoning & Honest Functions*:
     - Pure leaves: `extractNoticeErrorMessage`, `formatRenderFailureNoticeMessage`, `createErrorPanelElement`, `setErrorPanelText`, `setErrorPanelVisibility`.
     - Push side effects to boundaries: `showRenderFailureNotice` wraps `Notice` creation; DOM mutations are isolated inside dedicated boundary functions.
     - Explicit Dependency Injection: `ErrorPanelDependencies` accepts optional `formatError` and `notify` functions, enabling 100% headless testability.
   - *One Level of Abstraction ("Stacking Bricks")*:
     - `handleRenderFailure(error, panel, sourceCode, notify)` acts as a clean orchestrator:
       1. Format error (`panel.displayError(error, sourceCode)`)
       2. Show notice (`showRenderFailureNotice(formatted, notify)`)
       3. Return formatted diagnostic.
   - *Empathetic & Invariant-Rich Signatures*:
     - Strongly typed interfaces: `WanimErrorPanelController`, `ErrorPanelState`, `ErrorPanelDependencies`, `NotifyFunction`.
     - Zero mystery boolean flags.

---

## 3. Caveats

1. **Obsidian Mock Extension for Tests**:
   - `tests/run_tests.mjs` aliases `obsidian` to `tests/mocks/obsidian.ts`.
   - `tests/mocks/obsidian.ts` currently lacks a `Notice` class. To prevent bundle or runtime test failures when testing `errorPanel.ts`, the implementer should add:
     ```typescript
     export class Notice {
         constructor(public message: string, public duration?: number) {}
     }
     ```
2. **Defensive Notice Calling in Headless Mode**:
   - `showRenderFailureNotice` must safely handle environments where `new Notice` might throw or be undefined, defaulting gracefully to injecting `notify?: NotifyFunction`.
3. **Execution Concurrency**:
   - When a user presses "Restart" or rapid "Run", `clearError()` must run before starting the new execution to prevent stale error panels from lingering while new scenes compile.

---

## 4. Conclusion & Concrete Design

### 4.1 Specification for `src/ui/errorPanel.ts`

The worker implementer should create `src/ui/errorPanel.ts` according to the following design:

```typescript
/**
 * Red Error Panel Controller for Obsidian Wanim Plugin.
 * Displays formatted compilation errors, unsupported import notices,
 * and runtime tracebacks directly below the canvas.
 *
 * Adheres strictly to Code Generation Guidelines (R5):
 * - Honest leaf functions for text and notice extraction
 * - Stacking Bricks orchestration for failure handling
 * - Invariant-rich types and explicit dependency injection
 */

import { Notice } from 'obsidian';
import { formatWanimError } from '../engine/errorFormatter';
import { WanimFormattedError } from '../types';

// ============================================================================
// Types & Domain Interfaces
// ============================================================================

export type NotifyFunction = (message: string, durationMs?: number) => void;

export interface ErrorPanelState {
	readonly isVisible: boolean;
	readonly errorText: string;
}

export interface ErrorPanelDependencies {
	readonly formatError?: (error: unknown, sourceCode?: string) => WanimFormattedError;
	readonly notify?: NotifyFunction;
}

export interface WanimErrorPanelController {
	readonly element: HTMLElement;
	showError(errorText: string): void;
	clearError(): void;
	displayError(error: unknown, sourceCode?: string): WanimFormattedError;
	getState(): ErrorPanelState;
	isVisible(): boolean;
	getErrorText(): string;
	dispose(): void;
}

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Extracts a concise, single-line summary from an error object suitable for
 * an Obsidian transient Notice popup.
 * Pure leaf function.
 */
export function extractNoticeErrorMessage(error: unknown): string {
	if (error === null || error === undefined) {
		return 'An unknown execution error occurred';
	}

	// 1. Structured Wanim formatted error
	if (typeof error === 'object' && error !== null && 'kind' in error) {
		const formatted = error as WanimFormattedError;
		switch (formatted.kind) {
			case 'compile': {
				const messageWithoutPrefix = formatted.message.replace(/^SyntaxError:\s*/, '');
				return `SyntaxError: ${messageWithoutPrefix} (line ${formatted.line})`;
			}
			case 'unsupported_import': {
				return `Python module '${formatted.module}' is unavailable in browser Manim`;
			}
			case 'runtime': {
				return `${formatted.name}: ${formatted.message}`;
			}
			case 'unknown': {
				return formatted.message || 'An unexpected execution error occurred';
			}
		}
	}

	// 2. Standard Error instance
	if (error instanceof Error) {
		const name = error.name || 'Error';
		const message = error.message || 'An unexpected error occurred';
		return `${name}: ${message}`;
	}

	// 3. String error
	if (typeof error === 'string') {
		const trimmed = error.trim();
		const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
		return firstLine || 'An error occurred';
	}

	// 4. Unknown object fallback
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

/**
 * Formats a standardized render failure notice message.
 * Pure leaf function.
 */
export function formatRenderFailureNoticeMessage(error: unknown): string {
	const summary = extractNoticeErrorMessage(error);
	return `Wanim render failed: ${summary}`;
}

// ============================================================================
// Boundary DOM Leaf Functions
// ============================================================================

/**
 * Sets visibility and text content on an error panel element.
 * Boundary DOM mutation leaf.
 */
export function setErrorPanelText(element: HTMLElement, text: string): void {
	element.textContent = text;
}

/**
 * Updates the display style of the error panel.
 * Boundary DOM mutation leaf.
 */
export function setErrorPanelVisibility(element: HTMLElement, isVisible: boolean): void {
	element.style.display = isVisible ? 'block' : 'none';
	if (isVisible) {
		element.scrollTop = 0;
	}
}

/**
 * Instantiates and configures a new <pre class="wanim-error-panel"> DOM element.
 * Boundary DOM creation leaf.
 */
export function createErrorPanelElement(doc: Document = document): HTMLPreElement {
	const pre = doc.createElement('pre');
	pre.className = 'wanim-error-panel';
	pre.style.display = 'none';
	pre.setAttribute('role', 'alert');
	pre.setAttribute('aria-live', 'assertive');
	pre.setAttribute('aria-atomic', 'true');
	return pre;
}

// ============================================================================
// Boundary Notification Leaf
// ============================================================================

/**
 * Spawns an Obsidian Notice with the standardized "Wanim render failed: ..." prefix.
 * Pushes the notification side effect to the boundary.
 */
export function showRenderFailureNotice(
	error: unknown,
	notify: NotifyFunction = (msg, dur) => new Notice(msg, dur),
	durationMs?: number
): void {
	const noticeMessage = formatRenderFailureNoticeMessage(error);
	try {
		notify(noticeMessage, durationMs);
	} catch (notifyError) {
		console.error('[Obsidian Wanim Plugin] Failed to display Notice:', notifyError);
	}
}

// ============================================================================
// Error Panel Controller Implementation
// ============================================================================

export class WanimErrorPanelControllerImpl implements WanimErrorPanelController {
	private isDisposed = false;

	constructor(
		public readonly element: HTMLElement,
		private readonly deps: ErrorPanelDependencies = {}
	) {}

	public showError(errorText: string): void {
		if (this.isDisposed) {
			return;
		}
		setErrorPanelText(this.element, errorText);
		setErrorPanelVisibility(this.element, true);
	}

	public clearError(): void {
		if (this.isDisposed) {
			return;
		}
		setErrorPanelText(this.element, '');
		setErrorPanelVisibility(this.element, false);
	}

	public displayError(error: unknown, sourceCode: string = ''): WanimFormattedError {
		const formatFn = this.deps.formatError ?? formatWanimError;
		const formatted = formatFn(error, sourceCode);
		this.showError(formatted.formattedText);
		return formatted;
	}

	public getState(): ErrorPanelState {
		return {
			isVisible: this.isVisible(),
			errorText: this.getErrorText(),
		};
	}

	public isVisible(): boolean {
		return this.element.style.display !== 'none';
	}

	public getErrorText(): string {
		return this.element.textContent ?? '';
	}

	public dispose(): void {
		if (this.isDisposed) {
			return;
		}
		this.clearError();
		this.isDisposed = true;
	}
}

// ============================================================================
// Orchestrator Bricks (Single Uniform Level of Abstraction)
// ============================================================================

/**
 * Factory that creates a controller wrapping an existing or newly created element.
 */
export function createErrorPanelController(
	element: HTMLElement,
	dependencies: ErrorPanelDependencies = {}
): WanimErrorPanelController {
	return new WanimErrorPanelControllerImpl(element, dependencies);
}

/**
 * Factory that creates a new <pre class="wanim-error-panel"> element, appends it
 * to the container, and returns its controller.
 */
export function mountErrorPanel(
	container: HTMLElement,
	dependencies: ErrorPanelDependencies = {}
): WanimErrorPanelController {
	const doc = container.ownerDocument ?? document;
	const pre = createErrorPanelElement(doc);
	container.appendChild(pre);
	return new WanimErrorPanelControllerImpl(pre, dependencies);
}

/**
 * High-level orchestration brick: executes the complete render failure workflow.
 * 1. Formats the error (pure calculation)
 * 2. Displays full diagnostic output in the error panel (DOM action)
 * 3. Shows the transient Obsidian Notice (notification action)
 * 4. Returns the formatted error
 */
export function handleRenderFailure(
	error: unknown,
	panel: WanimErrorPanelController,
	sourceCode: string = '',
	notify?: NotifyFunction
): WanimFormattedError {
	const formatted = panel.displayError(error, sourceCode);
	showRenderFailureNotice(formatted, notify);
	return formatted;
}
```

### 4.2 CSS Enhancements for `styles.css`

Lines 319–333 of `styles.css` should be updated to ensure `box-sizing: border-box;`, `word-break: break-word;`, and clean margin reset:

```css
/* ==========================================================================
   Red Error Panel
   ========================================================================== */
.wanim-error-panel {
    box-sizing: border-box;
    width: 100%;
    margin: 8px 0 0 0;
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--color-red) 60%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-red) 8%, var(--background-primary));
    color: var(--text-error, var(--color-red));
    font-family: var(--font-monospace);
    font-size: var(--code-size, 0.9em);
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
    max-height: 220px;
    display: none;
}
```

---

## 5. Verification Method

To verify the error panel design and its implementation:

1. **Unit & Integration Test Suite Execution**:
   Run the test harness in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npm test
   ```
   *Verification criteria*:
   - Unit tests for `createErrorPanelElement`: verifies element tag is `PRE`, class is `wanim-error-panel`, style display is `none`, and ARIA attributes are set.
   - Unit tests for `showError` and `clearError`: verifies textContent and display styling.
   - Integration tests with `formatWanimError`: verifies compilation caret, unsupported import list, and clean stack traces display accurately.
   - Notice format tests: verifies all error types format to `"Wanim render failed: <summary>"` with no multiline overflow.
   - XSS sanitization tests: verifies HTML tags (`<script>`, `<img>`) are treated strictly as text.

2. **TypeScript Compilation & Build Verification**:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npm run build
   ```
   *Expected output*: `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` exits with code 0 and 0 errors.

3. **Untouched Reference Directory Verification**:
   ```powershell
   (Get-ChildItem -Recurse -File "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin" | Where-Object { $_.FullName -notmatch "node_modules" }).Count
   ```
   *Expected output*: Exactly `26` files untouched.
