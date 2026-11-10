import assert from 'node:assert';

export function sanitizeSingleLine(text, fallback = '') {
	if (!text) {
		return fallback;
	}
	const lines = String(text).split(/\r\n|[\r\n\u2028\u2029]/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			return trimmed.replace(/[\r\n\u2028\u2029]/g, ' ');
		}
	}
	return fallback;
}

export function extractNoticeErrorMessage(error) {
	if (error === null || error === undefined) {
		return 'An unknown execution error occurred';
	}

	if (typeof error === 'object' && error !== null && 'kind' in error) {
		const formatted = error;
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

	if (error instanceof Error) {
		const name = sanitizeSingleLine(error.name, 'Error');
		const message = sanitizeSingleLine(error.message, 'An unexpected error occurred');
		return `${name}: ${message}`;
	}

	if (typeof error === 'string') {
		return sanitizeSingleLine(error, 'An error occurred');
	}

	try {
		const serialized = JSON.stringify(error);
		if (typeof serialized === 'string') {
			return sanitizeSingleLine(serialized, 'An unexpected error occurred');
		}
	} catch {
		// Ignore serialization failures
	}

	try {
		return sanitizeSingleLine(String(error), 'An unexpected error occurred');
	} catch {
		return 'An unexpected error occurred';
	}
}

export function formatRenderFailureNoticeMessage(error) {
	const summary = extractNoticeErrorMessage(error);
	return `Wanim render failed: ${summary}`;
}

// -------------------------------------------------------------
// Test 3B cases
// -------------------------------------------------------------
const multilineErrors = [
	new Error('Header summary\n  at frame1\n  at frame2\n  at frame3'),
	'Line 1 of error\nLine 2 of error\nLine 3 of error',
	{
		kind: 'runtime',
		name: 'RuntimeError',
		message: 'First line of failure\nSecond line traceback\nThird line',
		cleanStack: ['at a', 'at b'],
		formattedText: '...',
	},
	{
		kind: 'compile',
		message: 'SyntaxError: unclosed bracket\nadditional detail line',
		filename: 'scene.py',
		line: 10,
		column: 4,
		sourceLine: 'foo(',
		caret: '   ^',
		formattedText: '...',
	},
	new Error('LineA\r\nLineB\r\nLineC'),
	Array(1000).fill('DUMP').join('\n'),
];

for (const err of multilineErrors) {
	const notice = formatRenderFailureNoticeMessage(err);
	console.log('Notice output:', JSON.stringify(notice));
	assert.ok(!notice.includes('\n'), 'Must not contain newline: ' + notice);
	assert.ok(!notice.includes('\r'), 'Must not contain carriage return: ' + notice);
}
console.log('--- ALL MULTILINE 3B TESTS PASSED ---');

// -------------------------------------------------------------
// Test 3A & Standard Cases
// -------------------------------------------------------------
assert.strictEqual(
	extractNoticeErrorMessage(new TypeError('Cannot read properties of null')),
	'TypeError: Cannot read properties of null'
);
assert.strictEqual(
	extractNoticeErrorMessage('Something bad happened\nline 2'),
	'Something bad happened'
);
assert.strictEqual(
	extractNoticeErrorMessage(null),
	'An unknown execution error occurred'
);
assert.strictEqual(
	extractNoticeErrorMessage(undefined),
	'An unknown execution error occurred'
);
assert.strictEqual(
	extractNoticeErrorMessage({ kind: 'unknown', message: '' }),
	'An unexpected execution error occurred'
);
assert.strictEqual(
	extractNoticeErrorMessage({
		kind: 'compile',
		message: 'SyntaxError: unexpected token',
		line: 12,
		column: 5,
		sourceSnippet: '    x = 1',
		caretLine: '        ^',
		formattedText: 'SyntaxError: unexpected token at line 12:5',
	}),
	'SyntaxError: unexpected token (line 12)'
);
assert.strictEqual(
	extractNoticeErrorMessage({
		kind: 'unsupported_import',
		module: 'subprocess',
		message: "Python module 'subprocess' is unavailable in browser Manim",
		formattedText: "ModuleNotFoundError: 'subprocess'",
	}),
	"Python module 'subprocess' is unavailable in browser Manim"
);
assert.strictEqual(
	extractNoticeErrorMessage({
		kind: 'runtime',
		name: 'ZeroDivisionError',
		message: 'division by zero',
		rawStack: '',
		sanitizedStack: '',
		formattedText: 'ZeroDivisionError: division by zero',
	}),
	'ZeroDivisionError: division by zero'
);

// -------------------------------------------------------------
// Huge String Test
// -------------------------------------------------------------
const hugeStr = 'X'.repeat(100000);
const msg3 = extractNoticeErrorMessage(hugeStr);
assert.strictEqual(msg3.length, 100000);
console.log('--- HUGE STRING TEST PASSED ---');

// -------------------------------------------------------------
// Primitives & Symbol
// -------------------------------------------------------------
const primitives = [
	42,
	-0,
	NaN,
	Infinity,
	true,
	false,
	9007199254740993n,
	Symbol('error_symbol'),
	[1, 2, 3],
	Object.create(null),
	() => 'func_error',
];

for (const prim of primitives) {
	const noticeMsg = extractNoticeErrorMessage(prim);
	assert.strictEqual(typeof noticeMsg, 'string');
	assert.ok(noticeMsg.length > 0);
	const failureNotice = formatRenderFailureNoticeMessage(prim);
	assert.ok(failureNotice.startsWith('Wanim render failed: '));
	assert.ok(!failureNotice.includes('undefined'), 'Must not include undefined');
}
console.log('--- ALL PRIMITIVE & SYMBOL TESTS PASSED ---');

// -------------------------------------------------------------
// Pathological throwing object
// -------------------------------------------------------------
const explosiveObject = {
	get message() { throw new Error('Getter failed!'); },
	get stack() { throw new Error('Stack failed!'); },
	toString() { throw new Error('toString failed!'); },
};
const bombNotice = extractNoticeErrorMessage(explosiveObject);
assert.strictEqual(typeof bombNotice, 'string');
assert.ok(bombNotice.length > 0);
console.log('--- PATHOLOGICAL THROWING OBJECT PASSED ---');

console.log('\n=======================================');
console.log('ALL TESTS PASSED SUCCESSFULLY!');
console.log('=======================================');
