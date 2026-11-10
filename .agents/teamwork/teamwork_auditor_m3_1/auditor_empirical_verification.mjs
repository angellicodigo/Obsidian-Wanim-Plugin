import assert from 'node:assert';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pluginRoot = 'C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin';

const wanimCoreUrl = pathToFileURL(`${pluginRoot}/node_modules/@wanimjs/wanim/dist/index.js`).href;
const wanimBridgeUrl = pathToFileURL(`${pluginRoot}/node_modules/@wanimjs/wanim/browser/bridge.browser.js`).href;
const m3DistUrl = pathToFileURL(`${pluginRoot}/tests/dist/m3_test_runner.mjs`).href;

console.log('--- AUDITOR EMPIRICAL VERIFICATION SCRIPT ---');

// Test A: Real create_frame_scheduler behavior
console.log('Test A: Testing create_frame_scheduler from real @wanimjs/wanim package...');
const { create_frame_scheduler } = await import(wanimCoreUrl);
assert.strictEqual(typeof create_frame_scheduler, 'function');
const baseSched = create_frame_scheduler({ fps: 60 });
assert.strictEqual(typeof baseSched.next_frame, 'function');
assert.strictEqual(typeof baseSched.cancel, 'function');
console.log('✓ create_frame_scheduler successfully created authentic Wanim scheduler.');

// Test B: Verify PausableScheduler wrapping real create_frame_scheduler
console.log('Test B: Verifying PausableScheduler with authentic Wanim scheduler...');
const m3Dist = await import(m3DistUrl);

const PausableScheduler = m3Dist.PausableScheduler;
const createPausableScheduler = m3Dist.createPausableScheduler;

assert.strictEqual(typeof createPausableScheduler, 'function');
const pausable = createPausableScheduler(60);
assert.strictEqual(pausable.isPaused(), false);
assert.strictEqual(pausable.isRunning(), true);
assert.strictEqual(pausable.isCancelled(), false);

// Test frame progression on real scheduler
let frameTickDone = false;
const framePromise = pausable.next_frame().then(() => {
    frameTickDone = true;
});

await new Promise(r => setTimeout(r, 40));
assert.strictEqual(frameTickDone, true, 'Real scheduler next_frame tick completed');

// Test pause on real scheduler
pausable.pause();
assert.strictEqual(pausable.isPaused(), true);
assert.strictEqual(pausable.isRunning(), false);

let pausedTickDone = false;
const pausedPromise = pausable.next_frame().then(() => {
    pausedTickDone = true;
});

await new Promise(r => setTimeout(r, 60));
assert.strictEqual(pausedTickDone, false, 'next_frame remains suspended while paused on real scheduler');

// Resume on real scheduler
pausable.resume();
assert.strictEqual(pausable.isPaused(), false);
await pausedPromise;
assert.strictEqual(pausedTickDone, true, 'next_frame unblocks on resume on real scheduler');

pausable.cancel();
assert.strictEqual(pausable.isCancelled(), true);
console.log('✓ PausableScheduler flawlessly interfaces with real @wanimjs/wanim frame scheduler.');

// Test C: Test runPythonOnCanvas bridge authenticity
console.log('Test C: Testing runPythonOnCanvas bridge integration...');
const { runPythonOnCanvas } = await import(wanimBridgeUrl);
assert.strictEqual(typeof runPythonOnCanvas, 'function');

// Create mock canvas
let fillRectCalled = false;
let ctxTransform = null;
const mockCanvas = {
    width: 1280,
    height: 720,
    getContext: (type) => {
        if (type === '2d') {
            return {
                setTransform: (...args) => { ctxTransform = args; },
                fillRect: () => { fillRectCalled = true; },
                clearRect: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
            };
        }
        return null;
    }
};

let sceneReadyObject = null;
const pythonSource = `
from manim import *

class SquareScene(Scene):
    def construct(self):
        s = Square()
        self.play(Create(s))
`;

try {
    const runResult = await runPythonOnCanvas(pythonSource, mockCanvas, {
        fps: 30,
        quality: '-qm',
        realtime: false,
        onSceneReady: (scene) => {
            sceneReadyObject = scene;
        }
    });
    console.log('runPythonOnCanvas result sceneName:', runResult?.sceneName);
    assert.strictEqual(runResult?.sceneName, 'SquareScene');
    assert.ok(sceneReadyObject !== null, 'onSceneReady was invoked with authentic Scene instance');
    assert.strictEqual(typeof sceneReadyObject.set_run_scheduler, 'function');
    console.log('✓ runPythonOnCanvas successfully compiled Python Manim and invoked Scene.construct.');
} catch (err) {
    console.error('runPythonOnCanvas threw:', err);
    throw err;
}

console.log('ALL EMPIRICAL AUDITOR VERIFICATION CHECKS PASSED!');
