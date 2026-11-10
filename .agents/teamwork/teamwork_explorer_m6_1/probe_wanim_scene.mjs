import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// 2. Import Wanim & Py-Runtime Core
const wanimUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/index.js').href;
const wanim = await import(wanimUrl);

const numpyUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/numpy-ts/dist/esm/index.js').href;
const np = await import(numpyUrl);

const runtimeCoreUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/runtime_core.js').href;
const { createRuntimeCore } = await import(runtimeCoreUrl);

const compilerUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/compiler.js').href;
const { compilePython } = await import(compilerUrl);

const browserUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/browser.js').href;
const { render_scene_to_canvas } = await import(browserUrl);

const core = createRuntimeCore({ wanim, np, NDArray: np.NDArray });
const runtime = core.buildRuntime();

console.log('runtime globals count:', Object.keys(runtime.globals).length);
console.log('Circle in globals:', typeof runtime.globals.Circle);

function createMockCanvas() {
    const drawCalls = [];
    const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        setTransform: (...args) => drawCalls.push(['setTransform', args]),
        fillRect: (...args) => drawCalls.push(['fillRect', args]),
        clearRect: (...args) => drawCalls.push(['clearRect', args]),
        beginPath: () => drawCalls.push(['beginPath']),
        closePath: () => drawCalls.push(['closePath']),
        moveTo: (...args) => drawCalls.push(['moveTo', args]),
        lineTo: (...args) => drawCalls.push(['lineTo', args]),
        bezierCurveTo: (...args) => drawCalls.push(['bezierCurveTo', args]),
        stroke: () => drawCalls.push(['stroke']),
        fill: () => drawCalls.push(['fill']),
        save: () => drawCalls.push(['save']),
        restore: () => drawCalls.push(['restore']),
        scale: (...args) => drawCalls.push(['scale', args]),
        translate: (...args) => drawCalls.push(['translate', args]),
        rotate: (...args) => drawCalls.push(['rotate', args]),
        arc: (...args) => drawCalls.push(['arc', args]),
    };
    return {
        width: 1280,
        height: 720,
        getContext: (type) => (type === '2d' ? ctx : null),
        _drawCalls: drawCalls,
    };
}

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

const evalEnv = { ...runtime.globals, console };
const func = new Function(...Object.keys(evalEnv), compiled.js + '\nreturn SquareToCircle;');
const SceneClass = func(...Object.values(evalEnv));

console.log('SceneClass successfully evaluated:', SceneClass.name);

const canvas = createMockCanvas();
const result = await render_scene_to_canvas(SceneClass, canvas, {
    quality: '-ql',
    realtime: false,
    drawFrames: true,
});

console.log('RENDER SUCCESSFUL! Total frames:', result.stats.frames);
console.log('Total canvas draw operations recorded:', canvas._drawCalls.length);
