import { runPythonOnCanvas } from '@wanimjs/wanim/bridge';
import type { ConstructableScene, SceneStateChange } from '../types';

// Lazily load the patched RapydScript compiler
let rapydScriptLoaded = false;
let rapydScriptError: Error | null = null;

async function ensureRapydScriptLoaded(): Promise<void> {
	if (rapydScriptLoaded || rapydScriptError) {
		return;
	}
	try {
		// @ts-ignore - rapydscript.js is inlined as text by esbuild plugin at build time
		const rapydscriptText = await import('@wanimjs/wanim/browser/rapydscript');
		const code = typeof rapydscriptText === 'string' ? rapydscriptText : rapydscriptText.default || '';
		if (code) {
			new Function('external_namespace', code).call(globalThis, globalThis);
		}
		rapydScriptLoaded = true;
	} catch (err) {
		rapydScriptError = err instanceof Error ? err : new Error(String(err));
		console.error('Failed to load RapydScript compiler:', rapydScriptError);
		throw rapydScriptError;
	}
}

function readMountDimensions(outputEl: HTMLElement): { width: number; height: number } {
	const containerWidth = outputEl.offsetWidth || 800;
	const containerHeight = outputEl.offsetHeight || Math.round(containerWidth * (9 / 16));
	return { width: containerWidth, height: containerHeight };
}

function createCanvasElement(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.display = 'block';
	canvas.style.background = '#000000';
	return canvas;
}

function createControllerAdapter(
	controllerRef: { value: any },
	stateRef: { value: SceneStateChange },
): ConstructableScene {
	const stateListeners = new Set<(state: SceneStateChange) => void>();

	const notifyState = () => {
		const payload = stateRef.value;
		for (const listener of stateListeners) {
			try {
				listener(payload);
			} catch {
				// ignore listener errors
			}
		}
	};

	const adapter: ConstructableScene & { __notifyState?: () => void } = {
		get isPlaying() {
			return stateRef.value.isRunning;
		},
		get isPaused() {
			return stateRef.value.isPaused;
		},
		play: async () => {
			controllerRef.value?.restart?.();
			notifyState();
		},
		pause: () => {
			controllerRef.value?.abort?.();
			notifyState();
		},
		resume: () => {
			controllerRef.value?.restart?.();
			notifyState();
		},
		stop: () => {
			controllerRef.value?.abort?.();
			notifyState();
		},
		dispose: () => {
			controllerRef.value?.abort?.();
			stateListeners.clear();
		},
		onStateChange: (listener: (state: SceneStateChange) => void) => {
			stateListeners.add(listener);
			notifyState();
			return () => {
				stateListeners.delete(listener);
			};
		},
	};
	adapter.__notifyState = notifyState;
	return adapter;
}

export async function runWanimSource(
	source: string,
	outputEl: HTMLElement,
	onSceneReady?: (scene: ConstructableScene) => void,
	quality: string = '-qm',
): Promise<ConstructableScene | null> {
	outputEl.empty();

	// FIX: 3D scene not loading bug.
	// For 3D scenes (ThreeDScene, etc.) wanim needs a WebGL-capable
	// HTMLCanvasElement, not a plain div. Create a canvas element so that
	// Three.js can obtain a WebGL2 rendering context.
	// Without this, 3D scenes show "Running..." but render nothing.
	const canvas = createCanvasElement();
	outputEl.appendChild(canvas);

	// Wait for layout to settle so we get correct dimensions.
	// Without this, offsetWidth/offsetHeight are 0 and the canvas
	// is sized 0x0, causing Three.js to fail silently.
	const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
		requestAnimationFrame(() => resolve(readMountDimensions(outputEl)));
	});
	canvas.width = dimensions.width;
	canvas.height = dimensions.height;

	// Ensure canvas is visible
	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';

	const controllerRef = { value: null as any };
	const stateRef = { value: { isRunning: true, isPaused: false, isFinished: false } as SceneStateChange };
	const adapter = createControllerAdapter(controllerRef, stateRef);
	let notifiedReady = false;
	// Use Wanim's GPU renderer for 3D. The bundler below makes its scratch
	// WebGL canvas a DOM canvas instead of an OffscreenCanvas, which lets
	// Electron reliably composite the result into this visible 2D canvas.
	// If WebGL2 is actually unavailable, Wanim still falls back to Canvas2D.
	const useWebGL = true;

	try {
		// Load RapydScript compiler lazily on first render
		await ensureRapydScriptLoaded();

		await runPythonOnCanvas(source, canvas, ({
			quality,
			mode: 'normal',
			theme: 'auto',
			realtime: true,
			fps: 30,
			useWebGL,
			onController: (controller: unknown) => { controllerRef.value = controller; },
			onSceneReady: () => {
				if (!notifiedReady) {
					notifiedReady = true;
					onSceneReady?.(adapter);
				}
			},
		} as any));
		stateRef.value = { isRunning: false, isPaused: false, isFinished: true };
		(adapter as any).__notifyState?.();
		if (!notifiedReady) onSceneReady?.(adapter);
		return adapter;
	} catch (error) {
		console.error('Wanim render failed:', error);
		throw error;
	}
}
