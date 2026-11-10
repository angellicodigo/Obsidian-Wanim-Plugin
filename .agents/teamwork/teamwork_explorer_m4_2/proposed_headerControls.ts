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
 * Boundary DOM mutation.
 */
export function applyCaretState(caretEl: HTMLElement, state: CollapseState): void {
	caretEl.textContent = caretSymbolByCollapseState[state];
	caretEl.setAttribute('aria-label', caretAriaLabelByCollapseState[state]);
	caretEl.setAttribute('aria-expanded', caretAriaExpandedByCollapseState[state]);
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
 * Renders Run/Pause button icon, text label, and accessibility attribute.
 * Boundary DOM mutation.
 */
export function applyPlaybackButtonState(
	btnEl: HTMLButtonElement,
	iconEl: HTMLElement,
	labelEl: HTMLElement,
	state: PlaybackButtonState,
	setIconFn?: SetIconFunction
): void {
	const iconId = iconNameByPlaybackState[state];
	const labelText = labelByPlaybackState[state];
	const ariaLabelText = ariaLabelByPlaybackState[state];

	safeSetIcon(iconEl, iconId, setIconFn);
	labelEl.textContent = labelText;
	btnEl.setAttribute('aria-label', ariaLabelText);
}

/**
 * Renders status indicator text and visibility.
 * Boundary DOM mutation.
 */
export function applyIndicatorStatus(indicatorEl: HTMLElement, status: IndicatorStatus): void {
	const text = labelByIndicatorStatus[status];
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
	private readonly timerService: TimerService;
	private readonly eventCleanups: Array<() => void> = [];

	constructor(
		container: HTMLElement,
		private readonly options: HeaderControlsOptions
	) {
		this.timerService = options.timerService ?? defaultTimerService;
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

	private updateCollapseState(nextState: CollapseState): void {
		this.collapseState = nextState;
		applyCaretState(this.elements.caretEl, nextState);
		applyEditorVisibility(this.options.editorElement, nextState);

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
		applyEditorVisibility(this.options.editorElement, this.collapseState);

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
