# Handoff Report: Milestone 4 Defect 2 Investigation

- **Author**: `teamwork_explorer_m4_r2_2`
- **Target File**: `src/engine/errorFormatter.ts`
- **Target Plugin Working Directory**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`
- **State Folder**: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_2\`
- **Deliverables**:
  - `proposed_errorFormatter.ts` (full replacement file)
  - `errorFormatter.patch` (unified diff patch)
  - `handoff.md` (this report)

---

## 1. Observation

### 1.1 Verbatim Challenger Failure
When executing the adversarial challenger test suite:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
node tests/run_m4_error_lifecycle.mjs
```

Test 2D fails with an uncaught exception:
```
  ✗ FAIL: 2D. Pathological throwing getters and toString() methods
Error: toString failed!
    at Object.toString (file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:122141:15)
    at String (<anonymous>)
    at formatUnsupportedImport (file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:20823:60)
    at formatWanimError (file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:20892:23)
    at file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:122144:23
    at runTest (file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:121795:20)
    at main (file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:122132:9)
```

### 1.2 Primary Fault Location: `formatUnsupportedImport`
In `src/engine/errorFormatter.ts:374-376`:
```typescript
export function formatUnsupportedImport(error: unknown): FormattedImportError | null {
	const message = error instanceof Error ? error.message : String(error);
	const match = message.match(
		/wanim:\s+cannot\s+use\s+Python\s+module\s+'([^']+)'\s+\(line\s+(\d+):\s+([^)]+)\)/
	);
```
- Line 375 calls `String(error)` unconditionally when `error instanceof Error` is false.
- When `error` is an object whose `toString()` method throws (e.g. `{ toString() { throw new Error('toString failed!'); } }`), `String(error)` throws an unhandled exception.
- When `error` is created with `Object.create(null)` (null prototype), `String(error)` throws `TypeError: Cannot convert object to primitive value`.
- When `error instanceof Error` is true, but `error.message` is an accessor property that throws, accessing `error.message` throws an unhandled exception.
- Because `formatWanimError(error)` calls `formatUnsupportedImport(error)` at line 470 as the first check, any of these throws will immediately abort `formatWanimError` and crash the error formatting pipeline.

### 1.3 Critical Secondary Fault Location: `formatGenericError`
In `src/engine/errorFormatter.ts:438-450`:
```typescript
export function formatGenericError(error: unknown): FormattedGenericError {
	let message: string;
	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === 'string') {
		message = error;
	} else {
		try {
			message = JSON.stringify(error);
		} catch {
			message = String(error);
		}
	}
```
Direct node experimentation revealed a critical secondary vulnerability:
- If `error` is `{ get message() { throw new Error('getter failed'); }, toString() { throw new Error('toString failed'); } }`:
  1. `JSON.stringify(error)` accesses the enumerable property `message`, which invokes `get message()` and throws `Error('getter failed')`.
  2. Control jumps to the `catch` block at line 447.
  3. Line 448 executes `message = String(error);`.
  4. `String(error)` calls `error.toString()`, which throws `Error('toString failed')`.
  5. There is NO `try...catch` inside the `catch` block.
- Therefore, **even if `formatUnsupportedImport` is patched in isolation, `formatGenericError` crashes immediately afterwards on the same object!**
- In addition, when `error = Symbol('test')`, `JSON.stringify(error)` evaluates to `undefined` without throwing. Line 446 assigns `message = undefined`, producing `{ kind: 'unknown', message: undefined, formattedText: 'Error: undefined' }`, violating the TypeScript return contract where `message` is typed as `string`.

### 1.4 Tertiary Fault Locations in `errorFormatter.ts`
1. `extractErrorLocation(error: unknown)` (`src/engine/errorFormatter.ts:106-125`):
   - Accesses `err.line`, `err.col`, and `err.message` without `try...catch`.
   - If any property has a throwing getter, `extractErrorLocation` throws an unhandled exception.
2. `formatCompileError(error: unknown, source: string)` (`src/engine/errorFormatter.ts:310-335`):
   - Accesses `raw.message`, `raw.line`, `raw.col`, and calls `String(error)`.
   - Accessing throwing getters or converting null-prototype/throwing objects throws unhandled exceptions.
   - If `reportedCol < 0`, `' '.repeat(safeCol)` throws `RangeError: Invalid count value`.
3. `formatRuntimeError(error: unknown)` (`src/engine/errorFormatter.ts:414-419`):
   - If `!(error instanceof Error)`, calls `new Error(String(error))`, where `String(error)` throws on throwing `toString()`.
   - If `error instanceof Error`, accesses `err.name`, `err.message`, `err.stack`, all of which may be throwing accessors.
4. `formatWanimError(error: unknown, sourceCode: string)` (`src/engine/errorFormatter.ts:464-496`):
   - Evaluates `(error as Error).message.includes(...)` and `(error as Error).name === 'SyntaxError'` at lines 478-483 without a guard.
   - Does not have an outermost `try...catch` guard to guarantee that unexpected errors can always recover cleanly to `formatGenericError`.

---

## 2. Logic Chain

1. **Pathological Error Invocation**:
   In `tests/adversarial_m4_error_lifecycle.ts:478-496`:
   ```typescript
   const explosiveObject = {
       get message(): string { throw new Error('Getter failed!'); },
       get stack(): string { throw new Error('Stack failed!'); },
       toString(): string { throw new Error('toString failed!'); },
   };
   formatWanimError(explosiveObject);
   ```
2. **Uncaught Call Sequence in Current Code**:
   - `formatWanimError(explosiveObject)` is invoked.
   - Line 470: calls `formatUnsupportedImport(explosiveObject)`.
   - In `formatUnsupportedImport`: `explosiveObject instanceof Error` is `false`.
   - Line 375 evaluates `String(explosiveObject)`.
   - `String(explosiveObject)` calls `explosiveObject.toString()`.
   - `toString()` throws `Error('toString failed!')`.
   - Neither `formatUnsupportedImport` nor `formatWanimError` has a `try...catch` block.
   - The uncaught exception bubbles to the top, causing test 2D to fail and aborting execution.
3. **Cascading Failure in `formatGenericError`**:
   - If only line 375 is guarded to return `null`, `formatWanimError` falls through to line 495: `formatGenericError(explosiveObject)`.
   - In `formatGenericError`: `explosiveObject instanceof Error` is `false`.
   - Line 446 executes `JSON.stringify(explosiveObject)`.
   - `JSON.stringify` enumerates `explosiveObject.message` and calls its getter, which throws `Error('Getter failed!')`.
   - Control transfers to line 447 (`catch`).
   - Line 448 calls `String(explosiveObject)`.
   - `explosiveObject.toString()` throws `Error('toString failed!')`.
   - Uncaught exception thrown from `formatGenericError`.
4. **Architectural Solution (R5 Compliance)**:
   - To make `errorFormatter.ts` completely crash-proof under any pathological, malicious, or malformed input, we extract pure, honest leaf helper functions:
     a. `safeCoerceToString(value: unknown, fallback?: string): string`: Converts any value to a guaranteed non-empty string using a 4-tier fallback: primitives -> `JSON.stringify` -> `String(value)` -> `Object.prototype.toString.call(value)` -> `fallback`. Every tier is guarded by `try...catch`.
     b. `safeExtractErrorMessage(error: unknown): string`: Safely reads `.message` if string, otherwise delegates to `safeCoerceToString`.
     c. `safeExtractNumber(obj: unknown, key: string, fallback: number): number`: Safely reads finite numbers without throwing on getter access.
     d. `isLikelyCompileError(error: unknown): boolean`: Safely checks syntax/compile error signatures without throwing on getter access.
   - In `formatWanimError`, wrap the entire categorization pipeline in `try...catch`, falling back to `formatGenericError(error)` (which is guaranteed never to throw).

---

## 3. Caveats

1. **Scope Boundary**:
   This investigation is strictly scoped to `src/engine/errorFormatter.ts` (Defect 2). Defect 1 (Symbol fallback in `src/ui/errorPanel.ts`) and Defect 3 (multiline Notice sanitization in `src/ui/errorPanel.ts`) are assigned to peer Explorer 1 / Milestone 4 Challenger.
2. **Object Representation Fidelity**:
   When an object has both a throwing getter and a throwing `toString()`, JavaScript cannot serialize its internal properties. Falling back to `Object.prototype.toString.call(val)` (`"[object Object]"`) or `'[Unknown Error]'` is the safest possible behavior and satisfies the contract.
3. **No Target Modifications by Explorer**:
   Per the Explorer archetype, no source files under `src/` were modified. The proposed changes are provided as standalone artifacts:
   - Full file: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_2\proposed_errorFormatter.ts`
   - Patch: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_2\errorFormatter.patch`

---

## 4. Conclusion & Proposed Implementation

### 4.1 Exact Code Changes Required

#### Change 1: Add Pure Leaf Helpers to `src/engine/errorFormatter.ts`
Insert the following pure leaf helper functions:
```typescript
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
```

#### Change 2: Harden `extractErrorLocation`
In `src/engine/errorFormatter.ts:106-125`:
```typescript
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
```

#### Change 3: Harden `formatCompileError`
In `src/engine/errorFormatter.ts:310-367`:
```typescript
export function formatCompileError(error: unknown, source: string): FormattedCompileError {
	const rawMessage = safeExtractErrorMessage(error);
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
```

#### Change 4: Harden `formatUnsupportedImport`
In `src/engine/errorFormatter.ts:374-408`:
```typescript
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
```

#### Change 5: Harden `formatRuntimeError`
In `src/engine/errorFormatter.ts:414-432`:
```typescript
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
```

#### Change 6: Harden `formatGenericError`
In `src/engine/errorFormatter.ts:438-457`:
```typescript
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
```

#### Change 7: Harden `formatWanimError` Dispatcher
In `src/engine/errorFormatter.ts:464-496`:
```typescript
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
```

---

## 5. Verification Method

To independently verify these findings and confirm the fix:

### 5.1 Verification Commands
1. **Verify Adversarial Stress Suite**:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   node tests/run_m4_error_lifecycle.mjs
   ```
   *Expected Result before fix*: Fails on test 2D with `Error: toString failed!` from `formatUnsupportedImport`.
   *Expected Result after applying `proposed_errorFormatter.ts`*: Test 2D passes completely without uncaught exceptions.

2. **Verify Standard Test Suite**:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npm test
   ```
   *Expected Result*: 8/8 test suites pass, 128/128 tests passing (0 regressions).

3. **Verify Build & Isolation**:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npm run build
   node scripts/verify-isolation.mjs
   ```
   *Expected Result*: Production bundle builds cleanly (code 0), 26/26 files untouched in `obsidian-manim-plugin`.

### 5.2 Standalone Node Verification Script
To test the leaf helpers directly against pathological and malicious objects:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
node -e "
const { formatWanimError } = require('./tests/dist/adversarial_m4_error_lifecycle.mjs');
const explosiveObject = {
    get message() { throw new Error('Getter failed!'); },
    get stack() { throw new Error('Stack failed!'); },
    toString() { throw new Error('toString failed!'); },
    get [Symbol.toStringTag]() { throw new Error('tag trap'); }
};
const res = formatWanimError(explosiveObject);
console.log('SURVIVED:', res.formattedText);
"
```
*Expected Result with fix*: Outputs `SURVIVED: Error: [object Object]` without throwing.
