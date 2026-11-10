/**
 * Compilation error and runtime traceback formatter for the Wanim execution engine.
 * Adheres strictly to Code Generation Guidelines: honest leaf functions,
 * single level of abstraction, and invariant encoding.
 */

import {
	FormattedCompileError,
	FormattedGenericError,
	FormattedImportError,
	FormattedRuntimeError,
	WanimFormattedError,
} from '../types';

export interface ErrorLocation {
	readonly line: number;
	readonly column: number;
}

interface RawRapydScriptError {
	message?: string;
	line?: number;
	col?: number;
	filename?: string;
}

const DEFAULT_FILENAME = 'scene.py';

// Stack lines containing these patterns are internal engine/browser/bundler plumbing
const INTERNAL_STACK_PATTERNS: readonly RegExp[] = [
	/node:internal/,
	/node:electron/,
	/app\.js/,
	/main\.js/,
	/plugin:obsidian/,
	/ModuleJob\./,
	/asyncRunEntryPoint/,
	/runPythonOnCanvas/,
	/wanim\.browser\.js/,
	/bridge\.browser\.js/,
	/py2js\.browser\.js/,
	/py-runtime\.browser\.js/,
	/render_presentation_to_canvas/,
	/createRuntimeCore/,
	/buildRuntime/,
	/installPythonShims/,
	/create_compiler/,
	/HTMLButtonElement\.onclick/,
	/HTMLIFrameElement/,
	/eval at [sS]/,
	/WanimExecutionController/,
];

/**
 * Filter raw stack trace lines, stripping engine internals and normalizing eval frames.
 * Pure leaf function.
 */
export function cleanStackTrace(rawStack: string): string[] {
	if (!rawStack || typeof rawStack !== 'string') {
		return [];
	}

	const lines = rawStack.split(/\r?\n/);
	const cleaned: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		if (rawLine === undefined) {
			continue;
		}
		const line = rawLine.trim();
		if (!line.startsWith('at ')) {
			continue;
		}

		// Normalize eval and anonymous references to scene.py
		const normalizedLine = line
			.replace(/\(eval at [^,]+, <anonymous>:(\d+:\d+)\)/, '(scene.py:$1)')
			.replace(/\(eval at [^)]+\)/, '')
			.replace(/<anonymous>:(\d+:\d+)/, 'scene.py:$1');

		// Check if the normalized frame is purely an engine/browser internal
		const isInternal = INTERNAL_STACK_PATTERNS.some((pattern) => pattern.test(normalizedLine));
		if (isInternal) {
			continue;
		}

		cleaned.push(normalizedLine.trim());
	}

	return cleaned;
}

/**
 * Strips internal browser/iframe/eval noise from stack traces, returning a sanitized string.
 * Pure leaf helper.
 */
export function sanitizeStackTrace(rawStack: string): string {
	return cleanStackTrace(rawStack).join('\n').trim();
}

/**
 * Honest leaf function that extracts line and column offsets from a compile or runtime error.
 * Pure function: reads only explicitly declared parameter, returns immutable ErrorLocation or null.
 * Guarded against throwing property getters.
 */
export function extractErrorLocation(error: unknown): ErrorLocation | null {
	if (!error || typeof error !== 'object') {
		return null;
	}
	try {
		const err = error as Record<string, unknown>;
		const line = err.line;
		const col = err.col;
		if (
			typeof line === 'number' &&
			typeof col === 'number' &&
			Number.isFinite(line) &&
			Number.isFinite(col)
		) {
			return { line: Math.max(1, line), column: Math.max(0, col) };
		}
		const msg = typeof err.message === 'string' ? err.message : '';
		if (msg.length > 0) {
			const match = msg.match(/scene\.py:(\d+):(\d+)/);
			if (match && match[1] !== undefined && match[2] !== undefined) {
				return { line: parseInt(match[1], 10), column: parseInt(match[2], 10) };
			}
			const importMatch = msg.match(/\(line\s+(\d+):/);
			if (importMatch && importMatch[1] !== undefined) {
				return { line: parseInt(importMatch[1], 10), column: 1 };
			}
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Safely coerces any value to string without throwing exceptions on pathological objects.
 * Handles null, undefined, primitive numbers/booleans/symbols/bigints, throwing toString/getters,
 * and null-prototype objects.
 * Pure leaf helper.
 */
export function safeCoerceToString(value: unknown, fallback: string = '[Unknown Error]'): string {
	if (typeof value === 'string') {
		return value;
	}
	if (value === null) {
		return 'null';
	}
	if (value === undefined) {
		return 'undefined';
	}
	if (typeof value === 'symbol') {
		try {
			return value.toString();
		} catch {
			return 'Symbol()';
		}
	}
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value);
	}
	// Attempt JSON serialization for structured diagnostics
	try {
		const json = JSON.stringify(value);
		if (typeof json === 'string') {
			return json;
		}
	} catch {
		// Ignore serialization failures (circular references, BigInts, throwing getters)
	}

	// Attempt direct String coercion
	try {
		return String(value);
	} catch {
		// Ignore throwing toString / valueOf methods
	}

	// Attempt Object prototype toString
	try {
		return Object.prototype.toString.call(value);
	} catch {
		// Ignore throwing Symbol.toStringTag getters
	}

	return fallback;
}

/**
 * Safely extracts error message string from unknown error object or primitive.
 * Pure leaf helper.
 */
export function safeExtractErrorMessage(error: unknown): string {
	if (typeof error === 'string') {
		return error;
	}
	if (error && typeof error === 'object') {
		try {
			const candidate = (error as { message?: unknown }).message;
			if (typeof candidate === 'string') {
				return candidate;
			}
		} catch {
			// Getter threw, fall through to safe coercion
		}
	}
	return safeCoerceToString(error, 'An unexpected error occurred');
}

/**
 * Safely extracts a finite numeric property from an object, guarding against throwing getters.
 * Pure leaf helper.
 */
export function safeExtractNumber(obj: unknown, key: string, fallback: number): number {
	if (obj && typeof obj === 'object') {
		try {
			const val = (obj as Record<string, unknown>)[key];
			if (typeof val === 'number' && Number.isFinite(val)) {
				return val;
			}
		} catch {
			// Getter threw, return fallback
		}
	}
	return fallback;
}

/**
 * Pure predicate to determine if an error object resembles a RapydScript compile or syntax error.
 * Guarded against throwing getters.
 * Pure leaf helper.
 */
export function isLikelyCompileError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	try {
		if ('line' in error && 'col' in error) {
			return true;
		}
		const message = (error as { message?: unknown }).message;
		const name = (error as { name?: unknown }).name;
		if (typeof message === 'string') {
			if (
				message.includes('Inconsistent indentation') ||
				message.includes('Unexpected token') ||
				message.includes('scene.py:') ||
				message.includes('SyntaxError')
			) {
				return true;
			}
		}
		if (typeof name === 'string' && name === 'SyntaxError') {
			return true;
		}
	} catch {
		return false;
	}
	return false;
}

/**
 * Builds a lookup map of preprocessed line index to original source line number (1-based).
 * Resolves the line inflation introduced by Wanim's import preprocessor.
 * Pure leaf function.
 */
export function buildSourceLineMap(source: string): number[] {
	if (!source || typeof source !== 'string') {
		return [];
	}

	const lines = source.split(/\r?\n/);
	const lineMap: number[] = [];

	let randomEmitted = false;
	let mathEmitted = false;
	let itertoolsEmitted = false;

	const MANIM_FROM = /^\s*from\s+manim(\.[\w.]+)?\s+import\s+(.+?)\s*(?:#.*)?$/;
	const MANIM_IMPORT = /^\s*import\s+manim(\.[\w.]+)?(\s+as\s+\w+)?\s*(?:#.*)?$/;
	const NUMPY_FROM = /^\s*from\s+numpy(\.[\w.]+)?\s+import\s+(.+?)\s*(?:#.*)?$/;
	const NUMPY_IMPORT = /^\s*import\s+numpy(\.[\w.]+)?(\s+as\s+\w+)?\s*(?:#.*)?$/;
	const RANDOM_FROM = /^\s*from\s+random\s+import\s+(.+?)\s*(?:#.*)?$/;
	const RANDOM_IMPORT = /^\s*import\s+random(\s+as\s+(\w+))?\s*(?:#.*)?$/;
	const MATH_FROM = /^\s*from\s+math\s+import\s+(.+?)\s*(?:#.*)?$/;
	const MATH_IMPORT = /^\s*import\s+math(\s+as\s+(\w+))?\s*(?:#.*)?$/;
	const ITERTOOLS_FROM = /^\s*from\s+itertools\s+import\s+(.+?)\s*(?:#.*)?$/;
	const ITERTOOLS_IMPORT = /^\s*import\s+itertools(\s+as\s+(\w+))?\s*(?:#.*)?$/;
	const PAREN_FROM_IMPORT = /^\s*from\s+[.\w]+\s+import\s*\(/;

	const MATH_PUBLIC_COUNT = 60;
	const RANDOM_PUBLIC_COUNT = 26;
	const ITERTOOLS_PUBLIC_COUNT = 20;

	function countFromImports(spec: string): number {
		return spec
			.replace(/[()]/g, ' ')
			.split(',')
			.map((part) => part.trim())
			.filter((part) => part.length > 0).length;
	}

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		if (rawLine === undefined) {
			continue;
		}
		let line = rawLine;
		const origNum = i + 1;

		if (PAREN_FROM_IMPORT.test(line)) {
			while (!/\)/.test(line) && i + 1 < lines.length) {
				i++;
				const nextSegment = lines[i];
				if (nextSegment !== undefined) {
					line += '\n' + nextSegment;
				}
			}
			line = line.replace(/\n/g, ' ');
		}

		if (
			NUMPY_FROM.test(line) ||
			NUMPY_IMPORT.test(line) ||
			MANIM_FROM.test(line) ||
			MANIM_IMPORT.test(line)
		) {
			lineMap.push(origNum);
			continue;
		}

		const rndImport = line.match(RANDOM_IMPORT);
		if (rndImport) {
			lineMap.push(origNum);
			if (!randomEmitted) {
				lineMap.push(origNum);
				randomEmitted = true;
			}
			const alias = rndImport[2];
			if (alias !== undefined && alias !== 'random') {
				lineMap.push(origNum);
			}
			continue;
		}

		const rndFrom = line.match(RANDOM_FROM);
		if (rndFrom && rndFrom[1] !== undefined) {
			lineMap.push(origNum);
			if (!randomEmitted) {
				lineMap.push(origNum);
				randomEmitted = true;
			}
			const spec = rndFrom[1].trim();
			if (spec === '*') {
				for (let k = 0; k < RANDOM_PUBLIC_COUNT; k++) {
					lineMap.push(origNum);
				}
			} else {
				const count = countFromImports(spec);
				for (let k = 0; k < count; k++) {
					lineMap.push(origNum);
				}
			}
			continue;
		}

		const mImport = line.match(MATH_IMPORT);
		if (mImport) {
			lineMap.push(origNum);
			if (!mathEmitted) {
				lineMap.push(origNum);
				mathEmitted = true;
			}
			const alias = mImport[2];
			if (alias !== undefined && alias !== 'math') {
				lineMap.push(origNum);
			}
			continue;
		}

		const mFrom = line.match(MATH_FROM);
		if (mFrom && mFrom[1] !== undefined) {
			lineMap.push(origNum);
			if (!mathEmitted) {
				lineMap.push(origNum);
				mathEmitted = true;
			}
			const spec = mFrom[1].trim();
			if (spec === '*') {
				for (let k = 0; k < MATH_PUBLIC_COUNT; k++) {
					lineMap.push(origNum);
				}
			} else {
				const count = countFromImports(spec);
				for (let k = 0; k < count; k++) {
					lineMap.push(origNum);
				}
			}
			continue;
		}

		const itImport = line.match(ITERTOOLS_IMPORT);
		if (itImport) {
			lineMap.push(origNum);
			if (!itertoolsEmitted) {
				lineMap.push(origNum);
				itertoolsEmitted = true;
			}
			const alias = itImport[2];
			if (alias !== undefined && alias !== 'itertools') {
				lineMap.push(origNum);
			}
			continue;
		}

		const itFrom = line.match(ITERTOOLS_FROM);
		if (itFrom && itFrom[1] !== undefined) {
			lineMap.push(origNum);
			if (!itertoolsEmitted) {
				lineMap.push(origNum);
				itertoolsEmitted = true;
			}
			const spec = itFrom[1].trim();
			if (spec === '*') {
				for (let k = 0; k < ITERTOOLS_PUBLIC_COUNT; k++) {
					lineMap.push(origNum);
				}
			} else {
				const count = countFromImports(spec);
				for (let k = 0; k < count; k++) {
					lineMap.push(origNum);
				}
			}
			continue;
		}

		lineMap.push(origNum);
	}

	return lineMap;
}

/**
 * Format a compilation or syntax error from RapydScript.
 * Uses line remapping to match original user source lines, and constructs
 * an exact column caret pointer.
 * Pure leaf function.
 */
export function formatCompileError(error: unknown, source: string): FormattedCompileError {
	const rawMessage = safeExtractErrorMessage(error);

	// If message is already formatted by wanim formatCompileError:
	// e.g. "Inconsistent indentation\n  scene.py:8:23\n\n    def construct(self)\n                      ^"
	const parsedPattern = /^([^\n]+)\n\s+([^\s:]+):(\d+):(\d+)(?:\n\n([^\n]*)\n([^\n]*))?/;
	const parsedMatch = rawMessage.match(parsedPattern);

	let message = rawMessage;
	let filename = DEFAULT_FILENAME;
	let reportedLine = safeExtractNumber(error, 'line', 1);
	let reportedCol = safeExtractNumber(error, 'col', 0);

	if (
		parsedMatch &&
		parsedMatch[1] !== undefined &&
		parsedMatch[2] !== undefined &&
		parsedMatch[3] !== undefined &&
		parsedMatch[4] !== undefined
	) {
		message = parsedMatch[1].trim();
		filename = parsedMatch[2].trim();
		reportedLine = parseInt(parsedMatch[3], 10);
		reportedCol = Math.max(0, parseInt(parsedMatch[4], 10) - 1);
	}

	// Remap preprocessed line back to original source line
	const safeSource = typeof source === 'string' ? source : '';
	const sourceLines = safeSource.length > 0 ? safeSource.split(/\r?\n/) : [];
	const lineMap = safeSource.length > 0 ? buildSourceLineMap(safeSource) : [];
	const originalLineIndex = reportedLine - 1;
	const mappedLine: number =
		originalLineIndex >= 0 && originalLineIndex < lineMap.length
			? (lineMap[originalLineIndex] ?? reportedLine)
			: reportedLine;

	const sourceLine: string =
		mappedLine >= 1 && mappedLine <= sourceLines.length
			? (sourceLines[mappedLine - 1] ?? '')
			: (parsedMatch?.[5] ?? '');

	const safeCol = Math.max(0, Math.min(reportedCol, sourceLine.length));
	const caret = ' '.repeat(safeCol) + '^';
	const displayCol = safeCol + 1;

	const formattedText = `SyntaxError: ${message}\n  ${filename}:${mappedLine}:${displayCol}\n\n${sourceLine}\n${caret}`;

	return {
		kind: 'compile',
		message,
		filename,
		line: mappedLine,
		column: displayCol,
		sourceLine,
		caret,
		formattedText,
	};
}

/**
 * Format an unsupported import error into a user-friendly diagnostic.
 * Explains permitted modules (manim, numpy, math, random, itertools).
 * Pure leaf function.
 */
export function formatUnsupportedImport(error: unknown): FormattedImportError | null {
	const message = safeExtractErrorMessage(error);
	const match = message.match(
		/wanim:\s+cannot\s+use\s+Python\s+module\s+'([^']+)'\s+\(line\s+(\d+):\s+([^)]+)\)/
	);
	if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
		return null;
	}

	const module = match[1];
	const line = parseInt(match[2], 10);
	const statement = match[3];

	const formattedText = [
		`ImportError: Python module '${module}' cannot be used in browser Manim.`,
		`  Line ${line}: ${statement}`,
		'',
		'Available modules in the in-browser runtime:',
		'  - from manim import *',
		'  - import numpy as np',
		'  - import math',
		'  - import random',
		'  - import itertools',
		'',
		'Standard library modules (os, sys, json) and third-party packages are unavailable.',
	].join('\n');

	return {
		kind: 'unsupported_import',
		module,
		line,
		statement,
		formattedText,
	};
}

/**
 * Format a runtime exception thrown during scene construction or animation.
 * Pure leaf function.
 */
export function formatRuntimeError(error: unknown): FormattedRuntimeError {
	let name = 'RuntimeError';
	let message = 'An unexpected error occurred during execution';
	let rawStack = '';

	if (error && typeof error === 'object') {
		try {
			const candidateName = (error as { name?: unknown }).name;
			if (typeof candidateName === 'string' && candidateName.length > 0) {
				name = candidateName;
			}
		} catch {
			// Getter threw, preserve default name
		}

		try {
			const candidateMessage = (error as { message?: unknown }).message;
			if (typeof candidateMessage === 'string' && candidateMessage.length > 0) {
				message = candidateMessage;
			} else {
				message = safeCoerceToString(error, 'An unexpected error occurred during execution');
			}
		} catch {
			message = safeCoerceToString(error, 'An unexpected error occurred during execution');
		}

		try {
			const candidateStack = (error as { stack?: unknown }).stack;
			if (typeof candidateStack === 'string') {
				rawStack = candidateStack;
			}
		} catch {
			// Getter threw, ignore stack
		}
	} else {
		message = safeCoerceToString(error, 'An unexpected error occurred during execution');
	}

	const cleanStack = cleanStackTrace(rawStack);
	const stackBlock =
		cleanStack.length > 0 ? '\n' + cleanStack.map((s) => '  ' + s).join('\n') : '';

	const formattedText = `${name}: ${message}${stackBlock}`;

	return {
		kind: 'runtime',
		name,
		message,
		cleanStack,
		formattedText,
	};
}

/**
 * Format generic or unknown error objects.
 * Pure leaf function.
 */
export function formatGenericError(error: unknown): FormattedGenericError {
	let message: string;
	if (typeof error === 'string') {
		message = error;
	} else if (error && typeof error === 'object') {
		try {
			const candidate = (error as { message?: unknown }).message;
			if (typeof candidate === 'string' && candidate.length > 0) {
				message = candidate;
			} else {
				message = safeCoerceToString(error, 'An unexpected error occurred');
			}
		} catch {
			message = safeCoerceToString(error, 'An unexpected error occurred');
		}
	} else {
		message = safeCoerceToString(error, 'An unexpected error occurred');
	}

	return {
		kind: 'unknown',
		message,
		formattedText: `Error: ${message}`,
	};
}

/**
 * High-level error dispatcher: identifies the error category and formats it cleanly for the red panel.
 * Dispatches to unsupported import, compile error, runtime error, or generic error.
 * Pure leaf function.
 */
export function formatWanimError(error: unknown, sourceCode: string = ''): WanimFormattedError {
	try {
		if (error === null || error === undefined) {
			return formatGenericError('Unknown empty error');
		}

		// 1. Check for unsupported import error
		const importError = formatUnsupportedImport(error);
		if (importError !== null) {
			return importError;
		}

		// 2. Check for RapydScript compile/syntax error
		if (isLikelyCompileError(error)) {
			return formatCompileError(error, sourceCode);
		}

		// 3. Runtime error with stack or standard Error instance
		if (error instanceof Error) {
			return formatRuntimeError(error);
		}

		// 4. Fallback generic error
		return formatGenericError(error);
	} catch {
		return formatGenericError(error);
	}
}
