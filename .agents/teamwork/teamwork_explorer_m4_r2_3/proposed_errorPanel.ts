/**
 * Red Error Panel Controller for Obsidian Wanim Plugin (Milestone 4).
 * Displays formatted compilation errors with line carets, unsupported import notices,
 * and sanitized runtime tracebacks directly below the canvas.
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

export type NoticeDisplayFunction = (message: string, durationMs?: number) => void;
export type NotifyFunction = NoticeDisplayFunction;

export const defaultNoticeDisplay: NoticeDisplayFunction = (msg: string, durationMs?: number): void => {
	try {
		new Notice(msg, durationMs);
	} catch (error) {
		console.error('[Obsidian Wanim Plugin] Failed to instantiate Notice:', error);
	}
};

export interface ErrorPanelState {
	readonly isVisible: boolean;
	readonly errorText: string;
}

export interface ErrorPanelDependencies {
	readonly formatError?: (error: unknown, sourceCode?: string) => WanimFormattedError;
	readonly notify?: NoticeDisplayFunction;
}

export interface WanimErrorPanelController {
	readonly element: HTMLPreElement;
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
 * Sanitizes an error message or string into a strict, single-line summary string.
 * Strips all newline (\r, \n) and line separator characters (\u2028, \u2029),
 * selects the first non-empty line after trimming, and ensures transient UI notifications
 * (like Obsidian Notice popups) are never broken or expanded by multiline tracebacks or stack dumps.
 *
 * Pure leaf function adhering to R5 architectural guidelines.
 *
 * @param text - The raw text or error string to sanitize.
 * @param fallback - The fallback string to return if no non-empty line exists.
 * @returns A single-line trimmed summary string guaranteed to contain zero newline or carriage return characters.
 */
export function sanitizeSingleLine(text: unknown, fallback: string = ''): string {
	if (text === null || text === undefined) {
		return fallback;
	}
	try {
		const str = String(text);
		const lines = str.split(/\r\n|[\r\n\u2028\u2029]/);
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.length > 0) {
				return trimmed.replace(/[\r\n\u2028\u2029]/g, ' ');
			}
		}
	} catch {
		// Fall through to fallback if String(text) or regex fails
	}
	return fallback;
}

/**
 * Extracts a concise, single-line summary from an error object suitable for
 * an Obsidian transient Notice popup.
 * Guarantees no newline (\r, \n) or line break characters are present in the output.
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
				const singleLineMsg = sanitizeSingleLine(formatted.message, 'unexpected syntax error');
				const messageWithoutPrefix = singleLineMsg.replace(/^SyntaxError:\s*/, '');
				return `SyntaxError: ${messageWithoutPrefix} (line ${formatted.line})`;
			}
			case 'unsupported_import': {
				const singleLineModule = sanitizeSingleLine(formatted.module, 'unknown');
				return `Python module '${singleLineModule}' is unavailable in browser Manim`;
			}
			case 'runtime': {
				const singleLineName = sanitizeSingleLine(formatted.name, 'RuntimeError');
				const singleLineMsg = sanitizeSingleLine(formatted.message, 'execution failed');
				return `${singleLineName}: ${singleLineMsg}`;
			}
			case 'unknown': {
				return sanitizeSingleLine(formatted.message, 'An unexpected execution error occurred');
			}
		}
	}

	// 2. Standard Error instance
	if (error instanceof Error) {
		const name = sanitizeSingleLine(error.name, 'Error');
		const message = sanitizeSingleLine(error.message, 'An unexpected error occurred');
		return `${name}: ${message}`;
	}

	// 3. String error
	if (typeof error === 'string') {
		return sanitizeSingleLine(error, 'An error occurred');
	}

	// 4. Unknown object fallback
	try {
		const serialized = JSON.stringify(error);
		if (typeof serialized === 'string') {
			return sanitizeSingleLine(serialized, 'An unexpected error occurred');
		}
	} catch {
		// Ignore JSON serialization errors (e.g. circular references, BigInt, throwing getters)
	}

	try {
		return sanitizeSingleLine(String(error), 'An unexpected error occurred');
	} catch {
		return 'An unexpected error occurred';
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
 * Sets text content on an error panel element.
 * Safe from XSS injection because textContent escapes HTML entities automatically.
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

/**
 * Mounts a new <pre class="wanim-error-panel"> into containerEl and returns it.
 * Boundary DOM builder.
 */
export function createErrorPanel(containerEl: HTMLElement): HTMLPreElement {
	const doc = containerEl.ownerDocument ?? document;
	const pre = createErrorPanelElement(doc);
	containerEl.appendChild(pre);
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
	notify: NoticeDisplayFunction = defaultNoticeDisplay,
	durationMs?: number
): void {
	const noticeMessage = formatRenderFailureNoticeMessage(error);
	try {
		notify(noticeMessage, durationMs);
	} catch (notifyError) {
		console.error('[Obsidian Wanim Plugin] Failed to display Notice:', notifyError);
	}
}

/**
 * Clears and hides an error panel element directly.
 * Boundary DOM procedure.
 */
export function clearErrorPanel(panelEl: HTMLPreElement): void {
	setErrorPanelText(panelEl, '');
	setErrorPanelVisibility(panelEl, false);
}

/**
 * Displays formatted error in panel and shows transient notice.
 * Boundary DOM procedure.
 */
export function displayErrorInPanel(
	panelEl: HTMLPreElement,
	error: unknown,
	sourceCode: string = '',
	noticeFn: NoticeDisplayFunction = defaultNoticeDisplay
): WanimFormattedError {
	const formatted = formatWanimError(error, sourceCode);
	setErrorPanelText(panelEl, formatted.formattedText);
	setErrorPanelVisibility(panelEl, true);
	showRenderFailureNotice(formatted, noticeFn);
	return formatted;
}

// ============================================================================
// Error Panel Controller Implementation
// ============================================================================

export class WanimErrorPanelControllerImpl implements WanimErrorPanelController {
	private isDisposed = false;

	constructor(
		public readonly element: HTMLPreElement,
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
 * Factory that creates a controller wrapping an existing HTMLPreElement.
 */
export function createErrorPanelController(
	element: HTMLPreElement,
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
	const pre = createErrorPanel(container);
	return new WanimErrorPanelControllerImpl(pre, dependencies);
}

/**
 * High-level orchestration brick: executes the complete render failure workflow.
 * 1. Formats the error and displays diagnostic in error panel
 * 2. Shows the transient Obsidian Notice
 * 3. Returns the formatted error
 */
export function handleRenderFailure(
	error: unknown,
	panel: WanimErrorPanelController,
	sourceCode: string = '',
	notify?: NoticeDisplayFunction
): WanimFormattedError {
	const formatted = panel.displayError(error, sourceCode);
	showRenderFailureNotice(formatted, notify ?? defaultNoticeDisplay);
	return formatted;
}
