const assert = require('assert');

// ============================================================================
// The Proposed Brick Decomposition for extractNoticeErrorMessage
// ============================================================================

function toSingleLineSummary(raw, fallback = 'An unexpected error occurred') {
    if (typeof raw !== 'string') return fallback;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return fallback;
    const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
    return firstLine.length > 0 ? firstLine : fallback;
}

function isWanimFormattedError(value) {
    if (typeof value !== 'object' || value === null) return false;
    try {
        return (
            value.kind === 'compile' ||
            value.kind === 'unsupported_import' ||
            value.kind === 'runtime' ||
            value.kind === 'unknown'
        );
    } catch {
        return false;
    }
}

function extractFromWanimFormatted(formatted) {
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

function extractFromErrorInstance(error) {
    try {
        const name = typeof error.name === 'string' && error.name.trim().length > 0 ? error.name.trim() : 'Error';
        const message = typeof error.message === 'string' && error.message.trim().length > 0 ? error.message.trim() : 'An unexpected error occurred';
        return `${name}: ${message}`;
    } catch {
        return 'Error: An unexpected error occurred';
    }
}

function isPrimitiveError(value) {
    const t = typeof value;
    return t === 'number' || t === 'boolean' || t === 'bigint' || t === 'symbol';
}

function extractFromPrimitive(value) {
    try {
        return String(value);
    } catch {
        return 'Primitive error';
    }
}

function extractFromFunction(fn) {
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

function extractFromUnknownObject(obj) {
    try {
        if ('message' in obj && typeof obj.message === 'string') {
            const msg = obj.message.trim();
            if (msg.length > 0) return msg;
        }
    } catch {}

    try {
        const serialized = JSON.stringify(obj);
        if (typeof serialized === 'string' && serialized.length > 0 && serialized !== '{}') {
            return serialized;
        }
    } catch {}

    try {
        const str = String(obj);
        if (typeof str === 'string' && str.length > 0 && str !== '[object Object]') {
            return str;
        }
    } catch {}

    try {
        const tag = Object.prototype.toString.call(obj);
        if (typeof tag === 'string' && tag.length > 0) return tag;
    } catch {}

    return 'Unknown object error';
}

function extractNoticeErrorMessage(error) {
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

function formatRenderFailureNoticeMessage(error) {
    const summary = extractNoticeErrorMessage(error);
    return `Wanim render failed: ${summary}`;
}

// ============================================================================
// Comprehensive Verification Suite
// ============================================================================
console.log('--- 1. Baseline Test Suite Verification ---');

// Check against tests/m4_test_runner.ts:
const compileErr = { kind: 'compile', message: 'SyntaxError: unexpected token', filename: 'scene.py', line: 12, column: 5, sourceLine: 'foo(', caret: '    ^', formattedText: '' };
assert.strictEqual(extractNoticeErrorMessage(compileErr), 'SyntaxError: unexpected token (line 12)');

const importErr = { kind: 'unsupported_import', module: 'matplotlib', line: 1, statement: 'import matplotlib', formattedText: '' };
assert.strictEqual(extractNoticeErrorMessage(importErr), "Python module 'matplotlib' is unavailable in browser Manim");

const runtimeErr = { kind: 'runtime', name: 'ZeroDivisionError', message: 'division by zero', cleanStack: [], formattedText: '' };
assert.strictEqual(extractNoticeErrorMessage(runtimeErr), 'ZeroDivisionError: division by zero');

assert.strictEqual(extractNoticeErrorMessage(new TypeError('Cannot read properties of null')), 'TypeError: Cannot read properties of null');
assert.strictEqual(extractNoticeErrorMessage('Something bad happened\nline 2'), 'Something bad happened');
assert.strictEqual(extractNoticeErrorMessage(null), 'An unknown execution error occurred');

// Check against tests/adversarial_m4_header.ts:
assert.strictEqual(extractNoticeErrorMessage(null), 'An unknown execution error occurred');
assert.strictEqual(extractNoticeErrorMessage(undefined), 'An unknown execution error occurred');
assert.strictEqual(extractNoticeErrorMessage({ kind: 'unknown', message: '' }), 'An unexpected execution error occurred');

// Check against tests/adversarial_m4.ts:
const circ = {}; circ.self = circ;
assert.ok(extractNoticeErrorMessage(circ).length > 0);
const bomb = { get message() { throw new Error('explosion'); } };
assert.ok(extractNoticeErrorMessage(bomb).length > 0);
const huge = 'X'.repeat(100000);
assert.strictEqual(extractNoticeErrorMessage(huge).length, 100000);
assert.strictEqual(formatRenderFailureNoticeMessage(new Error('Syntax bomb')), 'Wanim render failed: Error: Syntax bomb');
console.log('✓ Baseline contracts verified');

console.log('\n--- 2. Adversarial Edge Case Verification ---');

// 2A: Null & Undefined
assert.strictEqual(typeof extractNoticeErrorMessage(null), 'string');
assert.strictEqual(typeof extractNoticeErrorMessage(undefined), 'string');
assert.ok(extractNoticeErrorMessage(null).length > 0);
assert.ok(extractNoticeErrorMessage(undefined).length > 0);
console.log('✓ 2A Null and undefined verified');

// 2B: Primitives, Symbols, BigInt, Functions
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
    assert.ok(!failureNotice.includes('undefined'), 'Notice message must not contain literal undefined');
    assert.ok(!failureNotice.includes('\n'), 'Notice message must not contain newlines');
    assert.ok(!failureNotice.includes('\r'), 'Notice message must not contain carriage returns');
}
console.log('✓ 2B Primitives, Symbol, BigInt, Function verified');

// 2C: Circular references
const circA = { name: 'A' };
const circB = { name: 'B' };
circA.b = circB;
circB.a = circA;
const noticeCircA = extractNoticeErrorMessage(circA);
assert.strictEqual(typeof noticeCircA, 'string');
assert.ok(noticeCircA.length > 0);

const circArr = [];
circArr.push(circArr);
const noticeCircArr = extractNoticeErrorMessage(circArr);
assert.strictEqual(typeof noticeCircArr, 'string');
assert.ok(noticeCircArr.length > 0);
console.log('✓ 2C Circular structures verified');

// 2D: Explosive objects with throwing getters / toString
const explosiveObject = {
    get message() { throw new Error('Getter failed!'); },
    get stack() { throw new Error('Stack failed!'); },
    toString() { throw new Error('toString failed!'); }
};
const noticeExplosive = extractNoticeErrorMessage(explosiveObject);
assert.strictEqual(typeof noticeExplosive, 'string');
assert.ok(noticeExplosive.length > 0);
console.log('✓ 2D Explosive object verified:', JSON.stringify(noticeExplosive));

// 3A & 3B: Multiline sanitization & notice format
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
    const noticeMsg = formatRenderFailureNoticeMessage(err);
    assert.ok(noticeMsg.startsWith('Wanim render failed: '));
    assert.ok(!noticeMsg.includes('\n'), 'Notice message must NOT contain newline characters');
    assert.ok(!noticeMsg.includes('\r'), 'Notice message must NOT contain carriage return characters');
}
console.log('✓ 3A & 3B Multiline sanitization verified');

console.log('\n=============================================');
console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
console.log('=============================================');
