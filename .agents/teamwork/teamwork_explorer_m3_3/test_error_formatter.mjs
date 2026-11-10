import fs from "fs";
import { pathToFileURL } from "url";

// Load RapydScript
const rapydscriptSource = fs.readFileSync('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js', 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init(globalThis);

const { preprocessImports, formatUnsupportedImportError, unsupportedImportError } = await import(pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/preprocess.js').href);
const { formatCompileError: wanimFormatCompileError } = await import(pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/compile_error.js').href);

// Pure Stack Filter Function
function cleanStackTrace(rawStack) {
  if (!rawStack || typeof rawStack !== 'string') return [];
  const lines = rawStack.split(/\r?\n/);
  const internalPatterns = [
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
    /create_compiler/
  ];

  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip error name/message line at the beginning
    if (i === 0 && !line.startsWith('at ')) continue;
    if (!line.startsWith('at ')) continue;

    // Check if line matches internal engine frames
    const isInternal = internalPatterns.some(pat => pat.test(line));
    if (isInternal) continue;

    // Clean up eval / anonymous syntax for display
    const cleanedLine = line
      .replace(/\(eval at [^,]+, <anonymous>:(\d+:\d+)\)/, '(scene.py:$1)')
      .replace(/<anonymous>:(\d+:\d+)/, 'scene.py:$1');

    cleaned.push(cleanedLine);
  }
  return cleaned;
}

// Pure Line Mapping Function
function buildSourceLineMap(source) {
  const lines = source.split(/\r?\n/);
  const lineMap = []; // index in preprocessed lines -> 1-based original source line

  const pre = preprocessImports(source);
  const preLines = pre.code.split(/\r?\n/);

  // We can align by matching lines or by tracing the preprocessing steps
  // If no imports were expanded or stripped, 1:1
  // Let's create an accurate line-by-line tracker:
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

  function parseFromNames(spec) {
    return spec.replace(/[()]/g, " ").split(",").map(p => p.trim()).filter(p => p.length > 0).map(p => {
      const alias = p.split(/\s+as\s+/);
      const name = alias[0].trim();
      return [name, (alias.length > 1 ? alias[1] : name).trim()];
    });
  }

  // Pre-fetch public names length
  const MATH_LEN = 60;
  const RANDOM_LEN = 26;
  const ITERTOOLS_LEN = 20;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const origNum = i + 1;

    if (PAREN_FROM_IMPORT.test(line)) {
      while (!/\)/.test(line) && i + 1 < lines.length) {
        i++;
        line += "\n" + lines[i];
      }
      line = line.replace(/\n/g, " ");
    }

    if (NUMPY_FROM.test(line) || NUMPY_IMPORT.test(line) || MANIM_FROM.test(line) || MANIM_IMPORT.test(line)) {
      lineMap.push(origNum);
      continue;
    }

    const rndImport = line.match(RANDOM_IMPORT);
    if (rndImport) {
      lineMap.push(origNum); // stripped
      if (!randomEmitted) { lineMap.push(origNum); randomEmitted = true; }
      const alias = rndImport[2];
      if (alias !== undefined && alias !== "random") lineMap.push(origNum);
      continue;
    }

    const rndFrom = line.match(RANDOM_FROM);
    if (rndFrom) {
      lineMap.push(origNum); // stripped
      if (!randomEmitted) { lineMap.push(origNum); randomEmitted = true; }
      const pairs = parseFromNames(rndFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < RANDOM_LEN; k++) lineMap.push(origNum);
        } else {
          lineMap.push(origNum);
        }
      }
      continue;
    }

    const mImport = line.match(MATH_IMPORT);
    if (mImport) {
      lineMap.push(origNum); // stripped
      if (!mathEmitted) { lineMap.push(origNum); mathEmitted = true; }
      const alias = mImport[2];
      if (alias !== undefined && alias !== "math") lineMap.push(origNum);
      continue;
    }

    const mFrom = line.match(MATH_FROM);
    if (mFrom) {
      lineMap.push(origNum); // stripped
      if (!mathEmitted) { lineMap.push(origNum); mathEmitted = true; }
      const pairs = parseFromNames(mFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < MATH_LEN; k++) lineMap.push(origNum);
        } else {
          lineMap.push(origNum);
        }
      }
      continue;
    }

    const itImport = line.match(ITERTOOLS_IMPORT);
    if (itImport) {
      lineMap.push(origNum); // stripped
      if (!itertoolsEmitted) { lineMap.push(origNum); itertoolsEmitted = true; }
      const alias = itImport[2];
      if (alias !== undefined && alias !== "itertools") lineMap.push(origNum);
      continue;
    }

    const itFrom = line.match(ITERTOOLS_FROM);
    if (itFrom) {
      lineMap.push(origNum); // stripped
      if (!itertoolsEmitted) { lineMap.push(origNum); itertoolsEmitted = true; }
      const pairs = parseFromNames(itFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < ITERTOOLS_LEN; k++) lineMap.push(origNum);
        } else {
          lineMap.push(origNum);
        }
      }
      continue;
    }

    lineMap.push(origNum);
  }

  return { lineMap, preLinesCount: preLines.length };
}

console.log("=== Testing Stack Filter ===");
const sampleStack = `TypeError: Cannot read properties of null (reading 'get_center')
    at MyScene.helper (eval at testStack (file:///C:/Users/angel/test.mjs:18:16), <anonymous>:9:15)
    at MyScene.construct (eval at testStack (file:///C:/Users/angel/test.mjs:18:16), <anonymous>:6:14)
    at eval (eval at testStack (file:///C:/Users/angel/test.mjs:18:16), <anonymous>:13:11)
    at runPythonOnCanvas (C:/Users/angel/wanim.browser.js:200:10)
    at ModuleJob.run (node:internal/modules/esm/module_job:437:25)`;

const cleaned = cleanStackTrace(sampleStack);
console.log("Cleaned Stack:", cleaned);

console.log("\n=== Testing Line Map for Math and Random ===");
const codeWithImports = `from manim import *
from math import *
import random

class MyScene(Scene):
    def construct(self):
        c = Circle()
`;
const { lineMap, preLinesCount } = buildSourceLineMap(codeWithImports);
console.log("Preprocessed lines:", preLinesCount, "LineMap length:", lineMap.length, "Matches?", preLinesCount === lineMap.length);

const origLines = codeWithImports.split("\n");
console.log("Original line 5 is:", origLines[4]);
// Find index in preLines where 'class MyScene' occurs
const pre = preprocessImports(codeWithImports);
const classPreIndex = pre.code.split("\n").findIndex(l => l.includes("class MyScene"));
console.log("Preprocessed index for class MyScene:", classPreIndex + 1);
console.log("Mapped original line for class MyScene:", lineMap[classPreIndex]);
console.log("Matches original line 5?", lineMap[classPreIndex] === 5);
