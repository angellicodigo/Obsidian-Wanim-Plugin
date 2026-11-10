import assert from 'assert';
import {
  cleanStackTrace,
  buildSourceLineMap,
  formatCompileError,
  formatUnsupportedImport,
  formatRuntimeError,
  formatGenericError,
  formatWanimError
} from './proposed_errorFormatter.js';

console.log('--- TEST 1: cleanStackTrace ---');
const rawStack = `TypeError: Cannot read properties of undefined (reading 'animate')
    at SquareToCircle.construct (eval at <anonymous> (plugin:obsidian-wanim-plugin:123), <anonymous>:5:14)
    at CanvasSceneRenderer.render (plugin:obsidian-wanim-plugin:456)
    at runPythonOnCanvas (C:/Users/angel/wanim.browser.js:200:10)
    at ModuleJob.run (node:internal/modules/esm/module_job:437:25)
    at HTMLButtonElement.onclick (plugin:obsidian-wanim-plugin:789)`;

const cleaned = cleanStackTrace(rawStack);
console.log('Cleaned stack frames:', cleaned);
assert.strictEqual(cleaned.length, 1);
assert.strictEqual(cleaned[0], 'at SquareToCircle.construct (scene.py:5:14)');
console.log('TEST 1 PASSED!');

console.log('\n--- TEST 2: buildSourceLineMap ---');
const userCode = `from manim import *
import random
from math import sin, cos

class MyScene(Scene):
    def construct(self):
        c = Circle()`;

const map = buildSourceLineMap(userCode);
console.log('Line map length:', map.length);
// Line 1: from manim import * (1 line) -> map[0] = 1
// Line 2: import random (2 lines) -> map[1]=2, map[2]=2
// Line 3: from math import sin, cos (3 lines: stripped, math alias, sin, cos) -> map[3]=3, map[4]=3, map[5]=3, map[6]=3
// Line 4: empty line (1 line) -> map[7]=4
// Line 5: class MyScene (1 line) -> map[8]=5
assert.strictEqual(map[0], 1);
assert.strictEqual(map[1], 2);
assert.strictEqual(map[2], 2);
assert.strictEqual(map[map.length - 1], 7);
console.log('TEST 2 PASSED!');

console.log('\n--- TEST 3: formatCompileError with raw RapydScript error ---');
const rawError = {
  message: 'Inconsistent indentation',
  line: 9, // preprocessed line pointing to class MyScene
  col: 4,
  filename: 'scene.py'
};
const resCompile = formatCompileError(rawError, userCode);
console.log('Compile error formatted:\n' + resCompile.formattedText);
assert.strictEqual(resCompile.kind, 'compile');
assert.strictEqual(resCompile.line, 5); // mapped back to original user line 5!
assert.strictEqual(resCompile.column, 5); // 1-based display column
assert.strictEqual(resCompile.sourceLine, 'class MyScene(Scene):');
assert.strictEqual(resCompile.caret, '    ^');
console.log('TEST 3 PASSED!');

console.log('\n--- TEST 4: formatCompileError with wrapped wanim error message ---');
const wrappedError = new Error(`Inconsistent indentation\n  scene.py:9:5\n\nclass MyScene(Scene):\n    ^`);
const resWrapped = formatCompileError(wrappedError, userCode);
console.log('Wrapped error formatted:\n' + resWrapped.formattedText);
assert.strictEqual(resWrapped.kind, 'compile');
assert.strictEqual(resWrapped.line, 5);
assert.strictEqual(resWrapped.sourceLine, 'class MyScene(Scene):');
console.log('TEST 4 PASSED!');

console.log('\n--- TEST 5: formatUnsupportedImport ---');
const importErr = new Error(`wanim: cannot use Python module 'os' (line 1: import os).\nOnly the manim API...`);
const resImport = formatUnsupportedImport(importErr);
console.log('Import error formatted:\n' + resImport.formattedText);
assert.strictEqual(resImport.kind, 'unsupported_import');
assert.strictEqual(resImport.module, 'os');
assert.strictEqual(resImport.line, 1);
assert.strictEqual(resImport.statement, 'import os');
console.log('TEST 5 PASSED!');

console.log('\n--- TEST 6: formatRuntimeError ---');
const runtimeErr = new TypeError("Cannot read properties of null (reading 'get_center')");
runtimeErr.stack = `TypeError: Cannot read properties of null (reading 'get_center')\n    at SquareToCircle.construct (eval at <anonymous> (plugin:obsidian:1), <anonymous>:8:10)`;
const resRuntime = formatRuntimeError(runtimeErr);
console.log('Runtime error formatted:\n' + resRuntime.formattedText);
assert.strictEqual(resRuntime.kind, 'runtime');
assert.strictEqual(resRuntime.name, 'TypeError');
assert.strictEqual(resRuntime.cleanStack.length, 1);
assert.strictEqual(resRuntime.cleanStack[0], 'at SquareToCircle.construct (scene.py:8:10)');
console.log('TEST 6 PASSED!');

console.log('\n--- TEST 7: formatWanimError dispatcher ---');
const d1 = formatWanimError(importErr, userCode);
assert.strictEqual(d1.kind, 'unsupported_import');

const d2 = formatWanimError(rawError, userCode);
assert.strictEqual(d2.kind, 'compile');

const d3 = formatWanimError(runtimeErr, userCode);
assert.strictEqual(d3.kind, 'runtime');

const d4 = formatWanimError('Some weird error string', userCode);
assert.strictEqual(d4.kind, 'unknown');

const d5 = formatWanimError(null, userCode);
assert.strictEqual(d5.kind, 'unknown');
console.log('TEST 7 PASSED!');

console.log('\nALL 7 TESTS PASSED WITH 100% SUCCESS!');
