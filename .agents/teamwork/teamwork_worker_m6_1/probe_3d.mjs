import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const rapydscriptPath = path.resolve('node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.HTMLCanvasElement = class HTMLCanvasElement extends globalThis.HTMLElement {};

function createMockElement() {
  return {
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
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

globalThis.document = {
  head: { querySelector: () => null, appendChild: () => {} },
  createElementNS: () => createMockElement(),
  createElement: (tag) => {
    if (tag === 'iframe') {
      const sandbox = { console };
      vm.createContext(sandbox);
      sandbox.eval = (code) => vm.runInContext(code, sandbox);
      sandbox.window = sandbox;
      sandbox.globalThis = sandbox;
      return { style: {}, contentWindow: sandbox, remove: () => {} };
    }
    return createMockElement();
  },
  body: { appendChild: () => {}, removeChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
};

const bridgeUrl = pathToFileURL(path.resolve('node_modules/@wanimjs/wanim/browser/bridge.browser.js')).href;
const { runPythonOnCanvas } = await import(bridgeUrl);

const drawCalls = [];
const mockGradient = {
  addColorStop: (...args) => drawCalls.push(['addColorStop', args]),
};
const ctx = {
  fillStyle: '', strokeStyle: '', lineWidth: 1,
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
  createLinearGradient: (...args) => {
    drawCalls.push(['createLinearGradient', args]);
    return mockGradient;
  },
  createRadialGradient: (...args) => {
    drawCalls.push(['createRadialGradient', args]);
    return mockGradient;
  },
};

const canvas = Object.assign(new globalThis.HTMLCanvasElement(), {
  width: 1280, height: 720, style: {},
  getRootNode: () => globalThis.document,
  parentElement: { appendChild: () => {}, removeChild: () => {}, contains: () => true },
  addEventListener: () => {}, removeEventListener: () => {},
  getContext: () => ctx,
});

const source = `from manim import *

class BasicThreeDScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        sphere = Sphere(radius=1.0, color=BLUE)
        cube = Cube(side_length=1.5, color=RED).shift(RIGHT * 2)
        
        self.set_camera_orientation(phi=75 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(sphere), Create(cube))
        self.begin_ambient_camera_rotation(rate=0.2)
        self.wait(0.5)
`;

try {
  const res = await runPythonOnCanvas(source, canvas, { quality: '-ql', realtime: false, drawFrames: true, preload: 'none' });
  console.log('SUCCESS! 3D Scene rendered frames:', res.stats.frames, 'Draw calls:', drawCalls.length);
} catch (e) {
  console.error('ERROR in 3D Scene:', e);
}
