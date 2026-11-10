# Milestone 6 Handoff Report: Manim Community Scene Suite & Wanim Transpilation Compatibility

## 1. Observation

### 1.1 Wanim Engine Architecture & Transpiler Pipeline
Direct inspection of `@wanimjs/wanim` (0.1.3) within `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\node_modules\@wanimjs\wanim\` reveals the core compilation and runtime pipeline:

1. **Compilation Pipeline (`dist/compiler.js:55-75`)**:
   ```javascript
   export async function compilePython(source) {
       const pre = preprocessImports(source);
       const importError = unsupportedImportError(pre);
       if (importError !== null)
           throw importError;
       try {
           const js = await getRapydScript().compile(pre.code, "scene.py", {
               operator_overloading: true,
               await_scene_methods: true,
               python_extensions: true,
               python_truthiness: true,
               bare: true,
               beautify: true,
           });
           return { js, numpyNames: pre.numpyNames };
       }
       catch (error) {
           throw formatCompileError(error, pre.code);
       }
   }
   ```
   - `await_scene_methods: true` automatically rewrites synchronous Python calls such as `self.play(...)` and `self.wait(...)` into `await self.play(...)` and turns `def construct(self):` into `async function construct()`.
   - `python_extensions: true` enables starred unpacking (`[*a]`), multi-dim slicing (`a[:, 1]`), complex literals (`1.5j`), and `@` matrix multiplication.
   - `python_truthiness: true` routes conditionals through `ρσ_bool`, ensuring empty lists/dicts/arrays are falsy as in CPython.

2. **Import Preprocessing & Whitelist (`dist/preprocess.js:44-56`)**:
   - Explicitly supported native modules: `manim`, `numpy`, `random`, `math`, and `itertools`.
   - Statements like `from manim import *` and `import numpy as np` are stripped and replaced with `# [wanim] stripped: ...`.
   - Any external module (e.g. `import os`, `import sys`, `import requests`) raises a friendly error: `wanim: cannot use Python module '<mod>' (line X: import <mod>)`, which `errorFormatter.ts` cleanly categorizes as `unsupported_import`.

3. **Global Namespace & Native Class Wrapping (`dist/runtime_core.js:4467-4477`, `7053-7080`)**:
   ```javascript
   function wrapWanimNamespace(ns) {
       ...
       for (const [key, value] of Object.entries(ns)) {
           out[key] = isNativeClass(value) ? wrapNativeClass(value) : value;
       }
       return out;
   }
   ```
   - ES6 class constructors (`Circle`, `Square`, `Axes`, `VGroup`, etc.) are wrapped with `wrapNativeClass` so that calling `Circle()` without `new` works seamlessly from Python.
   - Over 960 symbols are injected into `buildRuntime().globals`, including colors (`RED`, `BLUE`, `WHITE`, `PINK`, `GOLD`, etc.), direction vectors (`UP`, `DOWN`, `LEFT`, `RIGHT`, `ORIGIN`, `UL`, `UR`, `DL`, `DR`), constants (`PI`, `TAU`), and geometry constructors.

4. **Modern `.animate` Builder Syntax Support (`dist/mobject/mobject.js:782-784`, `scene.js:706-720`)**:
   - `Mobject.prototype.animate` returns `createAnimationBuilder(this)`.
   - Passing raw mobject methods to `self.play(m.shift, RIGHT)` is explicitly rejected with `TypeError("Passing Mobject methods to Scene.play is no longer supported. Use Mobject.animate instead.")`, matching modern Manim Community (v0.18+).
   - `.animate` chaining is fully supported: `self.play(s.animate.shift(RIGHT * 2).rotate(PI / 4).scale(1.5))`.

5. **Browser Canvas Bridge Execution (`browser/bridge.browser.js:2:2500-3000`)**:
   - `runPythonOnCanvas(source, canvas, options)` compiles the Python source, evaluates it inside an isolated iframe realm (in browser) or context, extracts `Scene` subclasses, and drives `render_presentation_to_canvas`.
   - Supported run options: `quality: '-ql' | '-qm' | '-qh' | '-q4k'`, `realtime: boolean`, `fps: number`, `drawFrames: boolean`, `recordFrames: boolean`, `signal: AbortSignal`.

### 1.2 Empirical Headless Benchmark Validation
Running the 12-scene benchmark test script in `.agents/teamwork/teamwork_explorer_m6_1/probe_benchmark_suite.mjs` against `@wanimjs/wanim` yielded:
```text
================================================================
WANIM BENCHMARK SUITE: 12 CANONICAL MANIM COMMUNITY SCENES
================================================================

  ✓ PASS [Brand / Banner] OpeningManimExample -> 61 frames, 8349 draw calls (407ms)
  ✓ PASS [Basic Morphing] SquareToCircle -> 46 frames, 611 draw calls (86ms)
  ✓ PASS [Basic Shapes] WarmingUp -> 53 frames, 1104 draw calls (54ms)
  ✓ PASS [Coordinate Geometry] VectorArrow -> 53 frames, 6465 draw calls (105ms)
  ✓ PASS [Function Graphing] PlotFunctions -> 38 frames, 2539 draw calls (82ms)
  ✓ PASS [Successive Transforms] TransformCycle -> 76 frames, 1092 draw calls (45ms)
  ✓ PASS [Grouping & Layout] HierarchicalVGroup -> 46 frames, 1894 draw calls (62ms)
  ✓ PASS [Constructive Solid Geometry] BooleanShapes -> 38 frames, 2248 draw calls (85ms)
  ✓ PASS [Modern .animate Syntax] AnimateSyntax -> 53 frames, 528 draw calls (29ms)
  ✓ PASS [Grid & Coordinate Mapping] CoordinateSystem -> 38 frames, 2267 draw calls (47ms)
  ✓ PASS [NumPy Vector Math] NumpyWave -> 38 frames, 2708 draw calls (43ms)
  ✓ PASS [Polygons & Stars] PolygonShapes -> 46 frames, 1558 draw calls (35ms)

================================================================
BENCHMARK SUMMARY: 12 / 12 scenes passed (0 failed)
================================================================
```

---

## 2. Logic Chain

1. **Precondition Analysis**: The plugin executes user-authored Python Manim scripts using `@wanimjs/wanim` in Obsidian. To guarantee reliability, the plugin must accept standard Manim Community syntax while respecting the browser runtime boundary.
2. **Transpilation Compatibility**: Because RapydScript compiles Python directly into JavaScript in-memory:
   - Synchronous scene constructs (`def construct(self):`, `self.play(...)`, `self.wait(...)`) are naturally translated into asynchronous JS without requiring manual `async/await` from the user.
   - Standard Manim Community idioms (e.g. `c = Circle()`, `group = VGroup(a, b).arrange(RIGHT)`, `m.animate.shift(...)`) are fully supported because the runtime proxies classes and Mobject properties.
   - External library imports (like `os` or `sys`) are strictly rejected at the preprocessing stage, while `manim`, `numpy`, `math`, `random`, and `itertools` are natively mapped to browser-safe globals.
3. **Headless Test Harness Architecture**:
   - `runPythonOnCanvas` from `@wanimjs/wanim/bridge` requires a canvas element and uses an iframe execution realm.
   - In a headless Node test runner (e.g., `tests/run_tests.mjs`), a minimal mock DOM (`globalThis.document` with `createElement('iframe')` powered by Node's `node:vm` context, plus dummy element methods `remove`, `classList`, `setAttribute`) enables `runPythonOnCanvas` to run 100% identically to browser execution.
   - By creating a mock 2D canvas context that records draw operations (`fillRect`, `stroke`, `fill`, `bezierCurveTo`), tests can strictly verify that frames are not just compiled, but physically drawn to the canvas buffer.
4. **Scene Diversity**:
   - The 12 selected scenes cover the full spectrum of Manim Community features: branding (`ManimBanner`), morphing (`Transform`, `ReplacementTransform`), geometry (`Circle`, `Square`, `Triangle`, `Star`, `RegularPolygon`, `Line`, `Dot`, `Arrow`, `DashedLine`), layout (`VGroup`, `arrange`, `to_edge`, `to_corner`, `next_to`), constructive geometry (`Difference`), coordinate systems (`Axes`, `NumberPlane`, `c2p`), mathematical plotting (`plot` with lambda/math), modern `.animate` chaining, and NumPy array loops.
   - All 12 scenes execute within 1.1 seconds total runtime, making them ideal for automated CI regression testing.

---

## 3. Caveats

1. **Text & Fonts**: The `Text` class relies on Web font rendering (`opentype.js` parsing of TTF/OTF files). When running in an offline or headless Node environment without network access, font fetching from external CDNs (such as jsdelivr) is unavailable. Scenes in the automated test suite therefore rely on vectorized geometry, coordinate systems, math plotting, and shapes, while `Text` rendering in browser/Obsidian leverages Obsidian's local document fonts or cached assets.
2. **Real-time vs Frame-by-Frame in Tests**: In interactive Obsidian usage, animations run with `realtime: true` (yielding to browser RAF). In the headless test harness, running with `realtime: false` synchronously renders all frames tick-by-tick, providing deterministic assertion of total frames and draw operations without race conditions.

---

## 4. Conclusion & Concrete Design

### 4.1 Test Scene Catalog (`tests/test_scenes.ts`)

```typescript
/**
 * Benchmark Scene Catalog for Manim Community & Wanim Compatibility.
 * Follows Code Generation Guidelines:
 * - Invariant-rich types and pure definitions
 * - {value}By{key} naming conventions
 */

export interface BenchmarkSceneDefinition {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly minExpectedFrames: number;
    readonly source: string;
}

export const BENCHMARK_SCENES: readonly BenchmarkSceneDefinition[] = Object.freeze([
    {
        id: 'opening-manim',
        name: 'OpeningManimExample',
        category: 'Brand / Banner',
        minExpectedFrames: 30,
        source: `from manim import *

class OpeningManimExample(Scene):
    def construct(self):
        banner = ManimBanner()
        self.play(banner.create())
        self.play(banner.expand())
        self.wait(0.5)
`,
    },
    {
        id: 'square-to-circle',
        name: 'SquareToCircle',
        category: 'Basic Morphing',
        minExpectedFrames: 30,
        source: `from manim import *

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
`,
    },
    {
        id: 'warming-up',
        name: 'WarmingUp',
        category: 'Basic Shapes',
        minExpectedFrames: 30,
        source: `from manim import *

class WarmingUp(Scene):
    def construct(self):
        c = Circle(radius=1.0, color=BLUE)
        s = Square(side_length=1.5, color=RED)
        l = Line(LEFT, RIGHT, color=YELLOW)
        
        c.shift(LEFT * 2)
        s.shift(RIGHT * 2)
        
        self.play(Create(c), Create(s))
        self.play(Create(l))
        self.play(Rotate(c, PI), Rotate(s, PI / 4))
        self.wait(0.5)
`,
    },
    {
        id: 'vector-arrow',
        name: 'VectorArrow',
        category: 'Coordinate Geometry',
        minExpectedFrames: 30,
        source: `from manim import *

class VectorArrow(Scene):
    def construct(self):
        dot = Dot(ORIGIN, color=WHITE)
        arrow = Arrow(ORIGIN, [2, 2, 0], buff=0, color=GOLD)
        dashed = DashedLine([-2, -1, 0], [2, -1, 0], color=GRAY)
        self.play(GrowFromCenter(dot))
        self.play(Create(arrow), Create(dashed))
        self.play(arrow.animate.rotate(PI / 2, about_point=ORIGIN))
        self.wait(0.5)
`,
    },
    {
        id: 'plot-functions',
        name: 'PlotFunctions',
        category: 'Function Graphing',
        minExpectedFrames: 30,
        source: `from manim import *
import math

class PlotFunctions(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-2, 2, 1], x_length=6, y_length=4)
        sin_graph = ax.plot(lambda x: math.sin(x), color=BLUE)
        self.play(Create(ax))
        self.play(Create(sin_graph))
        self.wait(0.5)
`,
    },
    {
        id: 'transform-cycle',
        name: 'TransformCycle',
        category: 'Successive Transforms',
        minExpectedFrames: 45,
        source: `from manim import *

class TransformCycle(Scene):
    def construct(self):
        shape = Square(color=BLUE)
        self.play(Create(shape))
        
        c = Circle(color=RED)
        t = Triangle(color=GREEN)
        s = Star(color=YELLOW)
        
        self.play(ReplacementTransform(shape, c))
        self.play(ReplacementTransform(c, t))
        self.play(ReplacementTransform(t, s))
        self.play(FadeOut(s))
`,
    },
    {
        id: 'hierarchical-vgroup',
        name: 'HierarchicalVGroup',
        category: 'Grouping & Layout',
        minExpectedFrames: 30,
        source: `from manim import *

class HierarchicalVGroup(Scene):
    def construct(self):
        left_sub = VGroup(
            Circle(radius=0.5, color=BLUE),
            Square(side_length=0.8, color=RED)
        ).arrange(DOWN, buff=0.2)
        
        right_sub = VGroup(
            Triangle(color=GREEN).scale(0.6),
            Dot(color=YELLOW)
        ).arrange(UP, buff=0.2)
        
        root_group = VGroup(left_sub, right_sub).arrange(RIGHT, buff=1.5)
        
        self.play(FadeIn(root_group))
        self.play(root_group.animate.rotate(PI / 2).scale(1.2))
        self.play(FadeOut(root_group))
`,
    },
    {
        id: 'boolean-shapes',
        name: 'BooleanShapes',
        category: 'Constructive Solid Geometry',
        minExpectedFrames: 30,
        source: `from manim import *

class BooleanShapes(Scene):
    def construct(self):
        c1 = Circle(radius=1.5, color=RED).shift(LEFT * 0.8)
        c2 = Circle(radius=1.5, color=BLUE).shift(RIGHT * 0.8)
        diff = Difference(c1, c2, color=GREEN, fill_opacity=0.5)
        self.play(Create(c1), Create(c2))
        self.play(ReplacementTransform(c1, diff), FadeOut(c2))
        self.wait(0.5)
`,
    },
    {
        id: 'animate-syntax',
        name: 'AnimateSyntax',
        category: 'Modern .animate Syntax',
        minExpectedFrames: 30,
        source: `from manim import *

class AnimateSyntax(Scene):
    def construct(self):
        s = Square(color=RED, fill_opacity=0.5)
        self.play(Create(s))
        self.play(s.animate.shift(RIGHT * 2).rotate(PI / 4).scale(1.5))
        self.play(s.animate.set_color(YELLOW))
        self.wait(0.5)
`,
    },
    {
        id: 'coordinate-system',
        name: 'CoordinateSystem',
        category: 'Grid & Coordinate Mapping',
        minExpectedFrames: 30,
        source: `from manim import *

class CoordinateSystem(Scene):
    def construct(self):
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=8,
            y_length=6
        )
        dot = Dot(plane.c2p(2, 1), color=YELLOW)
        line = Line(plane.c2p(0, 0), plane.c2p(2, 1), color=RED)
        
        self.play(Create(plane))
        self.play(Create(line), FadeIn(dot))
        self.wait(0.5)
`,
    },
    {
        id: 'numpy-wave',
        name: 'NumpyWave',
        category: 'NumPy Vector Math',
        minExpectedFrames: 30,
        source: `from manim import *
import numpy as np

class NumpyWave(Scene):
    def construct(self):
        dots = VGroup()
        for x in np.linspace(-3, 3, 8):
            y = np.sin(x)
            d = Dot([x, y, 0], radius=0.08, color=TEAL)
            dots.add(d)
        
        self.play(Create(dots))
        self.play(dots.animate.shift(UP * 0.5))
        self.wait(0.5)
`,
    },
    {
        id: 'polygon-shapes',
        name: 'PolygonShapes',
        category: 'Polygons & Stars',
        minExpectedFrames: 30,
        source: `from manim import *

class PolygonShapes(Scene):
    def construct(self):
        hexagon = RegularPolygon(n=6, color=PURPLE)
        star = Star(n=7, outer_radius=1.5, inner_radius=0.7, color=ORANGE)
        poly = Polygon([-2, -1, 0], [0, 1, 0], [2, -1, 0], color=TEAL)
        
        shapes = VGroup(hexagon, star, poly).arrange(RIGHT, buff=0.8)
        
        self.play(Create(shapes))
        self.play(Rotate(shapes, PI))
        self.play(FadeOut(shapes))
`,
    },
]);

export const sceneById: Readonly<Record<string, BenchmarkSceneDefinition>> = Object.freeze(
    BENCHMARK_SCENES.reduce<Record<string, BenchmarkSceneDefinition>>((acc, scene) => {
        acc[scene.id] = scene;
        return acc;
    }, {})
);
```

### 4.2 Automated Test Harness (`tests/scenes_benchmark.ts`)

```typescript
/**
 * Automated Test Harness for Milestone 6:
 * Comprehensive Manim Community Benchmark Suite against @wanimjs/wanim.
 *
 * Adheres to User Architectural Guidelines:
 * - Local reasoning & honest leaf functions (createMockCanvas, installHeadlessDomEnvironment)
 * - Single uniform level of abstraction ("stacking bricks")
 * - Invariant-rich types (BenchmarkExecutionResult, BenchmarkSuiteSummary)
 * - Map naming conventions ({value}By{key})
 */

import assert from 'node:assert';
import vm from 'node:vm';
import { runPythonOnCanvas, RunPythonResult } from '@wanimjs/wanim/bridge';
import { ensureRapydscriptInitialized } from '../src/engine/rapydscriptInit';
import { BENCHMARK_SCENES, BenchmarkSceneDefinition } from './test_scenes';

export interface CanvasDrawCall {
    readonly method: string;
    readonly args: readonly unknown[];
}

export interface MockBenchmarkCanvas extends HTMLCanvasElement {
    readonly _drawCalls: readonly CanvasDrawCall[];
}

export interface BenchmarkExecutionResult {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly passed: boolean;
    readonly frames: number;
    readonly drawCalls: number;
    readonly elapsedMs: number;
    readonly error?: string;
}

export interface BenchmarkSuiteSummary {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly totalDrawCalls: number;
    readonly totalFrames: number;
    readonly results: readonly BenchmarkExecutionResult[];
}

/**
 * Honest leaf function to configure headless DOM and window globals for VM sandbox.
 */
export function installHeadlessDomEnvironment(targetGlobal: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
    targetGlobal.window = targetGlobal;
    targetGlobal.addEventListener = () => {};
    targetGlobal.removeEventListener = () => {};

    if (!targetGlobal.HTMLElement) {
        targetGlobal.HTMLElement = class HTMLElement {};
    }
    if (!targetGlobal.HTMLCanvasElement) {
        targetGlobal.HTMLCanvasElement = class HTMLCanvasElement extends (targetGlobal.HTMLElement as new () => object) {};
    }

    const createMockElement = () => ({
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
    });

    if (!targetGlobal.document) {
        targetGlobal.document = {
            head: {
                querySelector: () => null,
                appendChild: () => {},
            },
            createElementNS: () => createMockElement(),
            createElement: (tag: string) => {
                if (tag === 'iframe') {
                    const sandbox: Record<string, unknown> = {
                        console,
                    };
                    vm.createContext(sandbox);
                    sandbox.eval = (code: string) => vm.runInContext(code, sandbox);
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
}

/**
 * Creates a mock HTML5 canvas recording 2D context drawing operations.
 */
export function createMockBenchmarkCanvas(width = 1280, height = 720): MockBenchmarkCanvas {
    const drawCalls: CanvasDrawCall[] = [];
    const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        setTransform: (...args: unknown[]) => drawCalls.push({ method: 'setTransform', args }),
        fillRect: (...args: unknown[]) => drawCalls.push({ method: 'fillRect', args }),
        clearRect: (...args: unknown[]) => drawCalls.push({ method: 'clearRect', args }),
        beginPath: () => drawCalls.push({ method: 'beginPath', args: [] }),
        closePath: () => drawCalls.push({ method: 'closePath', args: [] }),
        moveTo: (...args: unknown[]) => drawCalls.push({ method: 'moveTo', args }),
        lineTo: (...args: unknown[]) => drawCalls.push({ method: 'lineTo', args }),
        bezierCurveTo: (...args: unknown[]) => drawCalls.push({ method: 'bezierCurveTo', args }),
        stroke: () => drawCalls.push({ method: 'stroke', args: [] }),
        fill: () => drawCalls.push({ method: 'fill', args: [] }),
        save: () => drawCalls.push({ method: 'save', args: [] }),
        restore: () => drawCalls.push({ method: 'restore', args: [] }),
        scale: (...args: unknown[]) => drawCalls.push({ method: 'scale', args }),
        translate: (...args: unknown[]) => drawCalls.push({ method: 'translate', args }),
        rotate: (...args: unknown[]) => drawCalls.push({ method: 'rotate', args }),
        arc: (...args: unknown[]) => drawCalls.push({ method: 'arc', args }),
    };

    const canvasClass = (globalThis as unknown as { HTMLCanvasElement: new () => HTMLCanvasElement }).HTMLCanvasElement;
    return Object.assign(new canvasClass(), {
        width,
        height,
        style: {},
        getRootNode: () => (globalThis as unknown as { document: unknown }).document,
        parentElement: {
            appendChild: () => {},
            removeChild: () => {},
            contains: () => true,
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: (type: string) => (type === '2d' ? ctx : null),
        _drawCalls: drawCalls,
    }) as MockBenchmarkCanvas;
}

/**
 * Executes a single benchmark scene definition against runPythonOnCanvas.
 */
export async function executeSceneBenchmark(
    scene: BenchmarkSceneDefinition,
    runner: typeof runPythonOnCanvas = runPythonOnCanvas
): Promise<BenchmarkExecutionResult> {
    const t0 = performance.now();
    const canvas = createMockBenchmarkCanvas();

    try {
        const res: RunPythonResult = await runner(scene.source, canvas, {
            quality: '-ql',
            realtime: false,
            drawFrames: true,
            preload: 'none',
        });
        const elapsedMs = Math.round(performance.now() - t0);
        const frames = (res.stats as { frames: number }).frames;
        const drawCalls = canvas._drawCalls.length;

        if (frames < scene.minExpectedFrames) {
            throw new Error(`Insufficient frames: got ${frames}, expected >= ${scene.minExpectedFrames}`);
        }
        if (drawCalls === 0) {
            throw new Error(`Zero canvas draw calls recorded!`);
        }

        return {
            id: scene.id,
            name: scene.name,
            category: scene.category,
            passed: true,
            frames,
            drawCalls,
            elapsedMs,
        };
    } catch (err) {
        return {
            id: scene.id,
            name: scene.name,
            category: scene.category,
            passed: false,
            frames: 0,
            drawCalls: 0,
            elapsedMs: Math.round(performance.now() - t0),
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/**
 * High-level benchmark orchestrator ("Table of Contents").
 */
export async function runBenchmarkSuite(
    scenes: readonly BenchmarkSceneDefinition[] = BENCHMARK_SCENES
): Promise<BenchmarkSuiteSummary> {
    console.log('\n================================================================');
    console.log(`WANIM BENCHMARK SUITE: ${scenes.length} CANONICAL MANIM COMMUNITY SCENES`);
    console.log('================================================================\n');

    ensureRapydscriptInitialized();
    installHeadlessDomEnvironment();

    const results: BenchmarkExecutionResult[] = [];
    let passed = 0;
    let failed = 0;
    let totalDrawCalls = 0;
    let totalFrames = 0;

    for (const scene of scenes) {
        const result = await executeSceneBenchmark(scene);
        results.push(result);

        if (result.passed) {
            passed++;
            totalDrawCalls += result.drawCalls;
            totalFrames += result.frames;
            console.log(`  ✓ PASS [${result.category}] ${result.name} -> ${result.frames} frames, ${result.drawCalls} draw calls (${result.elapsedMs}ms)`);
        } else {
            failed++;
            console.error(`  ✗ FAIL [${result.category}] ${result.name}: ${result.error}`);
        }
    }

    console.log('\n================================================================');
    console.log(`BENCHMARK SUMMARY: ${passed} / ${scenes.length} scenes passed (${failed} failed)`);
    console.log(`Total Frames Rendered: ${totalFrames} | Total Canvas Draw Calls: ${totalDrawCalls}`);
    console.log('================================================================\n');

    assert.strictEqual(failed, 0, `${failed} benchmark scenes failed execution!`);

    return {
        total: scenes.length,
        passed,
        failed,
        totalDrawCalls,
        totalFrames,
        results,
    };
}

// Auto-run when executed directly
if (process.argv[1]?.endsWith('scenes_benchmark.ts') || process.argv[1]?.endsWith('scenes_benchmark.mjs')) {
    runBenchmarkSuite().catch((err) => {
        console.error('Benchmark suite execution failed:', err);
        process.exit(1);
    });
}
```

### 4.3 Integration Plan for Implementer
1. **New Files**:
   - `tests/test_scenes.ts` — Contains the 12 canonical Manim Community scene scripts with typed definitions and `sceneById` dictionary.
   - `tests/scenes_benchmark.ts` — Implements headless mock canvas, DOM iframe context, and runner.
2. **Build & Test Runner Update (`tests/run_tests.mjs`)**:
   - Add entryPoint for `tests/scenes_benchmark.ts` bundling to `tests/dist/scenes_benchmark.mjs`.
   - Add execution step in `main()`: `runTestSuite('Milestone 6 Benchmark Suite', benchmarkOutfile)`.
3. **Execution Script**:
   - `npm test` will bundle and run all tests, including the 12 Manim Community benchmark scenes.

---

## 5. Verification Method

To independently verify the benchmark findings:

1. **Direct Benchmark Execution**:
   Run the proven standalone probe script in the state folder:
   ```powershell
   node "C:\Users\angel\Notes\.agents\teamwork\teamwork_explorer_m6_1\probe_benchmark_suite.mjs"
   ```
   **Expected Result**:
   - All 12 scenes pass with exit code 0.
   - Outputs: `BENCHMARK SUMMARY: 12 / 12 scenes passed (0 failed)`.
   - Total canvas draw calls exceed 30,000 across all scenes.

2. **Existing Test Suite Regression**:
   Verify that previous milestones remain untouched and passing:
   ```powershell
   npm --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin" test
   ```
   **Expected Result**: All 16 existing test suites pass with exit code 0.

3. **Invalidation Conditions**:
   - Any Python syntax error on canonical constructs (`SquareToCircle`, `Axes.plot`, `.animate`).
   - Zero frames rendered or zero 2D canvas draw operations logged.
   - Regression in any of the prior M1–M5 unit or adversarial stress tests.
