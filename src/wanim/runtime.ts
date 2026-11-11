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

function createSceneAdapter(
	playerOrScene: any,
	cleanupListeners: () => void,
): ConstructableScene {
	const stateListeners = new Set<(state: SceneStateChange) => void>();

	const notifyState = () => {
		const isPlaying = Boolean(playerOrScene.isPlaying);
		const isFinished = Boolean(playerOrScene._masterTimeline?.isFinished?.());
		const currentTime = playerOrScene._masterTimeline?.getCurrentTime?.() ?? 0;
		const isPaused = !isPlaying && !isFinished && currentTime > 0;
		const payload: SceneStateChange = {
			isRunning: isPlaying,
			isPaused,
			isFinished,
		};
		for (const listener of stateListeners) {
			try {
				listener(payload);
			} catch {
				// ignore listener errors
			}
		}
	};

	const origPlay = typeof playerOrScene.play === 'function' ? playerOrScene.play.bind(playerOrScene) : null;
	if (origPlay) {
		playerOrScene.play = function (...args: any[]) {
			origPlay(...args);
			notifyState();
		};
	}

	const origPause = typeof playerOrScene.pause === 'function' ? playerOrScene.pause.bind(playerOrScene) : null;
	if (origPause) {
		playerOrScene.pause = function (...args: any[]) {
			origPause(...args);
			notifyState();
		};
	}

	if (playerOrScene._ui && typeof playerOrScene._ui.setPlaying === 'function') {
		const origSetPlaying = playerOrScene._ui.setPlaying.bind(playerOrScene._ui);
		playerOrScene._ui.setPlaying = function (isPlaying: boolean, isFinished = false) {
			origSetPlaying(isPlaying, isFinished);
			notifyState();
		};
	}

	return {
		get isPlaying() {
			return Boolean(playerOrScene.isPlaying);
		},
		get isPaused() {
			const isPlaying = Boolean(playerOrScene.isPlaying);
			const isFinished = Boolean(playerOrScene._masterTimeline?.isFinished?.());
			return !isPlaying && !isFinished;
		},
		play: async () => {
			playerOrScene.play?.();
			notifyState();
		},
		pause: () => {
			playerOrScene.pause?.();
			notifyState();
		},
		resume: () => {
			playerOrScene.play?.();
			notifyState();
		},
		stop: () => {
			playerOrScene.pause?.();
			playerOrScene.seek?.(0);
			notifyState();
		},
		dispose: () => {
			cleanupListeners();
			stateListeners.clear();
			try {
				playerOrScene.dispose?.();
			} catch {
				// ignore disposal errors
			}
		},
		onStateChange: (listener: (state: SceneStateChange) => void) => {
			stateListeners.add(listener);
			notifyState();
			return () => {
				stateListeners.delete(listener);
			};
		},
	};
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

	let capturedResult: any = null;

	try {
		// Load RapydScript compiler lazily on first render
		await ensureRapydScriptLoaded();

		const result = await runPythonOnCanvas(source, canvas, {
			quality,
			mode: 'normal',
			theme: 'auto',
			realtime: true,
			fps: 30,
			onSceneReady: (scene: unknown) => {
				capturedResult = scene;
				if (onSceneReady) {
					const adapter = createSceneAdapter(scene as any, () => {
						// no-op cleanup
					});
					onSceneReady(adapter);
				}
			},
		});

		if (capturedResult) {
			const adapter = createSceneAdapter(capturedResult, () => {
				// no-op cleanup
			});
			return adapter;
		}

		return null;
	} catch (error) {
		console.error('Wanim render failed:', error);
		throw error;
	}
}
