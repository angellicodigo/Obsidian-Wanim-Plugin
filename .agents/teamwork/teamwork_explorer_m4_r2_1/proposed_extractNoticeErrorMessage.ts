/**
 * Proposed pure, honest leaf brick decomposition for extractNoticeErrorMessage
 * in src/ui/errorPanel.ts.
 *
 * Adheres strictly to Code Generation Guidelines (R5):
 * - Honest leaf functions: no external state, deterministic input-to-output mapping
 * - Stacking Bricks: uniform abstraction, table-of-contents orchestrator
 * - No comment-sectioned functions: discrete, single-responsibility helpers
 * - Invariant-rich: guaranteed to always return a valid, non-empty, single-line string
 */

import { WanimFormattedError } from '../types';

export type WanimPrimitiveError = number | boolean | bigint | symbol;

/**
 * Normalizes an arbitrary text string into a single-line summary.
 * Trims leading/trailing whitespace, extracts the first non-empty line,
 * and guarantees fallback if empty.
 * Pure leaf function.
 */
export function toSingleLineSummary(rawText: string, fallback: string = 'An unexpected error occurred'): string {
	if (typeof rawText !== 'string') {
		return fallback;
	}
	const trimmed = rawText.trim();
	if (trimmed.length === 0) {
		return fallback;
	}
	const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
	return firstLine.length > 0 ? firstLine : fallback;
}

/**
 * Type guard for structured WanimFormattedError domain objects.
 * Defensive against throwing getters.
 * Pure leaf function.
 */
export function isWanimFormattedError(value: unknown): value is WanimFormattedError {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	try {
		const candidate = value as Record<string, unknown>;
		return (
			candidate.kind === 'compile' ||
			candidate.kind === 'unsupported_import' ||
			candidate.kind === 'runtime' ||
			candidate.kind === 'unknown'
		);
	} catch {
		return false;
	}
}

/**
 * Extracts a concise summary from a structured WanimFormattedError domain object.
 * Pure leaf function.
 */
export function extractFromWanimFormatted(formatted: WanimFormattedError): string {
	switch (formatted.kind) {
		case 'compile': {
			const rawMessage = formatted.message ?? '';
			const messageWithoutPrefix = rawMessage.replace(/^SyntaxError:\s*/, '');
			return `SyntaxError: ${messageWithoutPrefix} (line ${formatted.line})`;
		}
		case 'unsupported_import': {
			return `Python module '${formatted.module}' is unavailable in browser Manim`;
		}
		case 'runtime': {
			const name = formatted.name || 'RuntimeError';
			const message = formatted.message || 'Execution failed';
			return `${name}: ${message}`;
		}
		case 'unknown': {
			return formatted.message || 'An unexpected execution error occurred';
		}
	}
}

/**
 * Safely extracts name and message from a standard Error instance.
 * Defensive against pathological throwing getters.
 * Pure leaf function.
 */
export function extractFromErrorInstance(error: Error): string {
	try {
		const name = typeof error.name === 'string' && error.name.trim().length > 0 ? error.name.trim() : 'Error';
		const message =
			typeof error.message === 'string' && error.message.trim().length > 0
				? error.message.trim()
				: 'An unexpected error occurred';
		return `${name}: ${message}`;
	} catch {
		return 'Error: An unexpected error occurred';
	}
}

/**
 * Type guard identifying primitive error types (number, boolean, bigint, symbol).
 * Pure leaf function.
 */
export function isPrimitiveError(value: unknown): value is WanimPrimitiveError {
	const t = typeof value;
	return t === 'number' || t === 'boolean' || t === 'bigint' || t === 'symbol';
}

/**
 * Formats primitive error values directly without routing through JSON serialization.
 * Pure leaf function.
 */
export function extractFromPrimitive(value: WanimPrimitiveError): string {
	try {
		return String(value);
	} catch {
		return 'Primitive error';
	}
}

/**
 * Extracts summary representation from functions thrown as errors.
 * Pure leaf function.
 */
export function extractFromFunction(fn: Function): string {
	try {
		if (typeof fn.name === 'string' && fn.name.trim().length > 0) {
			return `Function: ${fn.name.trim()}`;
		}
		const str = String(fn);
		return str.trim().length > 0 ? str : 'Function error';
	} catch {
		return 'Function error';
	}
}

/**
 * Safely extracts diagnostic summaries from arbitrary unknown objects.
 * Defends against circular references, null prototypes, throwing getters, and throwing toString methods.
 * Pure leaf function.
 */
export function extractFromUnknownObject(obj: object): string {
	// Attempt 1: Safe inspection of string 'message' property
	try {
		if ('message' in obj && typeof (obj as { message: unknown }).message === 'string') {
			const msg = (obj as { message: string }).message.trim();
			if (msg.length > 0) {
				return msg;
			}
		}
	} catch {
		// Ignore throwing getter
	}

	// Attempt 2: JSON serialization for plain objects and arrays
	try {
		const serialized = JSON.stringify(obj);
		if (typeof serialized === 'string' && serialized.length > 0 && serialized !== '{}') {
			return serialized;
		}
	} catch {
		// Ignore circular structure, BigInt, or throwing toJSON
	}

	// Attempt 3: Safe String() invocation
	try {
		const str = String(obj);
		if (typeof str === 'string' && str.length > 0 && str !== '[object Object]') {
			return str;
		}
	} catch {
		// Ignore null prototype (Object.create(null)) or throwing toString()
	}

	// Attempt 4: Object prototype tag inspection
	try {
		const tag = Object.prototype.toString.call(obj);
		if (typeof tag === 'string' && tag.length > 0) {
			return tag;
		}
	} catch {
		// Ignore throwing Symbol.toStringTag
	}

	return 'Unknown object error';
}

/**
 * Extracts a concise, single-line summary from an error object suitable for
 * an Obsidian transient Notice popup.
 *
 * Adheres strictly to R5 architectural guidelines:
 * - Table-of-contents orchestrator composing honest leaf brick helpers
 * - Zero comment sections; single level of abstraction
 * - Invariant: Guaranteed to ALWAYS return a valid, non-empty, single-line string
 * Pure leaf orchestrator function.
 */
export function extractNoticeErrorMessage(error: unknown): string {
	if (error === null || error === undefined) {
		return 'An unknown execution error occurred';
	}

	if (typeof error === 'string') {
		return toSingleLineSummary(error, 'An error occurred');
	}

	if (isWanimFormattedError(error)) {
		return toSingleLineSummary(extractFromWanimFormatted(error));
	}

	if (error instanceof Error) {
		return toSingleLineSummary(extractFromErrorInstance(error));
	}

	if (isPrimitiveError(error)) {
		return toSingleLineSummary(extractFromPrimitive(error));
	}

	if (typeof error === 'function') {
		return toSingleLineSummary(extractFromFunction(error));
	}

	if (typeof error === 'object') {
		return toSingleLineSummary(extractFromUnknownObject(error));
	}

	return 'An unexpected error occurred';
}

/**
 * Formats a standardized render failure notice message.
 * Pure leaf function.
 */
export function formatRenderFailureNoticeMessage(error: unknown): string {
	const summary = extractNoticeErrorMessage(error);
	return `Wanim render failed: ${summary}`;
}
