# Milestone 3 Handoff Report: Wanim Execution Engine & Canvas Bridge Integration

## 1. Observation

### 1.1 `runPythonOnCanvas` Signature & Execution Flow
Inspection of `@wanimjs/wanim@0.1.3` in `node_modules/@wanimjs/wanim/browser/bridge.browser.js` (lines 1–2) and `dist/bridge.d.ts` (lines 20–95) reveals the exact browser execution bridge contract:

```ts
export function runPythonOnCanvas(
    source: string,
    canvas: HTMLCanvasElement,
    options?: RunPythonOptions
): Promise<RunPythonResult>;
```

#### `RunPythonOptions` Parameter Map
- `quality?: string`: Resolution & framerate flag (`"-ql"`, `"-qm"`, `"-qh"`, `"-q4k"`; defaults to `"-qm"`).
- `realtime?: boolean`: Yield to browser between frames via `requestAnimationFrame` (defaults to `true`).
- `fps?: number`: Target logical animation framerate (defaults to `30`).
- `signal?: AbortSignal`: Standard `AbortSignal` for aborting execution.
- `onSceneReady?: (scene: unknown) => void`: Callback triggered immediately after constructing each `Scene` instance and attaching its scheduler, prior to running `construct()` or the animation loop.
- `onController?: (controller: unknown) => void`: Callback returning navigation controller handle (`next()`, `previous()`, `replay()`, `restart()`, `abort()`).
- `onScene?: (name: string) => void`: Callback with scene class name when activated.
- `theme?: "light" | "dark" | "auto"`: Accessible as `self.theme` in Python `setup()`.
- `background?: string`: CSS hex background override.

#### Execution Pipeline Inside `runPythonOnCanvas`
From `node_modules/@wanimjs/wanim/browser/bridge.browser.js` (function `Z`):
1. **Compilation**: Calls `compilePython(source)` using bundled RapydScript AST compiler (`<15ms`).
2. **Preloading**: Preloads MathJax and fonts if detected in source via `preload_submodules`.
3. **Sandbox Setup**: Creates an isolated, hidden `<iframe>` element (`t = document.createElement("iframe"); t.style.display = "none"; document.body.appendChild(t)`), injects globals (`wanim`, `numpy-ts`, Python runtime shims), and executes compiled JavaScript via `i.win.eval(a)`.
4. **Scene Discovery**: Inspects iframe window to identify all subclasses of `Scene`.
5. **Presentation Execution**: Calls `render_presentation_to_canvas(scenes, canvas, options)`.
6. **Teardown**: Executes `finally { i.frame.remove(); }` ensuring zero leaked iframes in the DOM.

---

### 1.2 Quality Flag & Canvas Resolution Mapping
In `node_modules/@wanimjs/wanim/dist/renderer/scene_runner.js` (lines 26–46):
```js
export const QUALITY_FLAGS = {
    "-ql": ["low", 854, 480, 15],
    "-qm": ["medium", 1280, 720, 30],
    "-qh": ["high", 1920, 1080, 60],
    "-q4k": ["4k", 3840, 2160, 60],
};
export function apply_quality(flag = "-qm") {
    const entry = QUALITY_FLAGS[flag];
    if (entry === undefined) {
        const error = new Error(`unknown quality flag: ${flag}`);
        error.name = "ValueError";
        throw error;
    }
    const [label, pixelWidth, pixelHeight, frameRate] = entry;
    config.pixel_width = pixelWidth;
    config.pixel_height = pixelHeight;
    config.frame_rate = frameRate;
    return label;
}
```

These correspond to:
- `"-ql"` (Low): 854 × 480 @ 15 fps (Widescreen 480p, aspect ratio 1.779)
- `"-qm"` (Medium - Default): 1280 × 720 @ 30 fps (HD 720p, aspect ratio 16:9)
- `"-qh"` (High): 1920 × 1080 @ 60 fps (Full HD 1080p, aspect ratio 16:9)
- `"-q4k"` (4K): 3840 × 2160 @ 60 fps (Ultra HD 4K, aspect ratio 16:9)

---

### 1.3 Canvas Resolution & 16:9 Aspect Ratio Management
From `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\styles.css` (lines 273–315):
```css
.wanim-canvas,
.wanim-canvas-container {
    aspect-ratio: 16 / 9;
    margin-top: 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    background: #000000;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.wanim-canvas-mount canvas,
.wanim-canvas canvas,
.wanim-canvas-container canvas {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    margin: 0 auto;
    object-fit: contain;
}
```

In `node_modules/@wanimjs/wanim/dist/browser.js` (lines 214–215):
```js
canvas.width = camera.pixel_width;
canvas.height = camera.pixel_height;
```
When `runPythonOnCanvas` runs, it updates the canvas's internal drawing buffer dimensions (`canvas.width` and `canvas.height`) to match `camera.pixel_width` and `camera.pixel_height`. Responsive CSS ensures that the canvas dynamically scales to fit its container while preserving exact 16:9 proportions and preventing layout shifts or stretched pixels via `object-fit: contain`.

---

### 1.4 Cooperative Frame Scheduling & Pausing Mechanism
From `node_modules/@wanimjs/wanim/dist/scene/scene.js` (lines 311–343, 875–919):
```js
active_scheduler() {
    return this._run_scheduler ?? get_render_scheduler();
}
set_run_scheduler(scheduler) {
    this._run_scheduler = scheduler;
}
async play_internal_async(skip_rendering, scheduler) {
    if (scheduler.cancelled) return;
    this.time_progression = this._get_animation_time_progression(this.animations, duration);
    for (const t of this.time_progression) {
        this.update_to_time(t);
        if (!skip_rendering && !this.skip_animation_preview) {
            this.renderer?.render(this, t, this.moving_mobjects);
        }
        if (scheduler.cancelled) break;
        await scheduler.next_frame();
        if (scheduler.cancelled) break;
    }
}
```

In `node_modules/@wanimjs/wanim/dist/browser.js` (lines 240–248):
```js
// Attach the scheduler explicitly instead of installing a global one: a
// second presentation on the same page must not steal this run's pacing.
scene.set_run_scheduler(scheduler);
...
options.onSceneReady?.(scene);
```

When `options.onSceneReady(scene)` executes, the embedder can invoke:
```ts
(scene as any).set_run_scheduler(customScheduler);
```
By providing a custom `PausableScheduler` implementing `RenderScheduler` (which wraps `create_frame_scheduler`), `next_frame()` can await a `pausePromise`. Calling `pause()` freezes animation progress mid-frame on the canvas without tearing down state or resetting time progression. Calling `resume()` resolves the promise, allowing the loop to continue smoothly from the exact same frame.

---

### 1.5 Abort & Restart Mechanism
From `node_modules/@wanimjs/wanim/dist/browser.js` (lines 159–163) and `dist/interactive/presentation.js` (lines 127–131, 163–165):
```js
const onAbort = () => {
    scheduler?.cancel();
    controller?.abort();
};
options.signal?.addEventListener("abort", onAbort, { once: true });
```
In `ScenePresentation.run()`:
```js
for (;;) {
    if (this.abortRequested) break;
    ...
}
```
When `abortController.abort()` is called:
1. `scheduler.cancel()` marks `cancelled = true`, unblocking `next_frame()`.
2. `controller.abort()` marks `abortRequested = true`.
3. The presentation run loop cleanly terminates at the frame boundary and executes its `finally` blocks without throwing unhandled exceptions.
4. Restarting simply aborts the current run, awaits its completion, resets canvas context, and launches a fresh `runPythonOnCanvas` call.

---

### 1.6 Error Emission and Formatting Pipeline
Inspecting `node_modules/@wanimjs/wanim/dist/compile_error.js` (lines 2–19) and `dist/preprocess.js` (lines 300–314):
1. **Compilation / Syntax Errors**:
   RapydScript syntax errors produce formatted messages with filename, line, column, code snippet, and caret pointer `^`:
   ```
   Inconsistent indentation
     scene.py:2:23

       def construct(self)
                         ^
   ```
2. **Unsupported Imports**:
   Imports other than `manim`, `numpy`, `random`, `math`, and `itertools` (e.g., `import os`) trigger `formatUnsupportedImportError`:
   ```
   wanim: cannot use Python module 'os' (line 1: import os).
   Only the manim API, numpy, and the Python 'random', 'math' and 'itertools' modules are available in the browser/JS runtime...
   ```
3. **Runtime Exceptions**:
   Runtime errors thrown during `construct(self)` or animation execution bubble up as standard JavaScript `Error` objects (`TypeError`, `ReferenceError`, etc.).
4. **Display**:
   `formatWanimError` sanitizes internal iframe/eval frames (`eval at S`, `HTMLIFrameElement`, `bridge.browser.js`) while preserving the error name, description, and caret pointers for `.wanim-error-panel`.

---

## 2. Logic Chain

1. **Canvas Resolution Mapping**:
   - *Observation*: `QUALITY_FLAGS` in `scene_runner.js:27` defines dimensions and framerates for `"-ql"`, `"-qm"`, `"-qh"`, and `"-q4k"`.
   - *Deduction*: A pure leaf function `resolveCanvasDimensionsByQuality(quality: string)` backed by a constant map `canvasDimensionsByQuality` can resolve `{ width, height, fps }` deterministically, defaulting to `"-qm"` (1280 × 720 @ 30 fps) for unknown inputs.

2. **Aspect Ratio Preservation**:
   - *Observation*: `.wanim-canvas-container` defines `aspect-ratio: 16 / 9; width: 100%`, and the child canvas uses `object-fit: contain`.
   - *Deduction*: Initializing `canvas.width` and `canvas.height` prior to execution via `prepareCanvasDimensions` guarantees zero layout shift or visual popping across resolutions.

3. **Non-Destructive Pausing & Resuming**:
   - *Observation*: `Scene.play_internal_async` calls `await scheduler.next_frame()` on each frame. `onSceneReady(scene)` is invoked before `construct()` runs and before frames are rendered.
   - *Deduction*: Injecting a `PausableScheduler` into `scene.set_run_scheduler` via `onSceneReady` allows `next_frame()` to await a pause promise. When paused, the canvas stays visually frozen. When resumed, the promise resolves and playback proceeds from that exact timestamp without resetting mobjects or transforms.

4. **Clean Abort & Restart**:
   - *Observation*: Passing an `AbortSignal` to `runPythonOnCanvas` cancels the scheduler and sets `controller.abortRequested = true`, terminating the presentation loop gracefully.
   - *Deduction*: To implement `restart()`, the execution controller aborts the current run, awaits its exit, resets the canvas 2D context via `clearCanvas`, instantiates a fresh `AbortController` and `PausableScheduler`, and starts a new run.

5. **Asynchronous Execution Controller Ergonomics**:
   - *Observation*: `runPythonOnCanvas` returns a `Promise` that remains unresolved for the entire duration of the animation presentation.
   - *Deduction*: If `executeWanimScene` awaited the completion of `runPythonOnCanvas`, the caller would receive the `WanimExecutionController` only AFTER the animation finished, making playback controls (Pause/Restart) impossible while the animation is running. Therefore, `executeWanimScene` must create and return the `WanimExecutionController` immediately upon launching the run, allowing the caller to invoke `pause()`, `resume()`, and `restart()` during playback.

6. **Architectural Guidelines (R5) Compliance**:
   - *Observation*: User guidelines require local reasoning, honest leaf functions, single level of abstraction, invariant-rich types, and `{value}By{key}` map naming.
   - *Deduction*:
     - Map lookup named `canvasDimensionsByQuality`.
     - Leaf functions (`resolveCanvasDimensionsByQuality`, `formatWanimError`, `extractErrorLocation`) have zero external state dependencies.
     - `WanimExecutionControllerImpl` stacks discrete brick methods (`executeRunLoop`, `prepareCanvasDimensions`, `clearCanvas`).
     - State encoded into invariant union type `PlaybackState = 'idle' | 'running' | 'paused' | 'finished' | 'aborted' | 'error'`.

---

## 3. Caveats

1. **User Custom Camera Frames**:
   If a user defines a scene subclass that overrides default camera dimensions to a non-16:9 ratio (e.g. square 1:1 camera), the output will be letterboxed inside the 16:9 container due to `object-fit: contain`. This is standard Manim behavior.
2. **Multiple Scene Subclasses**:
   When Python code declares multiple `Scene` subclasses, `runPythonOnCanvas` sequences them into a storyboard presentation. Because `onSceneReady` is invoked for each constructed scene, injecting `scene.set_run_scheduler(this.scheduler)` in `onSceneReady` correctly applies the `PausableScheduler` to all scenes in the presentation sequence.
3. **Preloading Latency**:
   The first execution of complex LaTeX formulas (`MathTex`) triggers MathJax submodule loading (`preload_submodules("mathjax")`). Subsequent runs reuse the cached MathJax instance synchronously.

---

## 4. Conclusion & Concrete File Designs

Milestone 3 should be structured into three modular files under `src/engine/`:
1. `src/engine/pausableScheduler.ts`: Cooperative frame scheduler implementing `RenderScheduler` with pause/resume capability.
2. `src/engine/errorFormatter.ts`: Honest leaf utilities for parsing RapydScript errors, unsupported imports, and sanitized tracebacks.
3. `src/engine/wanimBridge.ts`: Core bridge module with `resolveCanvasDimensionsByQuality`, canvas lifecycle management, and `executeWanimScene`.

### Proposed Implementation Code

#### 4.1 `src/engine/pausableScheduler.ts`
```ts
/**
 * Pausable frame scheduler integrating with @wanimjs/wanim's cooperative frame loop.
 * Implements RenderScheduler to allow pausing and resuming live animations without state destruction.
 * Adheres to R5 architectural guidelines (honest leaf functions, explicit dependency injection).
 */

import { create_frame_scheduler, RenderScheduler } from '@wanimjs/wanim';

export interface PausableSchedulerController extends RenderScheduler {
	pause(): void;
	resume(): void;
	isPaused(): boolean;
	isRunning(): boolean;
}

export class PausableScheduler implements PausableSchedulerController {
	readonly async = true;
	private _cancelled = false;
	private _paused = false;
	private pausePromise: Promise<void> | null = null;
	private resumeResolver: (() => void) | null = null;
	private readonly baseScheduler: RenderScheduler;

	constructor(fps = 30) {
		this.baseScheduler = create_frame_scheduler({ fps });
	}

	get cancelled(): boolean {
		return this._cancelled;
	}

	isPaused(): boolean {
		return this._paused;
	}

	isRunning(): boolean {
		return !this._cancelled && !this._paused;
	}

	pause(): void {
		if (!this._paused && !this._cancelled) {
			this._paused = true;
			this.pausePromise = new Promise<void>((resolve) => {
				this.resumeResolver = resolve;
			});
		}
	}

	resume(): void {
		if (this._paused) {
			this._paused = false;
			if (this.resumeResolver) {
				const resolve = this.resumeResolver;
				this.resumeResolver = null;
				this.pausePromise = null;
				resolve();
			}
		}
	}

	async next_frame(): Promise<void> {
		if (this._cancelled) {
			return;
		}
		if (this._paused && this.pausePromise) {
			await this.pausePromise;
		}
		if (this._cancelled) {
			return;
		}
		await this.baseScheduler.next_frame();
	}

	cancel(): void {
		this._cancelled = true;
		this.baseScheduler.cancel();
		if (this.resumeResolver) {
			const resolve = this.resumeResolver;
			this.resumeResolver = null;
			this.pausePromise = null;
			resolve();
		}
	}
}

/**
 * Honest factory function to construct a PausableScheduler.
 * Signature as truth: accepts target fps, returns fresh PausableScheduler instance.
 */
export function createPausableScheduler(fps = 30): PausableScheduler {
	return new PausableScheduler(fps);
}
```

---

#### 4.2 `src/engine/errorFormatter.ts`
```ts
/**
 * Error formatting and inspection utilities for Wanim execution errors.
 * Formats RapydScript compilation errors, unsupported import errors, and runtime tracebacks.
 * Adheres to R5 architectural guidelines (pure honest leaf functions, no hidden side effects).
 */

export interface ErrorLocation {
	readonly line: number;
	readonly column: number;
}

/**
 * Honest leaf function that extracts line and column offsets from a compile or runtime error.
 * Pure function: reads only explicitly declared parameter, returns immutable ErrorLocation or null.
 */
export function extractErrorLocation(error: unknown): ErrorLocation | null {
	if (!error || typeof error !== 'object') {
		return null;
	}
	const err = error as Record<string, unknown>;
	if (typeof err.line === 'number' && typeof err.col === 'number') {
		return { line: Math.max(1, err.line), column: Math.max(0, err.col) };
	}
	if (typeof err.message === 'string') {
		const match = err.message.match(/scene\.py:(\d+):(\d+)/);
		if (match && match[1] && match[2]) {
			return { line: parseInt(match[1], 10), column: parseInt(match[2], 10) };
		}
		const importMatch = err.message.match(/\(line\s+(\d+):/);
		if (importMatch && importMatch[1]) {
			return { line: parseInt(importMatch[1], 10), column: 1 };
		}
	}
	return null;
}

/**
 * Strips internal browser/iframe/eval noise from stack traces, keeping relevant Python/JS frames.
 * Pure leaf helper.
 */
export function sanitizeStackTrace(stack: string): string {
	return stack
		.split('\n')
		.filter((line) => {
			const l = line.toLowerCase();
			return (
				!l.includes('bridge.browser.js') &&
				!l.includes('py-runtime.browser.js') &&
				!l.includes('eval at s') &&
				!l.includes('htmliframeelement') &&
				!l.includes('node_modules')
			);
		})
		.join('\n')
		.trim();
}

/**
 * Honest leaf function that formats any caught Wanim exception into a clean, human-readable
 * string for presentation in .wanim-error-panel.
 * Pure function: guarantees string return, handles RapydScript caret pointers, unsupported imports,
 * and sanitized stack traces.
 */
export function formatWanimError(error: unknown): string {
	if (!error) {
		return 'Unknown execution error occurred.';
	}
	if (typeof error === 'string') {
		return error.trim();
	}
	if (error instanceof Error) {
		const msg = error.message.trim();
		// Caret pointer or structured compile error
		if (msg.includes('^') || msg.includes('wanim: cannot use')) {
			return msg;
		}
		// Runtime exception with stack trace
		if (error.stack) {
			const cleanStack = sanitizeStackTrace(error.stack);
			if (cleanStack.length > 0 && cleanStack !== error.message) {
				return cleanStack;
			}
		}
		return `${error.name}: ${msg}`;
	}
	return String(error);
}
```

---

#### 4.3 `src/engine/wanimBridge.ts`
```ts
/**
 * Wanim Canvas Bridge: integrates @wanimjs/wanim browser execution with HTML5 Canvas.
 * Follows R5 Architectural Guidelines:
 * - Local reasoning & honest functions (resolveCanvasDimensionsByQuality, prepareCanvasDimensions, clearCanvas)
 * - Single uniform level of abstraction ("stacking bricks")
 * - Invariant-rich types (CanvasDimensions, PlaybackState)
 * - Map naming convention: canvasDimensionsByQuality ({value}By{key})
 */

import { runPythonOnCanvas, RunPythonOptions } from '@wanimjs/wanim/bridge';
import { RenderQuality, WanimExecutionController, WanimRunOptions } from '../types';
import { ensureRapydscriptInitialized } from './rapydscriptInit';
import { createPausableScheduler, PausableScheduler } from './pausableScheduler';
import { formatWanimError } from './errorFormatter';

export type PlaybackState = 'idle' | 'running' | 'paused' | 'finished' | 'aborted' | 'error';

export interface CanvasDimensions {
	readonly width: number;
	readonly height: number;
	readonly fps: number;
}

export interface WanimBridgeOptions extends WanimRunOptions {
	readonly onStateChange?: (state: PlaybackState) => void;
	readonly onError?: (formattedError: string) => void;
	readonly onFinished?: () => void;
}

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Lookup dictionary mapping quality flags to resolution and framerate.
 * Follows {value}By{key} naming convention.
 */
export const canvasDimensionsByQuality: Readonly<
	Record<RenderQuality, CanvasDimensions>
> = Object.freeze({
	'-ql': Object.freeze({ width: 854, height: 480, fps: 15 }),
	'-qm': Object.freeze({ width: 1280, height: 720, fps: 30 }),
	'-qh': Object.freeze({ width: 1920, height: 1080, fps: 60 }),
	'-q4k': Object.freeze({ width: 3840, height: 2160, fps: 60 }),
});

const DEFAULT_DIMENSIONS: CanvasDimensions = canvasDimensionsByQuality['-qm'];

/**
 * Honest leaf helper that resolves canvas dimensions and frame rate for a given quality flag.
 * Pure function: reads only explicit parameter, mutates nothing, returns immutable CanvasDimensions.
 */
export function resolveCanvasDimensionsByQuality(quality: string): CanvasDimensions {
	if (typeof quality === 'string' && quality in canvasDimensionsByQuality) {
		return canvasDimensionsByQuality[quality as RenderQuality];
	}
	return DEFAULT_DIMENSIONS;
}

/**
 * Prepares the canvas internal buffer resolution to match target quality dimensions.
 * Boundary DOM mutation function: isolated side effect at program edge.
 */
export function prepareCanvasDimensions(
	canvas: HTMLCanvasElement,
	dimensions: CanvasDimensions
): void {
	if (canvas.width !== dimensions.width) {
		canvas.width = dimensions.width;
	}
	if (canvas.height !== dimensions.height) {
		canvas.height = dimensions.height;
	}
}

/**
 * Clears the canvas drawing buffer to a solid black background.
 * Boundary DOM mutation function.
 */
export function clearCanvas(
	canvas: HTMLCanvasElement,
	dimensions: CanvasDimensions
): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return;
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, dimensions.width, dimensions.height);
}

// ============================================================================
// Execution Controller (Discrete Orchestration Bricks)
// ============================================================================

export class WanimExecutionControllerImpl implements WanimExecutionController {
	private source: string;
	private readonly canvas: HTMLCanvasElement;
	private readonly quality: RenderQuality;
	private readonly dimensions: CanvasDimensions;
	private readonly options: WanimBridgeOptions;

	private state: PlaybackState = 'idle';
	private abortController: AbortController;
	private scheduler: PausableScheduler;
	private activeRunPromise: Promise<void> | null = null;
	private isDisposed = false;

	constructor(options: WanimBridgeOptions, dimensions: CanvasDimensions) {
		this.options = options;
		this.source = options.source;
		this.canvas = options.canvas;
		this.quality = options.quality;
		this.dimensions = dimensions;
		this.abortController = new AbortController();
		this.scheduler = createPausableScheduler(dimensions.fps);
	}

	isRunning(): boolean {
		return this.state === 'running' || this.state === 'paused';
	}

	isPaused(): boolean {
		return this.state === 'paused';
	}

	getState(): PlaybackState {
		return this.state;
	}

	updateSource(newSource: string): void {
		this.source = newSource;
	}

	pause(): void {
		if (this.state !== 'running' || this.isDisposed) {
			return;
		}
		this.scheduler.pause();
		this.transitionState('paused');
	}

	resume(): void {
		if (this.state !== 'paused' || this.isDisposed) {
			return;
		}
		this.scheduler.resume();
		this.transitionState('running');
	}

	async play(): Promise<void> {
		if (this.isDisposed) {
			return;
		}
		if (this.state === 'paused') {
			this.resume();
			return;
		}
		if (this.state === 'running' && this.activeRunPromise) {
			return this.activeRunPromise;
		}
		this.activeRunPromise = this.executeRunLoop();
		return this.activeRunPromise;
	}

	async restart(): Promise<void> {
		if (this.isDisposed) {
			return;
		}
		this.abortCurrentRun();
		if (this.activeRunPromise) {
			try {
				await this.activeRunPromise;
			} catch {
				// Suppress abort rejection on restart
			}
		}
		this.abortController = new AbortController();
		this.scheduler = createPausableScheduler(this.dimensions.fps);
		clearCanvas(this.canvas, this.dimensions);
		return this.play();
	}

	stop(): void {
		this.abortCurrentRun();
		this.transitionState('aborted');
	}

	dispose(): void {
		if (this.isDisposed) {
			return;
		}
		this.isDisposed = true;
		this.stop();
		clearCanvas(this.canvas, this.dimensions);
	}

	private abortCurrentRun(): void {
		this.scheduler.cancel();
		this.abortController.abort();
	}

	private transitionState(newState: PlaybackState): void {
		this.state = newState;
		this.options.onStateChange?.(newState);
	}

	private async executeRunLoop(): Promise<void> {
		this.transitionState('running');
		prepareCanvasDimensions(this.canvas, this.dimensions);

		const runOptions: RunPythonOptions = {
			quality: this.quality,
			fps: this.dimensions.fps,
			realtime: true,
			signal: this.abortController.signal,
			onSceneReady: (scene: unknown) => {
				const sceneWithScheduler = scene as {
					set_run_scheduler?: (s: unknown) => void;
				};
				if (typeof sceneWithScheduler.set_run_scheduler === 'function') {
					sceneWithScheduler.set_run_scheduler(this.scheduler);
				}
				this.options.onSceneReady?.(scene);
			},
		};

		try {
			await runPythonOnCanvas(this.source, this.canvas, runOptions);
			if (this.abortController.signal.aborted) {
				this.transitionState('aborted');
			} else {
				this.transitionState('finished');
				this.options.onFinished?.();
			}
		} catch (error) {
			if (this.abortController.signal.aborted) {
				this.transitionState('aborted');
			} else {
				this.transitionState('error');
				const formatted = formatWanimError(error);
				this.options.onError?.(formatted);
			}
		} finally {
			this.activeRunPromise = null;
		}
	}
}

// ============================================================================
// Top-Level Orchestration (Table of Contents)
// ============================================================================

/**
 * High-level orchestrator that boots the Wanim execution engine and initiates scene playback.
 * Reads like a table of contents: validates inputs, bootstraps RapydScript, configures canvas,
 * instantiates controller, and launches the execution loop.
 */
export async function executeWanimScene(
	options: WanimBridgeOptions
): Promise<WanimExecutionController> {
	ensureRapydscriptInitialized();
	const dimensions = resolveCanvasDimensionsByQuality(options.quality);
	prepareCanvasDimensions(options.canvas, dimensions);
	const controller = new WanimExecutionControllerImpl(options, dimensions);
	void controller.play();
	return controller;
}
```

---

## 5. Verification Method

To independently verify these designs and contracts:

1. **Verify Resolution Map & Pure Leaf Functions**:
   Run:
   ```bash
   node C:\Users\angel\AppData\Local\Temp\wanim_inspect\test_m3_design.js
   ```
   *Expected output*: `✓ resolveCanvasDimensionsByQuality tests passed`, `✓ formatWanimError tests passed`, and `✓ PausableScheduler cancel during pause test passed`.

2. **Verify Error Formatting & Stack Sanitization**:
   Run:
   ```bash
   node C:\Users\angel\AppData\Local\Temp\wanim_inspect\test_error_formatter.js
   ```
   *Expected output*: `✓ errorFormatter tests passed successfully!`.

3. **Verify Execution Controller State Machine**:
   Run:
   ```bash
   node C:\Users\angel\AppData\Local\Temp\wanim_inspect\test_controller_state_machine.js
   ```
   *Expected output*: `✓ Controller state machine simulation tests passed successfully!`.

4. **Verify TypeScript Build Integrity**:
   Once implemented in Milestone 3, execute inside `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin`:
   ```bash
   npm run build
   ```
   *Expected output*: Zero TypeScript diagnostics, generating clean `main.js`.
