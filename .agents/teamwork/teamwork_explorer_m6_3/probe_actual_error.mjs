import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// 2. Import Wanim & Compiler & Runtime Core
const wanimUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/index.js').href;
const wanim = await import(wanimUrl);

const compilerUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/compiler.js').href;
const { compilePython } = await import(compilerUrl);

const pyRuntimeUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/py-runtime.browser.js').href;
const { createRuntimeCore, installPythonShims } = await import(pyRuntimeUrl);

const npUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/numpy-ts/dist/esm/index.js').href;
const np = await import(npUrl);

const runtimeCore = createRuntimeCore({ wanim, np, NDArray: np.NDArray });
const runtime = runtimeCore.buildRuntime();

// Install python shims on global prototypes
installPythonShims({
    Object: globalThis.Object,
    Array: globalThis.Array,
    String: globalThis.String,
    Number: globalThis.Number,
    Boolean: globalThis.Boolean,
    BigInt: globalThis.BigInt,
});

const sampleCode = `
from manim import *

class SquareToCircle(Scene):
    def construct(self):
        circle = Circle()
        square = Square()
        self.play(Create(square))
        self.play(Transform(square, circle))
        self.play(FadeOut(square))
`;

const compiled = await compilePython(sampleCode);

// Evaluate emitted JS with runtime.globals
const evalEnv = { ...runtime.globals, console };
const func = new Function(...Object.keys(evalEnv), compiled.js + '\nreturn SquareToCircle;');
const SceneClass = func(...Object.values(evalEnv));

console.log('SceneClass constructed:', SceneClass.name);

// Now render to canvas
const browserUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/browser.js').href;
const { render_scene_to_canvas } = await import(browserUrl);

function createMockCanvas() {
    const drawCalls = [];
    const ctx = new Proxy({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        setTransform: (...args) => drawCalls.push(['setTransform', args]),
        fillRect: (...args) => drawCalls.push(['fillRect', args]),
        clearRect: (...args) => drawCalls.push(['clearRect', args]),
    }, {
        get(target, prop) {
            if (prop in target) return target[prop];
            return (...args) => {
                drawCalls.push([String(prop), args]);
            };
        },
        set(target, prop, val) {
            target[prop] = val;
            return true;
        }
    });

    return {
        width: 1280,
        height: 720,
        style: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
        getContext: (type) => (type === '2d' ? ctx : null),
        _drawCalls: drawCalls,
    };
}

const canvas = createMockCanvas();
try {
    const result = await render_scene_to_canvas(SceneClass, canvas, {
        quality: '-ql',
        realtime: false,
        drawFrames: true,
    });
    console.log('RENDER SUCCESSFUL!');
    console.log('Stats:', result.stats);
    console.log('Total draw calls:', canvas._drawCalls.length);
} catch (err) {
    console.error('Caught error during render:', err);
}
