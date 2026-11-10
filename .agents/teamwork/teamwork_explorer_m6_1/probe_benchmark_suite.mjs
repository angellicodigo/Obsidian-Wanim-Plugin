import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// ============================================================================
// 1. Synchronous RapydScript Compiler Bootstrap
// ============================================================================
const rapydscriptPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js');
const rapydscriptSource = fs.readFileSync(rapydscriptPath, 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init.call(globalThis, globalThis);

// ============================================================================
// 2. Headless Mock Environment for DOM & Canvas
// ============================================================================
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

// ============================================================================
// 3. Import runPythonOnCanvas
// ============================================================================
const bridgeUrl = pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/bridge.browser.js').href;
const { runPythonOnCanvas } = await import(bridgeUrl);

function createMockCanvas(width = 1280, height = 720) {
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
    return Object.assign(new globalThis.HTMLCanvasElement(), {
        width,
        height,
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
}

// ============================================================================
// 4. Manim Community Benchmark Scene Catalog (10+ Scenes)
// ============================================================================
export const SCENE_CATALOG = [
    {
        id: 'opening-manim',
        name: 'OpeningManimExample',
        category: 'Brand / Banner',
        minExpectedFrames: 30,
        source: `
from manim import *

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
        source: `
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
`,
    },
    {
        id: 'warming-up',
        name: 'WarmingUp',
        category: 'Basic Shapes',
        minExpectedFrames: 30,
        source: `
from manim import *

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
        source: `
from manim import *

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
        source: `
from manim import *
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
        source: `
from manim import *

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
        source: `
from manim import *

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
        source: `
from manim import *

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
        source: `
from manim import *

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
        source: `
from manim import *

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
        source: `
from manim import *
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
        source: `
from manim import *

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
];

// ============================================================================
// 5. Suite Execution & Reporting
// ============================================================================
console.log('================================================================');
console.log('WANIM BENCHMARK SUITE: 12 CANONICAL MANIM COMMUNITY SCENES');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const scene of SCENE_CATALOG) {
    const t0 = performance.now();
    const canvas = createMockCanvas();
    try {
        const res = await runPythonOnCanvas(scene.source, canvas, {
            quality: '-ql',
            realtime: false,
            drawFrames: true,
            preload: 'none',
        });
        const elapsed = performance.now() - t0;
        const frames = res.stats.frames;
        const drawCalls = canvas._drawCalls.length;
        
        if (frames < scene.minExpectedFrames) {
            throw new Error(`Insufficient frames generated: got ${frames}, expected >= ${scene.minExpectedFrames}`);
        }
        if (drawCalls === 0) {
            throw new Error(`Zero canvas draw calls recorded!`);
        }
        
        passedCount++;
        results.push({
            name: scene.name,
            category: scene.category,
            status: 'PASS',
            frames,
            drawCalls,
            elapsedMs: Math.round(elapsed),
        });
        console.log(`  ✓ PASS [${scene.category}] ${scene.name} -> ${frames} frames, ${drawCalls} draw calls (${Math.round(elapsed)}ms)`);
    } catch (err) {
        failedCount++;
        results.push({
            name: scene.name,
            category: scene.category,
            status: 'FAIL',
            error: err.message,
        });
        console.error(`  ✗ FAIL [${scene.category}] ${scene.name}: ${err.message}`);
    }
}

console.log('\n================================================================');
console.log(`BENCHMARK SUMMARY: ${passedCount} / ${SCENE_CATALOG.length} scenes passed (${failedCount} failed)`);
console.log('================================================================');
