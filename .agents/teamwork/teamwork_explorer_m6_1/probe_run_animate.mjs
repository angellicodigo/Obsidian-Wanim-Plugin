import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// 2. Setup mock browser globals
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

if (!globalThis.HTMLElement) {
    globalThis.HTMLElement = class HTMLElement {};
}
if (!globalThis.HTMLCanvasElement) {
    globalThis.HTMLCanvasElement = class HTMLCanvasElement extends globalThis.HTMLElement {};
}

function createMockElement() {
    return {
        style: {},
        classList: {
            add: () => {},
            remove: () => {},
            toggle: () => {},
            contains: () => false,
        },
        appendChild: () => {},
        removeChild: () => {},
        remove: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        contains: () => true,
    };
}

if (!globalThis.document) {
    globalThis.document = {
        head: {
            querySelector: () => null,
            appendChild: () => {},
        },
        createElementNS: () => createMockElement(),
        createElement: (tag) => {
            if (tag === 'iframe') {
                const sandbox = {
                    console,
                };
                vm.createContext(sandbox);
                sandbox.eval = (code) => vm.runInContext(code, sandbox);
                sandbox.window = sandbox;
                sandbox.globalThis = sandbox;
                return {
                    style: {},
                    contentWindow: sandbox,
                    remove: () => {},
                };
            }
            if (tag === 'style') {
                return { textContent: '', remove: () => {} };
            }
            return createMockElement();
        },
        body: {
            appendChild: () => {},
            removeChild: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
    };
}

// 3. Import runPythonOnCanvas
const bridgeUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/bridge.browser.js').href;
const { runPythonOnCanvas } = await import(bridgeUrl);

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
    const mockEl = Object.assign(new globalThis.HTMLCanvasElement(), {
        width: 1280,
        height: 720,
        style: {},
        getRootNode: () => globalThis.document,
        parentElement: {
            appendChild: () => {},
            removeChild: () => {},
            contains: () => true,
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: (type) => (type === '2d' ? ctx : null),
        _drawCalls: drawCalls,
    });
    return mockEl;
}

const sampleCode = `
from manim import *

class AnimateSyntaxExample(Scene):
    def construct(self):
        s = Square(color=RED, fill_opacity=0.5)
        self.play(Create(s))
        self.play(s.animate.shift(RIGHT * 2).rotate(PI / 4).scale(1.5))
        self.play(s.animate.set_color(YELLOW))
        self.wait(0.5)
`;

const canvas = createMockCanvas();
try {
    const res = await runPythonOnCanvas(sampleCode, canvas, {
        quality: '-ql',
        realtime: false,
        drawFrames: true,
        preload: 'none',
    });
    console.log('runPythonOnCanvas SUCCESS! sceneName:', res.sceneName);
    console.log('Stats:', res.stats);
    console.log('Recorded canvas draw calls:', canvas._drawCalls.length);
} catch (err) {
    console.error('runPythonOnCanvas ERROR:', err);
}
