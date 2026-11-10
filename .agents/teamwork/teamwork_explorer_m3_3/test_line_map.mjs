import fs from "fs";
import { pathToFileURL } from "url";

const { preprocessImports } = await import(pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/preprocess.js').href);

function createSourceLineMap(source) {
  // We can track the original line number for each line pushed to out.
  // We can do this either by inspecting what preprocessImports emits or mirroring its line-by-line step.
  const lines = source.split("\n");
  const lineMap = []; // 0-indexed in preprocessed lines -> 1-indexed in source
  
  // Let's trace how many lines each original line generates:
  let randomAliasEmitted = false;
  let mathAliasEmitted = false;
  let itertoolsAliasEmitted = false;

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

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const origLineNum = i + 1;

    if (PAREN_FROM_IMPORT.test(line)) {
      let joined = line;
      while (!/\)/.test(joined) && i + 1 < lines.length) {
        i += 1;
        joined += "\n" + lines[i];
      }
      line = joined.replace(/\n/g, " ");
    }

    if (NUMPY_FROM.test(line) || NUMPY_IMPORT.test(line) || MANIM_FROM.test(line) || MANIM_IMPORT.test(line)) {
      lineMap.push(origLineNum);
      continue;
    }

    const randomImport = line.match(RANDOM_IMPORT);
    if (randomImport) {
      lineMap.push(origLineNum);
      if (!randomAliasEmitted) { lineMap.push(origLineNum); randomAliasEmitted = true; }
      const alias = randomImport[2];
      if (alias !== undefined && alias !== "random") lineMap.push(origLineNum);
      continue;
    }

    const randomFrom = line.match(RANDOM_FROM);
    if (randomFrom) {
      lineMap.push(origLineNum);
      if (!randomAliasEmitted) { lineMap.push(origLineNum); randomAliasEmitted = true; }
      const pairs = parseFromNames(randomFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < 18; k++) lineMap.push(origLineNum);
        } else {
          lineMap.push(origLineNum);
        }
      }
      continue;
    }

    const mathImport = line.match(MATH_IMPORT);
    if (mathImport) {
      lineMap.push(origLineNum);
      if (!mathAliasEmitted) { lineMap.push(origLineNum); mathAliasEmitted = true; }
      const alias = mathImport[2];
      if (alias !== undefined && alias !== "math") lineMap.push(origLineNum);
      continue;
    }

    const mathFrom = line.match(MATH_FROM);
    if (mathFrom) {
      lineMap.push(origLineNum);
      if (!mathAliasEmitted) { lineMap.push(origLineNum); mathAliasEmitted = true; }
      const pairs = parseFromNames(mathFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < 43; k++) lineMap.push(origLineNum);
        } else {
          lineMap.push(origLineNum);
        }
      }
      continue;
    }

    const itertoolsImport = line.match(ITERTOOLS_IMPORT);
    if (itertoolsImport) {
      lineMap.push(origLineNum);
      if (!itertoolsAliasEmitted) { lineMap.push(origLineNum); itertoolsAliasEmitted = true; }
      const alias = itertoolsImport[2];
      if (alias !== undefined && alias !== "itertools") lineMap.push(origLineNum);
      continue;
    }

    const itertoolsFrom = line.match(ITERTOOLS_FROM);
    if (itertoolsFrom) {
      lineMap.push(origLineNum);
      if (!itertoolsAliasEmitted) { lineMap.push(origLineNum); itertoolsAliasEmitted = true; }
      const pairs = parseFromNames(itertoolsFrom[1]);
      for (const [name] of pairs) {
        if (name === "*") {
          for (let k = 0; k < 19; k++) lineMap.push(origLineNum);
        } else {
          lineMap.push(origLineNum);
        }
      }
      continue;
    }

    // Normal line
    lineMap.push(origLineNum);
  }

  return lineMap;
}

const testCode = 'from manim import *\nfrom math import *\nclass S(Scene):\n    def construct(self):\n        pass';
const res = preprocessImports(testCode);
const preLines = res.code.split('\n');
const map = createSourceLineMap(testCode);

console.log('Preprocessed lines count:', preLines.length);
console.log('Map length:', map.length);
console.log('Match lengths?', preLines.length === map.length);
console.log('Class line preprocessed index:', preLines.findIndex(l => l.includes('class S')));
console.log('Original line mapped for Class line:', map[preLines.findIndex(l => l.includes('class S'))]);
