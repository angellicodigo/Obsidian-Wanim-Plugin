import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// 2. Setup mock browser DOM globals for headless runner
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.HTMLCanvasElement = class HTMLCanvasElement {};
function createGenericElement(tag) {
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
        contains: () => true,
        setAttribute: () => {},
        setAttributeNS: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        remove: () => {},
        getRootNode: () => globalThis.document,
    };
}

globalThis.document = {
    head: {
        querySelector: () => null,
        appendChild: () => {},
    },
    createElement: (tag) => {
        if (tag === 'iframe') {
            const sandbox = { console };
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
        return createGenericElement(tag);
    },
    createElementNS: (ns, tag) => createGenericElement(tag),
    body: {
        appendChild: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
};

// 3. Import runPythonOnCanvas
const bridgeUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/bridge.browser.js').href;
const { runPythonOnCanvas } = await import(bridgeUrl);

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

    const canvas = {
        width: 1280,
        height: 720,
        style: {},
        parentElement: {
            appendChild: () => {},
            removeChild: () => {},
            contains: () => true,
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getRootNode: () => globalThis.document,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
        getContext: (type) => (type === '2d' ? ctx : null),
        _drawCalls: drawCalls,
    };
    return canvas;
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

const canvas = createMockCanvas();
try {
    const res = await runPythonOnCanvas(sampleCode, canvas, {
        quality: '-ql',
        realtime: false,
        drawFrames: true,
    });
    console.log('runPythonOnCanvas 100% SUCCESS! sceneName:', res.sceneName);
    console.log('Stats:', res.stats);
    console.log('Draw calls:', canvas._drawCalls.length);
} catch (err) {
    console.error('ERROR:', err);
}
