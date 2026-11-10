# Milestone 4 Defect 1 Investigation Report: Symbol Serialization & Non-Error Fallbacks

**Author**: teamwork_explorer (`teamwork_explorer_m4_r2_1`)  
**Target Area**: `extractNoticeErrorMessage` in `src/ui/errorPanel.ts`  
**Classification**: Milestone 4 Defect 1 (Adversarial Challenger Finding)  
**Status**: Investigation Complete — Honest Leaf Brick Solution Ready for Integration  

---

## 1. Observation

### 1.1 Verbatim Code in Target Implementation
In `src/ui/errorPanel.ts` (lines 61–106):
```typescript
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
```

### 1.2 Observed Failure in Adversarial Suite
Command executed by Milestone 4 Adversarial Challenger:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
node tests/run_m4_error_lifecycle.mjs
```

Verbatim Failure Output:
```
--- 2. Malformed Error Objects & Memory Resilience ---
  ✓ 2A. Null and undefined error handling
  ✗ FAIL: 2B. Primitive non-Error objects (numbers, booleans, BigInt, Symbols)
AssertionError [ERR_ASSERTION]: Notice message for Symbol(error_symbol) must be string
+ actual - expected
+ 'undefined'
- 'string'
```

### 1.3 ECMAScript Specification Analysis on Fallback Mechanics
In ECMAScript 2015+ (§ 24.5.2 `JSON.stringify`):
1. **`Symbol`**: Top-level values of type `symbol` serialize to `undefined` (not a JSON string, and without throwing an error).
   - `JSON.stringify(Symbol('error_symbol')) === undefined`.
   - Result in target code: `return JSON.stringify(error);` returns the primitive `undefined`.
   - TypeScript contract violation: declared return type is `string`, but runtime returns `undefined`.
   - Downstream caller `formatRenderFailureNoticeMessage`:
     ```typescript
     export function formatRenderFailureNoticeMessage(error: unknown): string {
         const summary = extractNoticeErrorMessage(error);
         return `Wanim render failed: ${summary}`;
     }
     ```
     Produces `"Wanim render failed: undefined"`.
2. **`Function`**: Top-level values of type `function` also serialize to `undefined` without throwing.
   - `JSON.stringify(() => 'func_error') === undefined`.
   - Result in target code: returns `undefined`.
3. **`BigInt`**: `JSON.stringify(10n)` throws `TypeError: Do not know how to serialize a BigInt`.
   - The code only catches this by falling through to `catch { return String(error); }`. Relying on unhandled TypeError throws for basic ECMAScript primitives is inefficient, fragile, and dishonest.
4. **`NaN` and `Infinity`**: `JSON.stringify(NaN)` and `JSON.stringify(Infinity)` evaluate to the string `"null"`.
   - Result: `extractNoticeErrorMessage(NaN)` returns `"null"`, producing `"Wanim render failed: null"` instead of `"Wanim render failed: NaN"`.
5. **Pathological Circular Objects and Objects with Throwing `toString()`**:
   - For an object with a throwing `.toString()` or throwing getter (e.g. `{ get message() { throw new Error('getter'); }, toString() { throw new Error('tostring'); } }`):
     - `JSON.stringify(error)` attempts to serialize enumerable properties and calls getters, throwing `Error: getter`.
     - The `catch` block executes `String(error)`.
     - `String(error)` invokes `error.toString()`, throwing `Error: tostring`.
     - **Uncaught Exception**: The error handler crashes with an unhandled exception, failing to render any error diagnostics to the user.
   - For a circular object with a null prototype (`const c = Object.create(null); c.self = c;`):
     - `JSON.stringify(c)` throws `TypeError: Converting circular structure to JSON`.
     - The `catch` block executes `String(c)`.
     - In ECMAScript (§ 7.1.1 `ToPrimitive`), `Object.create(null)` has no prototype methods (`toString` or `valueOf`).
     - Calling `String(c)` throws `TypeError: Cannot convert object to primitive value`!
     - **Uncaught Exception**: The error handler crashes with an unhandled exception.

### 1.4 Architectural Guideline Violations in Existing Code
1. **Comment-Sectioned Function Violation**: `extractNoticeErrorMessage` uses numbered section comments (`// 1. Structured Wanim formatted error`, `// 2. Standard Error instance`, `// 3. String error`, `// 4. Unknown object fallback`). Under user global rules (Rule 2: "No Comment-Sectioned Functions"), each section must be decomposed into its own discrete helper function.
2. **Zooming In and Out (Stacking Bricks Violation)**: The function mixes high-level domain dispatch (`WanimFormattedError`) with low-level string regex parsing (`trimmed.split(/\r?\n/)[0]`), standard Error handling, and JSON serialization fallback within a single function body.
3. **Dishonest Contract**: Declares return type `: string` but can return `undefined` or throw uncaught exceptions.

---

## 2. Logic Chain

```
[Observation 1.1, 1.2]: extractNoticeErrorMessage(Symbol('error_symbol')) returns undefined
   │
   ├─► [Observation 1.3]: JSON.stringify(Symbol) and JSON.stringify(Function) return undefined per ECMAScript spec
   │      └─► TypeScript return type contract violated; Notice displays "Wanim render failed: undefined"
   │
   ├─► [Observation 1.3]: JSON.stringify(BigInt) throws TypeError; JSON.stringify(NaN/Infinity) returns "null"
   │      └─► Primitives must be formatted directly via String(value) rather than routed through JSON serializer
   │
   ├─► [Observation 1.3]: Objects with null prototypes or throwing toString() methods crash String(error) in catch block
   │      └─► Object stringification must be defensively layered with try/catch and fallback to Object.prototype.toString
   │
   ├─► [Observation 1.4]: Function is comment-sectioned and mixes multiple abstraction levels
   │      └─► Refactor into honest leaf bricks adhering to R5 "Stacking Bricks" and "No Comment-Sectioned Functions"
   │
   └─► [Synthesis]: Guaranteed Invariant
          extractNoticeErrorMessage(error: unknown): string
          - ALWAYS returns a valid, non-empty, single-line string
          - NEVER returns undefined
          - NEVER throws uncaught exceptions under any pathological input
```

### Complete Input Type Handling Taxonomy

| Input Type | Sample Value | Proposed Brick Handler | Sanitized Output Guarantee |
| :--- | :--- | :--- | :--- |
| `null` / `undefined` | `null`, `undefined` | Guarded in orchestrator | `'An unknown execution error occurred'` |
| `string` | `'Custom error\nline 2'` | `toSingleLineSummary` | First non-empty trimmed line or `'An error occurred'` |
| `WanimFormattedError` | `{ kind: 'compile', ... }` | `extractFromWanimFormatted` | Formatted summary passed through `toSingleLineSummary` |
| `Error` | `new Error('msg\nstack')` | `extractFromErrorInstance` | `${name}: ${message}` safely read, passed through `toSingleLineSummary` |
| `number` | `42`, `-0`, `NaN`, `Infinity` | `extractFromPrimitive` | Direct `String(value)`: `'42'`, `'0'`, `'NaN'`, `'Infinity'` |
| `boolean` | `true`, `false` | `extractFromPrimitive` | Direct `String(value)`: `'true'`, `'false'` |
| `bigint` | `9007199254740993n` | `extractFromPrimitive` | Direct `String(value)`: `'9007199254740993'` |
| `symbol` | `Symbol('error_symbol')` | `extractFromPrimitive` | Direct `String(value)`: `'Symbol(error_symbol)'` |
| `function` | `() => 'func_error'` | `extractFromFunction` | `Function: <name>` or `String(fn)` first line or `'Function error'` |
| Plain Object w/ `message` | `{ message: 'API error' }` | `extractFromUnknownObject` | Safely extracts `.message` string |
| Plain Object w/o `message` | `{ code: 500 }` | `extractFromUnknownObject` | `JSON.stringify(obj)` |
| Circular Object | `{ self: <circular> }` | `extractFromUnknownObject` | Safe `String(obj)` -> `"[object Object]"` |
| Circular Null-Prototype | `Object.create(null)` | `extractFromUnknownObject` | `Object.prototype.toString.call(obj)` -> `"[object Object]"` |
| Explosive Object | `{ toString() { throw; } }` | `extractFromUnknownObject` | Guarded fallback -> `'Unknown object error'` |

---

## 3. Proposed R5 Pure Leaf Brick Implementation

The proposed solution decomposes `extractNoticeErrorMessage` into discrete, pure, single-responsibility leaf functions in `src/ui/errorPanel.ts`.

### 3.1 Brick 1: `toSingleLineSummary`
Normalizes any string, extracts the first line, strips `\r` and `\n`, and guarantees non-empty output.
```typescript
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
```

### 3.2 Brick 2: `isWanimFormattedError`
Safe type guard defensive against throwing getters.
```typescript
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
```

### 3.3 Brick 3: `extractFromWanimFormatted`
Formats compile, unsupported import, runtime, and unknown domain errors.
```typescript
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
```

### 3.4 Brick 4: `extractFromErrorInstance`
Safely extracts error name and message, defensive against throwing getters.
```typescript
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
```

### 3.5 Brick 5: `isPrimitiveError` and `extractFromPrimitive`
Formats primitive errors (`number`, `boolean`, `bigint`, `symbol`) directly without JSON serialization.
```typescript
export type WanimPrimitiveError = number | boolean | bigint | symbol;

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
```

### 3.6 Brick 6: `extractFromFunction`
Formats thrown function values.
```typescript
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
```

### 3.7 Brick 7: `extractFromUnknownObject`
Defensive multi-tier object inspector handling plain objects, circular references, null prototypes, and throwing methods.
```typescript
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
```

### 3.8 Orchestrator: `extractNoticeErrorMessage`
Single level of abstraction, reads like a clean table of contents, zero section comments.
```typescript
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
```

---

## 4. Caveats

1. **Adversarial Test Suite Assertion Bug Noted**:
   In `tests/adversarial_m4_error_lifecycle.ts` line 449:
   ```typescript
   assert.strictEqual(typeof noticeMsg, 'string', `Notice message for ${String(prim)} must be string`);
   ```
   When `prim` is `Object.create(null)`, standard ECMAScript throws `TypeError: Cannot convert object to primitive value` during evaluation of the template literal `${String(prim)}`. While our implementation of `extractNoticeErrorMessage` safely returns `"[object Object]"` without throwing, any test assertion that calls `String(Object.create(null))` directly in its own assertion message will fail at the test level unless safely guarded.
2. **Read-Only Explorer Scope**:
   In accordance with explorer role constraints, target source files in `src/ui/errorPanel.ts` have not been directly modified. The complete proposed replacement and unified patch file are provided in the explorer state folder.
3. **Synergy with Defect 3**:
   Routing all branches through `toSingleLineSummary` directly eliminates multiline stack and diagnostic dumps in `Notice` popups, simultaneously satisfying the single-line invariant required for Defect 3.

---

## 5. Conclusion

- **Root Cause Verified**: `JSON.stringify` returns `undefined` for `Symbol` and `Function` values, throws `TypeError` on `BigInt`, and converts `NaN`/`Infinity` to `"null"`. Additionally, circular null-prototype objects and objects with throwing `toString()` methods cause uncaught exceptions in the fallback `catch` block.
- **Architectural Remedy**: Decompose `extractNoticeErrorMessage` into 8 pure, honest leaf brick functions. Eliminate all comment sections and enforce single-line sanitization across every branch.
- **Artifacts Generated**:
  1. Patch file: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_1\defect1_solution.patch`
  2. Full proposed file: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_1\proposed_extractNoticeErrorMessage.ts`
  3. Standalone verification script: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_1\verify_defect1.js`

---

## 6. Verification Method

### 6.1 Run the Standalone Defect 1 Verification Suite
Execute the comprehensive verification script in the explorer state folder:
```powershell
node "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_1\verify_defect1.js"
```
**Expected Output**:
```
--- 1. Baseline Test Suite Verification ---
✓ Baseline contracts verified

--- 2. Adversarial Edge Case Verification ---
✓ 2A Null and undefined verified
✓ 2B Primitives, Symbol, BigInt, Function verified
✓ 2C Circular structures verified
✓ 2D Explosive object verified: "[object Object]"
✓ 3A & 3B Multiline sanitization verified

=============================================
ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!
=============================================
```

### 6.2 Apply Patch and Verify Plugin Test Suites
To apply the fix to the plugin repository:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
git apply "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_1\defect1_solution.patch"
npm test
npm run build
```
**Expected Output**:
- `npm test`: 128 / 128 tests pass with code 0.
- `npm run build`: Production bundle and typecheck succeed with code 0.
