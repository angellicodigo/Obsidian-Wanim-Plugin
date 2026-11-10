# Milestone 4 Defect 3 Investigation & Design Report

**Target Area**: Multiline Error Message Sanitization for Transient Obsidian Notice Popups  
**Investigator**: teamwork_explorer (Milestone 4 Defect 3 Explorer)  
**State Folder**: `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_3\`  
**Target File**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\ui\errorPanel.ts`  
**Reference Isolation Directory (READ-ONLY)**: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` (26/26 files untouched)  

---

## 1. Observation

### 1.1 Direct Defect Reproduction
Execution of the adversarial lifecycle test suite (`tests/adversarial_m4_error_lifecycle.ts` via `tests/run_m4_error_lifecycle.mjs`) reproduced the verbatim failure in Test 3B:

```
--- 3. Notice Formatting & UI Layout Safety ---
  ✓ 3A. Notice formatting adheres strictly to "Wanim render failed: <summary>" format
  ✗ FAIL: 3B. Transient Notice messages never contain multiline dumps
AssertionError [ERR_ASSERTION]: Notice message must NOT contain newline characters (multiline dump detected): "Wanim render failed: Error: Header summary\n  at frame1\n  at frame2\n  at frame3"
    at file:///C:/Users/angel/Notes/.obsidian/plugins/Obsidian%20Wanim%20Plugin/tests/dist/adversarial_m4_error_lifecycle.mjs:122211:14
```

### 1.2 Inspection of `src/ui/errorPanel.ts`
Inspection of `src/ui/errorPanel.ts:61-106` reveals how `extractNoticeErrorMessage` formats error inputs:

```typescript
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

### 1.3 Key Observations on Failure Modes:
1. **Standard `Error` Instances (Lines 87–91)**:
   When `error` is an `Error` instance with a multiline message (e.g. `new Error("Header summary\n  at frame1\n  at frame2")` or `new Error("LineA\r\nLineB")`), `error.message` is interpolated directly without removing `\n` or `\r`.
2. **Structured `WanimFormattedError` Objects (Lines 67–84)**:
   - Compile errors (`case 'compile'`): If `formatted.message` has multiline diagnostics (e.g. `"SyntaxError: unclosed bracket\nadditional detail line"`), `messageWithoutPrefix` retains the newline characters. Crucially, because `(line ${formatted.line})` is appended to the end of the template string, leaving newlines in `formatted.message` pushes `(line N)` onto the final line rather than keeping it with the primary error header.
   - Runtime errors (`case 'runtime'`): `${formatted.name}: ${formatted.message}` directly interpolates `formatted.message`, which contains multiline tracebacks in adversarial scenarios.
   - Generic errors (`case 'unknown'`): `formatted.message` is returned verbatim without sanitization.
3. **Strings with Standalone Carriage Returns `\r` (Lines 94–98)**:
   `trimmed.split(/\r?\n/)[0]` splits on `\n` or `\r\n`, but fails to split on standalone `\r` (old Mac line endings) or Unicode line terminators (`\u2028`, `\u2029`).
4. **UI Layout Contract Disconnect**:
   In `styles.css:325-342`, `.wanim-error-panel` is specifically configured with `white-space: pre-wrap; word-break: break-word; overflow: auto; max-height: 220px;` to display full multiline code snippets, carets, and stack traces directly below the canvas.
   Conversely, Obsidian's transient `Notice` popups are floating notification toasts positioned at the top-right of the viewport. Injecting multiline stack traces into `Notice` breaks toast layout, clobbers the editor workspace, and obscures active editing tabs.

---

## 2. Logic Chain

1. **Premise 1 (Single Responsibility & Level of Abstraction)**:
   Per RULE[user_global] (R5):
   - Functions must have local reasoning and honest signatures.
   - Low-level character parsing and line-splitting mechanics must not be inlined into high-level dispatch logic.
   - A dedicated pure leaf function (`sanitizeSingleLine`) should be extracted to encapsulate line splitting, trimming, and newline eradication.
2. **Premise 2 (Preserving Diagnostic Content)**:
   When an error message spans multiple lines, the most critical diagnostic information is almost universally located on the first non-empty line (e.g., `"ZeroDivisionError: division by zero"` or `"SyntaxError: unexpected token"`), while subsequent lines contain frame locations, source context, or traceback details.
   By finding the first line whose `.trim().length > 0`, we preserve the real failure reason even if an error message begins with leading blank lines or formatting whitespace.
3. **Premise 3 (Clean Component Composition)**:
   - For `compile` errors: `formatted.message` should be sanitized to a single line before stripping the `"SyntaxError:"` prefix and before appending `(line ${formatted.line})`. This ensures that the line number indicator remains affixed to the concise header on the single line.
   - For `runtime` errors: Both `formatted.name` and `formatted.message` are passed through `sanitizeSingleLine` before combining as `${name}: ${message}`.
   - For standard `Error` instances: Both `error.name` and `error.message` are passed through `sanitizeSingleLine`.
   - For string errors: `sanitizeSingleLine(error, 'An error occurred')` cleanly extracts the first line.
   - For unknown fallback: `JSON.stringify` and `String(error)` results are passed through `sanitizeSingleLine`. Furthermore, guarding `typeof JSON.stringify(error) === 'string'` avoids returning `undefined` for `Symbol` or `Function` values (Defect 1 synergy).
4. **Premise 4 (Zero Newline Invariant)**:
   The sanitizer splits on `/\r\n|[\r\n\u2028\u2029]/`, extracts the first non-empty trimmed line, and replaces any remaining embedded line break characters with a single space.
   This guarantees that the return value of `extractNoticeErrorMessage` and `formatRenderFailureNoticeMessage` contains strictly zero `\r` and zero `\n` characters.
5. **Premise 5 (No Artificial Length Truncation)**:
   Adversarial test 4A (`tests/adversarial_m4.ts:525-527`) explicitly tests 100,000-character single-line error strings and asserts `msg.length === 100000`. Therefore, `sanitizeSingleLine` must NOT slice or truncate the character length of a single-line string; its sole invariant is stripping newline and line break characters.

---

## 3. Caveats

- **No Caveats on Architecture**: The solution is completely pure, side-effect free, and adheres strictly to TypeScript strict mode.
- **Scope Boundary**: This investigation focuses on Defect 3 (`src/ui/errorPanel.ts`). While the proposed `extractNoticeErrorMessage` fallback also prevents Defect 1 (`Symbol` undefined serialization) from propagating to Notice toasts, the separate Defect 2 (throwing `toString()` in `src/engine/errorFormatter.ts:375`) occurs in a different module and should be fixed in `src/engine/errorFormatter.ts` by the designated explorer/fixer for Defect 2.

---

## 4. Conclusion & Proposed Implementation

### 4.1 Pure Leaf String Sanitizer Design
We design `sanitizeSingleLine`:

```typescript
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
		// Fall through to fallback if String(text) throws (e.g. throwing toString() or getter)
	}
	return fallback;
}
```

### 4.2 Updated `extractNoticeErrorMessage`
```typescript
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
```

### 4.3 Artifacts Created in State Folder
1. **Diff Patch**:
   `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_3\defect3_notice_sanitization.patch`
2. **Proposed Complete File**:
   `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_3\proposed_errorPanel.ts`
3. **Standalone Verification Test Suite**:
   `C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_3\test_sanitizer.mjs`

---

## 5. Verification Method

### 5.1 Standalone Test Suite Verification
Run the verification script validating all test 3B cases, 3A cases, 100,000-character strings, symbols, BigInt, and throwing objects:
```powershell
node "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m4_r2_3\test_sanitizer.mjs"
```
*Result*:
```
Notice output: "Wanim render failed: Error: Header summary"
Notice output: "Wanim render failed: Line 1 of error"
Notice output: "Wanim render failed: RuntimeError: First line of failure"
Notice output: "Wanim render failed: SyntaxError: unclosed bracket (line 10)"
Notice output: "Wanim render failed: Error: LineA"
Notice output: "Wanim render failed: DUMP"
--- ALL MULTILINE 3B TESTS PASSED ---
--- HUGE STRING TEST PASSED ---
--- ALL PRIMITIVE & SYMBOL TESTS PASSED ---
--- PATHOLOGICAL THROWING OBJECT PASSED ---

=======================================
ALL TESTS PASSED SUCCESSFULLY!
=======================================
```

### 5.2 Verification Against Adversarial Test 3B
Once applied by the implementer, run:
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
node tests/run_m4_error_lifecycle.mjs
```
*Expected Result*:
`✓ 3B. Transient Notice messages never contain multiline dumps` passes cleanly with zero assertion failures.

### 5.3 Baseline Regression & Isolation Verification
```powershell
cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
npm test
node scripts/verify-isolation.mjs
```
*Expected Result*: All 128 existing unit tests pass; 26/26 files in `obsidian-manim-plugin` remain untouched.
