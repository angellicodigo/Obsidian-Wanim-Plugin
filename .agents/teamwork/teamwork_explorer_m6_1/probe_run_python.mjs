import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 1. Initialize Rapydscript
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// 2. Setup mock document for iframe sandbox
if (!globalThis.document) {
    globalThis.document = {
        createElement: (tag) => {
            if (tag === 'iframe') {
                const win = {
                    console,
                    Object,
                    Array,
                    String,
                    Number,
                    Boolean,
                    BigInt,
                    Math,
                    Date,
                    RegExp,
                    eval: (code) => {
                        const fn = new Function(...Object.keys(win), code);
                        return fn(...Object.values(win));
                    },
                };
                win.window = win;
                win.globalThis = win;
                return {
                    style: {},
                    contentWindow: win,
                    remove: () => {},
                };
            }
            return {};
        },
        body: {
            appendChild: () => {},
        },
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

const canvas = createMockCanvas();
try {
    const res = await runPythonOnCanvas(sampleCode, canvas, {
        quality: '-ql',
        realtime: false,
        drawFrames: true,
    });
    console.log('runPythonOnCanvas SUCCESS! sceneName:', res.sceneName);
    console.log('Stats:', res.stats);
} catch (err) {
    console.error('runPythonOnCanvas ERROR:', err);
}
