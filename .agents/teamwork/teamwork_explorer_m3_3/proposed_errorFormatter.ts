/**
 * Compilation error and runtime traceback formatter for the Wanim execution engine.
 * Pure formatting functions adhering to R5 architectural guidelines.
 */

export type WanimErrorKind = 'compile' | 'unsupported_import' | 'runtime' | 'unknown';

export interface FormattedCompileError {
    readonly kind: 'compile';
    readonly message: string;
    readonly filename: string;
    readonly line: number;
    readonly column: number;
    readonly sourceLine: string;
    readonly caret: string;
    readonly formattedText: string;
}

export interface FormattedImportError {
    readonly kind: 'unsupported_import';
    readonly module: string;
    readonly line: number;
    readonly statement: string;
    readonly formattedText: string;
}

export interface FormattedRuntimeError {
    readonly kind: 'runtime';
    readonly name: string;
    readonly message: string;
    readonly cleanStack: readonly string[];
    readonly formattedText: string;
}

export interface FormattedGenericError {
    readonly kind: 'unknown';
    readonly message: string;
    readonly formattedText: string;
}

export type WanimFormattedError =
    | FormattedCompileError
    | FormattedImportError
    | FormattedRuntimeError
    | FormattedGenericError;

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
    /render_presentation_to_canvas/,
    /createRuntimeCore/,
    /buildRuntime/,
    /installPythonShims/,
    /create_compiler/,
    /HTMLButtonElement\.onclick/,
    /WanimExecutionController/
];

/**
 * Filter raw stack trace lines, stripping engine internals and normalizing eval frames.
 */
export function cleanStackTrace(rawStack: string): string[] {
    if (!rawStack || typeof rawStack !== 'string') {
        return [];
    }

    const lines = rawStack.split(/\r?\n/);
    const cleaned: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (i === 0 && !line.startsWith('at ')) {
            continue;
        }
        if (!line.startsWith('at ')) {
            continue;
        }

        // First normalize eval and anonymous references to scene.py
        const normalizedLine = line
            .replace(/\(eval at [^,]+, <anonymous>:(\d+:\d+)\)/, '(scene.py:$1)')
            .replace(/\(eval at [^)]+\)/, '')
            .replace(/<anonymous>:(\d+:\d+)/, 'scene.py:$1');

        // Then check if the normalized frame is purely an engine/browser internal
        const isInternal = INTERNAL_STACK_PATTERNS.some(pattern => pattern.test(normalizedLine));
        if (isInternal) {
            continue;
        }

        cleaned.push(normalizedLine.trim());
    }

    return cleaned;
}

/**
 * Build a lookup map of preprocessed line index to original source line number (1-based).
 */
export function buildSourceLineMap(source: string): number[] {
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
            .map(part => part.trim())
            .filter(part => part.length > 0).length;
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const origNum = i + 1;

        if (PAREN_FROM_IMPORT.test(line)) {
            while (!/\)/.test(line) && i + 1 < lines.length) {
                i++;
                line += '\n' + lines[i];
            }
            line = line.replace(/\n/g, ' ');
        }

        if (NUMPY_FROM.test(line) || NUMPY_IMPORT.test(line) || MANIM_FROM.test(line) || MANIM_IMPORT.test(line)) {
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
        if (rndFrom) {
            lineMap.push(origNum);
            if (!randomEmitted) {
                lineMap.push(origNum);
                randomEmitted = true;
            }
            const spec = rndFrom[1].trim();
            if (spec === '*') {
                for (let k = 0; k < RANDOM_PUBLIC_COUNT; k++) lineMap.push(origNum);
            } else {
                const count = countFromImports(spec);
                for (let k = 0; k < count; k++) lineMap.push(origNum);
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
        if (mFrom) {
            lineMap.push(origNum);
            if (!mathEmitted) {
                lineMap.push(origNum);
                mathEmitted = true;
            }
            const spec = mFrom[1].trim();
            if (spec === '*') {
                for (let k = 0; k < MATH_PUBLIC_COUNT; k++) lineMap.push(origNum);
            } else {
                const count = countFromImports(spec);
                for (let k = 0; k < count; k++) lineMap.push(origNum);
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
        if (itFrom) {
            lineMap.push(origNum);
            if (!itertoolsEmitted) {
                lineMap.push(origNum);
                itertoolsEmitted = true;
            }
            const spec = itFrom[1].trim();
            if (spec === '*') {
                for (let k = 0; k < ITERTOOLS_PUBLIC_COUNT; k++) lineMap.push(origNum);
            } else {
                const count = countFromImports(spec);
                for (let k = 0; k < count; k++) lineMap.push(origNum);
            }
            continue;
        }

        lineMap.push(origNum);
    }

    return lineMap;
}

/**
 * Format a compilation or syntax error from RapydScript.
 */
export function formatCompileError(error: unknown, source: string): FormattedCompileError {
    const raw = (error && typeof error === 'object' ? error : {}) as RawRapydScriptError;
    const rawMessage = typeof raw.message === 'string' ? raw.message : String(error);

    // If message is already formatted by wanim formatCompileError:
    // e.g. "Inconsistent indentation\n  scene.py:8:23\n\n    def construct(self)\n                      ^"
    const parsedPattern = /^([^\n]+)\n\s+([^\s:]+):(\d+):(\d+)(?:\n\n([^\n]*)\n([^\n]*))?/;
    const parsedMatch = rawMessage.match(parsedPattern);

    let message = rawMessage;
    let filename = DEFAULT_FILENAME;
    let reportedLine = typeof raw.line === 'number' ? raw.line : 1;
    let reportedCol = typeof raw.col === 'number' ? raw.col : 0;

    if (parsedMatch) {
        message = parsedMatch[1].trim();
        filename = parsedMatch[2].trim();
        reportedLine = parseInt(parsedMatch[3], 10);
        reportedCol = Math.max(0, parseInt(parsedMatch[4], 10) - 1);
    }

    // Remap preprocessed line back to original source line
    const sourceLines = source.split(/\r?\n/);
    const lineMap = buildSourceLineMap(source);
    const originalLineIndex = reportedLine - 1;
    const mappedLine = originalLineIndex >= 0 && originalLineIndex < lineMap.length
        ? lineMap[originalLineIndex]
        : reportedLine;

    const sourceLine = (mappedLine >= 1 && mappedLine <= sourceLines.length)
        ? sourceLines[mappedLine - 1]
        : (parsedMatch?.[5] ?? '');

    const safeCol = Math.min(reportedCol, sourceLine.length);
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
        formattedText
    };
}

/**
 * Format an unsupported import error into a user-friendly diagnostic.
 */
export function formatUnsupportedImport(error: unknown): FormattedImportError | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/wanim:\s+cannot\s+use\s+Python\s+module\s+'([^']+)'\s+\(line\s+(\d+):\s+([^)]+)\)/);
    if (!match) {
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
        'Standard library modules (os, sys, json) and third-party packages are unavailable.'
    ].join('\n');

    return {
        kind: 'unsupported_import',
        module,
        line,
        statement,
        formattedText
    };
}

/**
 * Format a runtime exception thrown during scene construction or animation.
 */
export function formatRuntimeError(error: unknown): FormattedRuntimeError {
    const err = error instanceof Error ? error : new Error(String(error));
    const name = err.name || 'RuntimeError';
    const message = err.message || 'An unexpected error occurred during execution';
    const cleanStack = cleanStackTrace(err.stack || '');

    const stackBlock = cleanStack.length > 0
        ? '\n' + cleanStack.map(s => '  ' + s).join('\n')
        : '';

    const formattedText = `${name}: ${message}${stackBlock}`;

    return {
        kind: 'runtime',
        name,
        message,
        cleanStack,
        formattedText
    };
}

/**
 * Format generic or unknown error objects.
 */
export function formatGenericError(error: unknown): FormattedGenericError {
    const message = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : JSON.stringify(error));

    return {
        kind: 'unknown',
        message,
        formattedText: `Error: ${message}`
    };
}

/**
 * High-level error dispatcher: identifies the error category and formats it cleanly for the red panel.
 */
export function formatWanimError(error: unknown, source: string): WanimFormattedError {
    if (error === null || error === undefined) {
        return formatGenericError('Unknown empty error');
    }

    // 1. Check for unsupported import error
    const importError = formatUnsupportedImport(error);
    if (importError) {
        return importError;
    }

    // 2. Check for RapydScript compile/syntax error
    const isCompileError =
        (typeof error === 'object' && error !== null && 'line' in error && 'col' in error) ||
        (error instanceof Error && (
            error.message.includes('Inconsistent indentation') ||
            error.message.includes('Unexpected token') ||
            error.message.includes('scene.py:') ||
            error.name === 'SyntaxError'
        ));

    if (isCompileError) {
        return formatCompileError(error, source);
    }

    // 3. Runtime error with stack or standard Error instance
    if (error instanceof Error) {
        return formatRuntimeError(error);
    }

    // 4. Fallback generic error
    return formatGenericError(error);
}
