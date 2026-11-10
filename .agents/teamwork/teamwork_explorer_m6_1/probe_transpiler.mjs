import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');

const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

console.log('RapydScript loaded:', typeof globalThis.RapydScript?.compile === 'function');

// 2. Test compilePython
const compilerUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/compiler.js').href;
const { compilePython } = await import(compilerUrl);

const sampleCode = `
from manim import *

class SquareToCircle(Scene):
    def construct(self):
        circle = Circle()
        square = Square()
        square.flip(RIGHT)
        square.rotate(-3 * TAU / 8)
        circle.set_fill(PINK, opacity=0.5)

        self.play(Create(square))
        self.play(Transform(square, circle))
        self.play(FadeOut(square))
`;

try {
    const result = await compilePython(sampleCode);
    console.log('Compile SUCCESS!');
    console.log('Numpy names:', result.numpyNames);
    console.log('Emitted JS:\n', result.js);
} catch (err) {
    console.error('Compile ERROR:', err);
}
